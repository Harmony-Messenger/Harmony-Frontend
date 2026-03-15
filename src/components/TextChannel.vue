<script setup>
import { ref, onUnmounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { date } from 'quasar';
import { api } from 'src/boot/axios';
import MessageNotificationSound from './../assets/audio/message-sent.wav';

const Loading = ref(true);
const Route = useRoute();
const Messages = ref([]);
const Error = ref('');
const NotificationSound = new Audio(MessageNotificationSound);
const NewMessage = ref('');
const ChannelID = ref(Route.params.channelid);
const LastActive = ref();
const Typing = ref([]);
let TypingTimer = null;

LastActive.value = Date.now();

document.addEventListener("visibilitychange", () => {
  if(!document.hidden)
  {
    LastActive.value = Date.now();
  }
});

watch(Route, () => {
  ChannelID.value = Route.params.channelid;

  Loading.value = true;

  api.get('/message/'+ChannelID.value).then(response => {
    if(response.status == 200)
    {
      response.data.forEach(element => {
        element.Sent = date.formatDate(element.Sent, 'HH:mm');
      });

        Messages.value = response.data;
        Loading.value = false;
    }
    else
    {
      Error.value = 'Unable to connect';
      Loading.value = false;
    }
  });
});

api.get('/message/'+ChannelID.value).then(response => {
  if(response.status == 200)
  {
    response.data.forEach(element => {
      element.Day = date.formatDate(element.Sent, 'dddd DD MMMM YYYY');

      var Exists = false;

      Messages.value.forEach(Message => {
        if(Message.Day == element.Day)
        {
          Exists = true;
        }
      });

      if(!Exists)
      {
        Messages.value.push({ Day: date.formatDate(element.Sent, 'dddd DD MMMM YYYY'), Messages: [] });
      }
    });

    response.data.forEach(element => {
      element.Day = date.formatDate(element.Sent, 'dddd DD MMMM YYYY');

      Messages.value.forEach(Message => {

        if(element.Day == Message.Day)
        {
          Message.Messages.push(element);
        }
      });
    });

    Loading.value = false;
  }
  else if(response.status == 401)
  {
    localStorage.removeItem('AuthToken');
    window.location.reload();
  }
  else
  {
    Error.value = 'Unable to connect';
    Loading.value = false;
  }
});

function SendMessage(event)
{
  if(NewMessage.value != undefined && NewMessage.value != '' && !event.shiftKey)
  {
    api.post('/message/'+ChannelID.value, { 'ChannelID': ChannelID.value, Message: NewMessage.value }).then(response => {
      if(response.data == 'OK')
      {
        NewMessage.value = '';
        event.target.rows = 2;
        api.delete('/channel/'+ChannelID.value+'/activity');
        NotificationSound.play();
      }
      else if(response.status == 401)
      {
        localStorage.removeItem('AuthToken');
        window.location.reload();
      }
    });
  }
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

function RefreshActivity()
{
  api.get('/channel/'+ChannelID.value+'/activity').then(response =>{
    if(response.status == 200)
    {
      Typing.value = Typing.value.filter(u => response.data.includes(u.Username));

      for(const Activity of response.data)
      {
        const Exists = Typing.value.find(u => u.Username === Activity.Username);

        if(Activity.Type == 'Typing')
        {
          if(!Exists)
          {
            Typing.value.push(Activity);
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

function StartTyping()
{
  if(NewMessage.value == '')
  {
    clearTimeout(TypingTimer);
    api.delete('/channel/'+ChannelID.value+'/activity');
    RefreshActivity();
  }
  else
  {
    api.post('/channel/'+ChannelID.value+'/activity', { Type: 'Typing' });

    clearTimeout(TypingTimer);

    TypingTimer = setTimeout(() => {
      api.delete('/channel/'+ChannelID.value+'/activity');
    }, 2000);
  }
}

function RefreshMessages()
{
  let LatestMessageID = 0;

  if(Messages.value.length > 0)
  {
    LatestMessageID = Messages.value[0].Messages[0].ID;
  }

  api.get('/message/'+ChannelID.value+'/latest', { params: { 'LatestMessageID': LatestMessageID}}).then(response => {
    if(response.status == 200)
    {
      if(response.data.length > 0)
      {
        for(const Day of response.data)
        {
          Day.Day = date.formatDate(Day.Sent, 'dddd DD MMMM YYYY');

          const Exists = Messages.value.find(d => d.Day === Day.Day);

          if(!Exists)
          {
            Messages.value.unshift({ 'Day': Day.Day, 'Messages': [] });
          }
        }

        for(const Day of response.data)
        {
          Day.Day = date.formatDate(Day.Sent, 'dddd DD MMMM YYYY');

          const Group = Messages.value.find(d => d.Day === Day.Day);

          if(Group)
          {
            Group.Messages.unshift(Day);
          }
        }

        api.get('/message/'+ChannelID.value+'/read');

      }
    }
    else if(response.status == 401)
    {
      localStorage.removeItem('AuthToken');
      window.location.reload();
    }
    else
    {
      Error.value = 'Could not connect';
    }
  });
}

const RefreshTimer = setInterval(RefreshMessages, 500);
const ActivityRefreshTimer = setInterval(RefreshActivity, 2000);

onUnmounted(() =>
{
  clearInterval(RefreshTimer);
  clearInterval(ActivityRefreshTimer);
});

</script>

<template>
  <div id="TextChannel" v-if="!Loading" @mouseover="LastActive = Date.now()">
    <div id="MessageHistory" v-if="Messages != undefined">
      <div class="Day" v-for="Day in Messages" :key="Day">
        <div class="DayHeader">
          <hr />
          <h2>{{ Day.Day }}</h2>
          <hr />
        </div>

        <div class="Messages" v-if="Day.Messages != undefined">
          <div class="Message" v-for="Message in Day.Messages" :key="Message.ID">
            <div class="Avatar">

            </div>

            <span class="Meta">
              {{ date.formatDate(Message.Sent, 'HH:mm') }}
            </span>

            <span class="Username" :style="'color: '+Message.Colour+';'" @click.stop>
              {{ Message.Username }}:
            </span>

            <span class="Content">
              {{ Message.Content }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div id="ChannelActivity" v-if="Typing.length == 1">
      <div class="TypingUser" v-for="User in Typing" :key="User">{{ User.Username }} is typing...</div>
    </div>

    <div id="ChannelActivity" v-else-if="Typing.length < 5 && Typing.length >= 1">
      <div class="TypingUserUsername" v-for="(User, Index) in Typing" :key="User">{{ Index == Typing.length - 1 ? User.Username : User.Username+', ' }}</div> are typing...
    </div>

    <div id="ChannelActivity" v-else-if="Typing.length > 5 ">
      Many users are typing...
    </div>

    <div id="NewMessage">
      <textarea v-model="NewMessage" placeholder="Send a message..." @keyup="LastActive = Date.now(); ResizeMessageBox($event.target)" @keydown="StartTyping()" @keyup.enter.stop.prevent="SendMessage($event)"></textarea>
    </div>
  </div>

  <div id="TextChannel" v-else>
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

@keyframes FadeIn {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

@keyframes FadeOut {
  0% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

#TextChannel {
  width: 100%;
  padding: 0 10px;
  border-style: solid;
  border-width: 0 1px 0 0;
  border-color: rgba(200, 200, 200, 0.1);
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: hidden;
}

#TextChannel #MessageHistory {
  padding: 10px;
  display: flex;
  flex-direction: column-reverse;
  flex-grow: 1;
  color: rgba(255, 255, 255, 0.7);
  word-spacing: 2px;
  gap: 8px;
  overflow-y: auto;
  overflow-x: hidden;
  animation: FadeIn 0.5s forwards;
  text-shadow: 1px 1px 1px rgb(0, 0, 0);
}

#TextChannel #MessageHistory .Day {
  display: flex;
  flex-direction: column;
}

#TextChannel #MessageHistory .Day .DayHeader {
  display: flex;
  align-items: center;
  gap: 10px
}

#TextChannel #MessageHistory .Day .DayHeader h2 {
  margin: 0;
  padding: 0;
  font-size: 1em;
  font-weight: bold;
  flex-grow: 0;
}

#TextChannel #MessageHistory .Day .DayHeader hr {
  flex-grow: 1;
  border-style: double;
  border-width: 3px 0 0 0;
  border-color: rgba(255, 255, 255, 0.1);
}

#TextChannel #MessageHistory .Day .Messages {
  display: flex;
  flex-direction: column-reverse;
}

#TextChannel #MessageHistory .Day .Messages .Message {
  width: 100%;
  padding: 4px;
  overflow-wrap: break-word;
  white-space: pre-wrap;
  border-radius: 4px;
}

#TextChannel #MessageHistory .Day .Messages .Message:hover {
  animation: 0.2s FadeHighlight forwards;
}

#TextChannel #MessageHistory .Day .Messages .Message .Meta {
  padding: 0 8px 0 0;
  font-size: 0.8em;
  color: rgba(255, 255, 255, 0.2);
  letter-spacing: 0;
}

#TextChannel #MessageHistory .Day .Messages .Message .Username {
  padding: 0 5px 0 0;
  font-weight: bold;
  letter-spacing: 0;
}

#TextChannel #MessageHistory .Day .Messages .Message .Content {
  width: 100%;
  overflow-wrap: break-word;
  word-wrap: break-word;
  overflow: hidden;
}

#TextChannel #ChannelActivity {
  padding: 0 0 0 10px;
  display: flex;
  gap: 5px;
  animation: 1s forwards FadeIn;
  font-size: 0.8em;
}

#TextChannel #ChannelActivity.Hidden {
  animation: 1s forwards FadeOut;
}

#TextChannel #NewMessage {
  padding: 5px;
}

#TextChannel #NewMessage textarea {
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
