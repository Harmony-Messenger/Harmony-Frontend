<script setup>
import { useRoute } from 'vue-router';
import { api } from 'src/boot/axios';
import { ref } from 'vue';

const Route = useRoute();
const SelectedUsername = Route.params.username;
const Loading = ref(true);
const User = ref();
const Editing = ref(false);
const ErrorState = ref(undefined);
let PreviousBio = undefined;
let PreviousTagline = undefined;

api.get('/user/'+SelectedUsername).then(response => {
  if(response.status == 200)
  {
    User.value = response.data[0];

    api.get('/image/'+User.value.Username, { responseType: 'blob' }).then(response => {
      if(response.status == 200)
      {
        User.value.ProfileImage = URL.createObjectURL(response.data);
      }
       else if(response.status == 401)
      {
        localStorage.removeItem('AuthToken');
        window.location.reload();
      }
    });
    Loading.value = false;
  }
});

function Edit()
{
  PreviousBio = User.value.Profile.Bio;
  PreviousTagline = User.value.Profile.Tagline;

  Editing.value = true;
}

function Cancel()
{
  User.value.Profile.Bio = PreviousBio;
  User.value.Profile.Tagline = PreviousTagline;

  Editing.value = false;
}

function Save()
{
  User.value.UpdateProfile = true;

  api.post('/user/'+Route.params.username, User.value).then(response => {
    if(response.status != 200)
    {
      User.value.Profile.Bio = PreviousBio;
      User.value.Profile.Tagline = PreviousTagline;

      Editing.value = false;

      ErrorState.value = 'Something went wrong';
    }

    Editing.value = false;
  });
}

function UpdateAvatar()
{
  const Input = document.createElement('input');
  Input.type = 'file';
  Input.accept = 'image/jpeg, image/png, image/gif, image/webp';

  Input.onchange = async (e) => {
    const NewPhoto = e.target.files[0];

    if(!NewPhoto) return;

    await api.post('/image/'+User.value.Username, NewPhoto, { headers: { 'Content-Type': NewPhoto.type }});
    window.location.reload();
  }

  Input.click();
}
</script>

<template>
  <div id="UserProfile" v-if="!Loading">
    <div class="Username">
      <div class="Avatar">
        <div class="ImageContainer">
          <div class="ChangeAvatar" v-if="User.Me"><q-icon class="Icon" name="add_a_photo" size="32px" @click="UpdateAvatar()"/></div>
          <img :src="User.ProfileImage" />
        </div>

        {{ ErrorState }}

        <span :class="'StatusIndicator'+(User.IsOnline == 1 ? ' Online' : ' Offline')">
          &nbsp;
        </span>

      </div>

      <div class="UsernameStatus">
        <div class="UsernameText">{{ User.Username }}</div>

        <span v-if="User.IsOnline" class="OnlineText">ONLINE</span>
        <span v-else class="OfflineText">OFFLINE</span>

        <div class="Actions">
          <q-btn size="14px" dense flat title="Send a direct message" :to="'/dm/'+User.Username">
            <q-icon name="message"></q-icon>
          </q-btn>

          <q-btn size="14px" dense flat title="Edit Profile" @click="Edit()" v-if="User.Me && !Editing">
            <q-icon name="edit"></q-icon>
          </q-btn>

          <q-btn size="14px" dense flat title="Save Changes" @click="Save()" v-else-if="User.Me && Editing">
            <q-icon name="save" />
          </q-btn>

          <q-btn size="14px" dense flat title="Cancel Changes" @click="Cancel()" v-if="User.Me && Editing">
            <q-icon name="cancel" />
          </q-btn>
        </div>
      </div>
    </div>

    <div class="Tagline" v-if="!Editing">
      "{{ User.Profile.Tagline }}"
    </div>

    <input type="text" placeholder="Tagline" class="Tagline" v-model="User.Profile.Tagline" v-else-if="Editing" />

    <div class="Bio" v-if="!Editing">
      {{ User.Profile.Bio }}
    </div>

    <textarea placeholder="Bio" class="Bio" v-model="User.Profile.Bio" v-else-if="Editing"></textarea>
  </div>
</template>

<style scoped>
@keyframes FadeIn {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}
#UserProfile {
  width: 100%;
  padding: 20px;
  border-style: solid;
  border-width: 0 1px 0 0;
  border-color: rgba(200, 200, 200, 0.1);
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow: hidden;
}

#UserProfile .Avatar {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  border-style: solid;
  border-width: 4px;
  border-color: #323232;
  box-shadow: 0 0 10px 1px #222222;
  position: relative;
}

#UserProfile .Username {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-items: center;
}

#UserProfile .Username .Avatar .ImageContainer {
  height: 100%;
  width: 100%;
  border-radius: 50%;
  overflow: hidden;
}

#UserProfile .Username .Avatar .ImageContainer .ChangeAvatar {
  width: 100%;
  height: 100%;
  opacity: 0;
  display: none;
}

#UserProfile .Username .Avatar .ImageContainer:hover .ChangeAvatar {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background-color: rgba(0, 0, 0, 0.7);
  position: absolute;
  opacity: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  animation: FadeIn 0.3s forwards;
}

#UserProfile .Username .Avatar .ImageContainer .ChangeAvatar .Icon {
  width: 100%;
  height: 100%;
}

#UserProfile .Username .Avatar .ImageContainer img {
  width: 100%;
  height: 100%;
  display: block;
}

#UserProfile .Username .Avatar .StatusIndicator {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  position: absolute;
  bottom: -4px;
  right: -4px;
  border-style: solid;
  border-width: 4px;
  border-color: #323232;
}

#UserProfile .Username .Avatar .StatusIndicator.Online {
  background-color: rgb(2, 114, 2);
}

#UserProfile .Username .Avatar .StatusIndicator.Offline {
  background-color: rgb(95, 0, 0);
}

#UserProfile .Username .UsernameStatus {
  display: flex;
  flex-direction: column;
}

#UserProfile .Username .UsernameStatus .UsernameText {
  margin: 0;
  padding: 0;
  font-size: 1.4em;
  letter-spacing: 2px;
  line-height: 1;
}

#UserProfile .Username .UsernameStatus .OnlineText {
  font-size: 0.7em;
  color: rgb(2, 114, 2);
  text-shadow: 0 0 2px black;
  letter-spacing: 0;
}

#UserProfile .Username .UsernameStatus .OfflineText {
  font-size: 0.7em;
  color: rgb(95, 0, 0);
  text-shadow: 0 0 2px black;
  letter-spacing: 0;
}

#UserProfile .Username .UsernameStatus .Actions {
  display: flex;
  padding: 2px 0 0 0;
  gap: 2px;
  animation: FadeIn 0.3s forwards;
}

#UserProfile .Tagline {
  color: rgb(150, 150, 150);
  text-transform: uppercase;
  letter-spacing: 4px;
  font-weight: 500;
  text-shadow: 1px 1px black;
}

#UserProfile input.Tagline {
  padding: 10px;
  background-color: rgba(0, 0, 0, 0.4);
  outline: none;
  border: none;
  border-radius: 10px;
  animation: FadeIn 0.3s forwards;
}

#UserProfile .Bio {
  white-space: pre-wrap;
  overflow-x: hidden;
  overflow-y: auto;
  letter-spacing: 2px;
  word-spacing: 4px;
  font-size: 0.8em;
  animation: FadeIn 0.3s forwards;
}

#UserProfile textarea.Bio {
  padding: 10px;
  flex-grow: 1;
  background-color: rgba(0, 0, 0, 0.4);
  outline: none;
  border: none;
  border-radius: 10px;
  color: rgb(240, 240, 240);
}
</style>
