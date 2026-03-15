<script setup>
import { ref, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { date } from 'quasar';
import { api } from 'src/boot/axios';

const emit = defineEmits(['rekeyconversation'])

const Loading = ref(true);
const Route = useRoute();
const Session = ref({});
const NewMessage = ref('');
const User = ref(undefined);
let RefreshMessagesTimer = undefined;

Session.value.Messages = [];

api.get('/user/'+Route.params.username).then(response => {
  if(response.status == 200)
  {
    User.value = response.data[0];

    api.get('/dm/'+Route.params.username).then(async (response) => {
      if(response.status == 200)
      {
        Session.value.ID = response.data.ID;
        Session.value.RecipientPublicKey = response.data.RecipientPublicKey;
        Session.value.MyPublicKey = response.data.MyPublicKey;
        Session.value.PublicKeyRequired = response.data.PublicKeyRequired;

        const ProfileImage = await api.get('/image/'+Route.params.username, { responseType: 'blob' });
        User.value.ProfileImage = URL.createObjectURL(ProfileImage.data);

        if(response.data.Messages)
        {
          for(const Message of response.data.Messages)
          {
            Message.Day = date.formatDate(Message.Sent, 'dddd DD MMMM YYYY');

            const Exists = Session.value.Messages.find(d => d.Day === Message.Day);

            if(!Exists)
            {
              Session.value.Messages.push({ 'Day': Message.Day, 'Messages': [] });
            }
          }

          for(const Message of response.data.Messages)
          {
            Message.Day = date.formatDate(Message.Sent, 'dddd DD MMMM YYYY');

            if(Message.PrivateKey && Message.IV)
            {
              Message.Content = await DecryptMessage(Message);
            }

            const Group = Session.value.Messages.find(d => d.Day === Message.Day);

            if(Group)
            {
              Group.Messages.push(Message);
            }
          }
        }
      }

      Loading.value = false;
    });
  }
  else if(response.status == 401)
  {
    localStorage.removeItem('AuthToken');
    window.location.reload();
  }
});

function RefreshMessages()
{
  api.get('/dm/'+Route.params.username+'/latest', { params: { 'LatestMessageID': Session.value.Messages[0].Messages[0].ID }}).then(async (response) => {
    if(response.status == 200)
    {
      if(response.data.Messages)
      {
        for(const Message of response.data.Messages)
        {
          Message.Day = date.formatDate(Message.Sent, 'dddd DD MMMM YYYY');

          const Exists = Session.value.Messages.find(d => d.Day === Message.Day);

          if(!Exists)
          {
            Session.value.Messages.unshift({ 'Day': Message.Day, 'Messages': [] });
          }
        }

        for(const Message of response.data.Messages)
        {
          Message.Day = date.formatDate(Message.Sent, 'dddd DD MMMM YYYY');

          if(Message.PrivateKey && Message.IV)
          {
            Message.Content = await DecryptMessage(Message);
          }

          const Group = Session.value.Messages.find(d => d.Day === Message.Day);

          if(Group)
          {
            Group.Messages.unshift(Message);
          }
        }
      }
    }
    else if(response.status == 401)
    {
      localStorage.removeItem('AuthToken');
      window.location.reload();
    }
  });
}

async function GeneratePublicKey()
{
  const KeyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 4096,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );
  return KeyPair;
}

async function ExportKey(Key)
{
  const PublicKey = await window.crypto.subtle.exportKey("spki", Key);
  return btoa(String.fromCharCode(...new Uint8Array(PublicKey)));
}

async function SendMessage(event)
{
  if(NewMessage.value != undefined && NewMessage.value != '' && !event.shiftKey)
  {
    let Data = {};
    const { key: Key } = await GetOrCreatePrivateKey(User.value.Username);
    let MyPrivateKey = Key;
    let MyPublicKeyObject = null;

    if(Session.value.ID == undefined || MyPrivateKey == null)
    {
      const NewKeyPair = await GeneratePublicKey();
      MyPublicKeyObject = NewKeyPair.publicKey;
      MyPrivateKey = NewKeyPair.privateKey;

      const { DB } = await GetOrCreatePrivateKey(User.value.Username);
      const Transaction = DB.transaction('PrivateKeys', 'readwrite');

      Transaction.objectStore('PrivateKeys').put({
        'Username': User.value.Username,
        'Key': MyPrivateKey,
        'PublicKey': MyPublicKeyObject
      });
    }
    else
    {
      const MyRawPublicKey = Uint8Array.from(atob(Session.value.MyPublicKey), c => c.charCodeAt(0));
      MyPublicKeyObject = await window.crypto.subtle.importKey("spki", MyRawPublicKey, { name: "RSA-OAEP", hash: "SHA-256" }, true, ["encrypt"]);
    }

    if(Session.value.PublicKeyRequired || Session.value.ID == undefined)
    {
      Data.PublicKey = await ExportKey(MyPublicKeyObject);
    }

    if(Session.value.RecipientPublicKey)
    {
      const AESKey = await window.crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
      const IV = window.crypto.getRandomValues(new Uint8Array(12));
      const EncodedMessage = new TextEncoder().encode(NewMessage.value);
      const EncryptedMessage = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv: IV }, AESKey, EncodedMessage);

      const RecipientRawKey = Uint8Array.from(atob(Session.value.RecipientPublicKey), c => c.charCodeAt(0));
      const RecipientPublicKey = await window.crypto.subtle.importKey("spki", RecipientRawKey, { name: "RSA-OAEP", hash: "SHA-256" }, true, ["encrypt"]);

      const RawAESKey = await window.crypto.subtle.exportKey("raw", AESKey);
      const RecipientAESKey = await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, RecipientPublicKey, RawAESKey);
      const MyAESKey = await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, MyPublicKeyObject, RawAESKey);

      Data.Content = btoa(String.fromCharCode(...new Uint8Array(EncryptedMessage)));
      Data.ToUserPrivateKey = btoa(String.fromCharCode(...new Uint8Array(RecipientAESKey)));
      Data.FromUserPrivateKey = btoa(String.fromCharCode(...new Uint8Array(MyAESKey)));
      Data.IV = btoa(String.fromCharCode(...new Uint8Array(IV)));
    }
    else
    {
      Data.Content = NewMessage.value;
    }

    api.post('/dm/'+Route.params.username, Data).then(response => {
      if(response.data == 'OK')
      {
        NewMessage.value = '';
        event.target.rows = 2;
      }
       else if(response.status == 401)
      {
        localStorage.removeItem('AuthToken');
        window.location.reload();
      }
    });
  }
}

async function DecryptMessage(Message)
{
  try
  {
    const MyPrivateKey = await GetOrCreatePrivateKey(User.value.Username);

    const EncryptedAES = Uint8Array.from(atob(Message.PrivateKey), c => c.charCodeAt(0));
    const IV = Uint8Array.from(atob(Message.IV), c => c.charCodeAt(0));
    const EncryptedContent = Uint8Array.from(atob(Message.Content), c => c.charCodeAt(0));

    const DecryptedAES = await window.crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      MyPrivateKey.key,
      EncryptedAES
    );

    const AESKey = await window.crypto.subtle.importKey(
      "raw",
      DecryptedAES,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );

    const DecryptedContent = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: IV },
      AESKey,
      EncryptedContent
    );

    return new TextDecoder().decode(DecryptedContent);
  }
  catch(Error)
  {
    console.error(Error);
    return "[Unable to Decrypt]";
  }
}


async function GetOrCreatePrivateKey(username) {
  return new Promise((resolve, reject) => {
    const Request = indexedDB.open('DMKeys', 2);

    Request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('PrivateKeys')) {
        db.createObjectStore('PrivateKeys', { keyPath: 'Username' });
      }
    };

    Request.onsuccess = (e) => {
      const DB = e.target.result;
      const Transaction = DB.transaction('PrivateKeys', 'readonly');
      const Store = Transaction.objectStore('PrivateKeys');
      const Data = Store.get(username);

      Data.onsuccess = () => resolve({ DB, key: Data.result ? Data.result.Key : null, publicKey: Data.result ? Data.result.PublicKey : null });
    };

    Request.onerror = (e) => reject(e.target.error);
  });
}

function ResizeMessageBox(MessageBox)
{
  var TextAreaRowCount = MessageBox.value.split("\n").length;

  if(TextAreaRowCount <= 2 || TextAreaRowCount == undefined)
  {
    MessageBox.rows = 2;
  }
  else
  {
    MessageBox.rows = TextAreaRowCount;
  }
}

async function RekeyConversation() {
    const NewKeyPair = await GeneratePublicKey();

    const { DB } = await GetOrCreatePrivateKey(User.value.Username);
    const Transaction = DB.transaction('PrivateKeys', 'readwrite');

    Transaction.objectStore('PrivateKeys').put({
        'Username': User.value.Username,
        'Key': NewKeyPair.privateKey
    });

    const ExportedPublicKey = await ExportKey(NewKeyPair.publicKey);

    emit('rekeyconversation', User.value, ExportedPublicKey);
}

RefreshMessagesTimer = setInterval(RefreshMessages, 200);

onUnmounted(() =>
{
  clearInterval(RefreshMessagesTimer);
});
</script>

<template>

  <div id="DirectMessages" v-if="!Loading">
    <div class="Title">
      <div class="Avatar">
        <div class="ImageContainer">
          <img :src="User.ProfileImage" v-if="!User.Avatar"/>
        </div>
        <span :class="'StatusIndicator'+(User.IsOnline == 1 ? ' Online' : ' Offline')">
          &nbsp;
        </span>
      </div>

      <div class="Username" :style="'color: '+User.AccessLevelColour">
        {{ User.Username }}
      </div>

      <div class="Options">
        <q-btn dense dark title="Re-key conversation" @click="RekeyConversation()"><q-icon name="lock_reset" /></q-btn>
      </div>
    </div>

    <div id="MessageHistory" v-if="Session.Messages.length == 0">
      <div class="Message">
        <span class="Content">
          You haven't messaged eachother yet.
        </span>
      </div>
    </div>

    <div id="MessageHistory" v-else>
      <div class="Day" v-for="Day in Session.Messages" :key="Day">
        <div class="DayHeader">
          <hr />
          <h2>{{ Day.Day }}</h2>
          <hr />
        </div>

        <div class="Messages">
          <q-menu touch-position no-focus dark>
            <q-btn>😊</q-btn>
          </q-menu>

          <div class="Message" v-for="Message in Day.Messages" :key="Message.ID">
            <div class="Avatar">

            </div>

            <span class="Meta">
              {{ date.formatDate(Message.Sent, 'HH:mm') }}
            </span>

            <span class="Username" :style="'color: '+Message.UsernameColour+';'" @click.stop>
              {{ Message.Username }}:
            </span>

            <span class="Content">
              {{ Message.Content }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div id="NewMessage">
      <textarea v-model="NewMessage" placeholder="Send a message..." @keyup="LastActive = Date.now(); ResizeMessageBox($event.target)" @keyup.enter.stop.prevent="SendMessage($event)"></textarea>
    </div>
  </div>

  <div id="DirectMessages" v-else>

  </div>

</template>

<style lang="css" scoped>
@keyframes FadeHighlight {
  0% {
    background-color: none;
  }
  100% {
    background-color: rgba(0, 0, 0, 0.2);
  }
}

#DirectMessages {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-style: solid;
  border-width: 0 1px 0 0;
  border-color: rgba(200, 200, 200, 0.1);
  overflow: hidden;
}

#DirectMessages .Title {
  padding: 10px;
  display: flex;
  gap: 10px;
  align-items: center;
  border-style: solid;
  border-width: 0 0 1px 0;
  border-color: rgba(200, 200, 200, 0.1);
}

#DirectMessages .Title .Avatar {
  height: 32px;
  width: 32px;
  border-radius: 50%;
  border-style: solid;
  border-width: 2px;
  border-color: #323232;
  box-shadow: 0 0 5px 2px rgba(0, 0, 0, 0.2);
  position: relative;
}

#DirectMessages .Title .Avatar .ImageContainer {
  height: 100%;
  width: 100%;
  border-radius: 50%;
  overflow: hidden;
}

#DirectMessages .Title .Avatar .ImageContainer img {
  width: 100%;
  height: 100%;
  display: block;
}

#DirectMessages .Title .Avatar .StatusIndicator {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  position: absolute;
  bottom: -4px;
  right: -4px;
  border-style: solid;
  border-width: 2px;
  border-color: #323232;
}

#DirectMessages .Title .Avatar .StatusIndicator.Online {
  background-color: rgb(2, 114, 2);
}

#DirectMessages .Title .Avatar .StatusIndicator.Offline {
  background-color: rgb(95, 0, 0);
}

#DirectMessages .Title .Username {
  flex-grow: 1;
}

#DirectMessages #MessageHistory {
  padding: 10px;
  display: flex;
  flex-direction: column-reverse;
  flex-grow: 1;
  color: rgba(255, 255, 255, 0.7);
  word-spacing: 2px;
  gap: 8px;
  overflow-y: auto;
  overflow-x: hidden;
}

#DirectMessages #MessageHistory .Day {
  display: flex;
  flex-direction: column;
}

#DirectMessages #MessageHistory .Day .DayHeader {
  display: flex;
  align-items: center;
  gap: 10px
}

#DirectMessages #MessageHistory .Day .DayHeader h2 {
  margin: 0;
  padding: 0;
  font-size: 1em;
  font-weight: bold;
  flex-grow: 0;
}

#DirectMessages #MessageHistory .Day .DayHeader hr {
  flex-grow: 1;
  border-style: double;
  border-width: 3px 0 0 0;
  border-color: rgba(255, 255, 255, 0.1);
}

#DirectMessages #MessageHistory .Day .Messages {
  display: flex;
  flex-direction: column-reverse;
}

#DirectMessages #MessageHistory .Day .Messages .Message {
  width: 100%;
  padding: 4px;
  overflow-wrap: break-word;
  white-space: pre-wrap;
  border-radius: 4px;
}

#DirectMessages #MessageHistory .Day .Messages .Message:hover {
  animation: 0.2s FadeHighlight forwards;
}

#DirectMessages #MessageHistory .Day .Messages .Message .Meta {
  padding: 0 8px 0 0;
  font-size: 0.8em;
  color: rgba(255, 255, 255, 0.2);
  letter-spacing: 0;
}

#DirectMessages #MessageHistory .Day .Messages .Message .Username {
  padding: 0 5px 0 0;
  font-weight: bold;
  letter-spacing: 0;
}

#DirectMessages #MessageHistory .Day .Messages .Message .Content {
  width: 100%;
  overflow-wrap: break-word;
  word-wrap: break-word;
  overflow: hidden;
}

#DirectMessages #NewMessage {
  padding: 5px;
}

#DirectMessages #NewMessage textarea {
  width: 100%;
  max-height: 450px;
  padding: 10px;
  border-radius: 5px;
  outline: none;
  background-color: rgba(0, 0, 0, 0.4);
  color: rgb(255, 255, 255);
  align-content: center;
  font-size: 0.8em;
  border: none;
  resize: none;
}
</style>
