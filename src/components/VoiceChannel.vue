<script setup>
import { ref, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from 'src/boot/axios';

const Users = ref([]);
const Route = useRoute();
const Router = useRouter();
const ChannelID = ref(Route.params.channelid);
const Loading = ref(true);
const emit = defineEmits(['startvideostream', 'stopvideostream', 'banuser'])
let RefreshTimer = undefined;

const props = defineProps({
  Me: Object
});

api.get('/channel/'+ChannelID.value).then(async(response) => {
  if(response.status == 200)
  {
    Users.value = response.data[0].ConnectedUsers;

    for(const User of Users.value)
    {
      if(!User.ProfileImage)
      {
        const ProfileImage = await api.get('/image/'+User.Username, { responseType: 'blob' });
        User.ProfileImage = URL.createObjectURL(ProfileImage.data);
      }
    }

    Loading.value = false;
  }
  else if(response.status == 401)
  {
    localStorage.removeItem('AuthToken');
    window.location.reload();
  }
})

async function RefreshUsers()
{
  const response = await api.get('/channel/'+ChannelID.value);
  const Channel = response.data[0];

  if(response.status == 200)
  {
    Users.value = Users.value.filter(u => Channel.ConnectedUsers.some(remote => remote.Username == u.Username));

    for(const RemoteUser of response.data[0].ConnectedUsers)
    {
      const Exists = Users.value.find(u => u.Username === RemoteUser.Username);

      if(!Exists)
      {
        const ProfileImage = await api.get('/image/'+RemoteUser.Username, { responseType: 'blob' });
        RemoteUser.ProfileImage = URL.createObjectURL(ProfileImage.data);
        Users.value.push(RemoteUser);
      }
      else
      {
        Exists.IsSpeaking = RemoteUser.IsSpeaking;
        Exists.IsScreenSharing = RemoteUser.IsScreenSharing
      }
    }
  }
  else if(response.status == 401)
  {
    localStorage.removeItem('AuthToken');
    window.location.reload();
  }
}

function GoToScreenShare(User)
{
  if(User.IsScreenSharing)
  {
    Router.push('/video/'+User.Username);
  }
}

RefreshTimer = setInterval(RefreshUsers, 200);

onUnmounted(() =>
{
  clearInterval(RefreshTimer);
});

</script>

<template>
  <div id="VoiceChannel">
    <div id="UserContainer">
      <div :class="'User' + (User.IsSpeaking == 1 ? ' Speaking' : ' NotSpeaking')" v-for="User in Users" :key="User.Username" @click="GoToScreenShare(User)">
        <q-menu :auto-close="true" compact context-menu dark style="box-shadow: 0 0 25px 5px rgba(10, 10, 10, 0.8);">
          <q-item clickable :to="'/user/'+User.Username">View Profile</q-item>
          <q-item clickable :to="'/dm/'+User.Username">Direct Message</q-item>
          <q-item v-if="!User.IsScreenSharing && User.Me" @click="emit('startvideostream')" clickable>Share Screen</q-item>
          <q-item v-else-if="User.IsScreenSharing && User.Me" @click="emit('stopvideostream')" clickable>Stop Sharing Screen</q-item>
          <q-separator dark v-if="props.Me.CanBanUsers" />
          <q-item clickable dark v-if="props.Me.CanBanUsers" @click="emit('banuser', User)">Ban User</q-item>
        </q-menu>

        <div class="UserDetails">
          <div class="Avatar">
            <img :src="User.ProfileImage" />
          </div>

          <div class="Username" ref="TextContainer" :style="'color: '+User.Colour+';'">
            <span>{{ User.Username }}</span>
          </div>
        </div>

        <div class="StreamingIcon" v-if="User.IsScreenSharing">
          <div class="StreamingText">
            STREAMING NOW
          </div>

          <q-icon name="live_tv" size="12px"></q-icon>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="css" scoped>
@keyframes Highlight {
  0% {
    box-shadow: 0 0 20px 1px rgba(0, 0, 0, 0.1);
  }
  100% {
    box-shadow: 0 0 20px 1px rgba(0, 0, 0, 0.5);
  }
}

@keyframes Scroll {
    0% {
      transform: translateX(0);
    }
    100%
    {
      transform: translateX(-100%);
    }
}
#VoiceChannel {
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

#VoiceChannel #UserContainer {
  padding: 20px;
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}

#VoiceChannel #UserContainer .User {
  width: 160px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  border-radius: 20px;
  background-color: rgb(40, 40, 40);
  box-shadow: 0 0 20px 1px rgba(0, 0, 0, 0.1);
}

#VoiceChannel #UserContainer .User:hover {
  cursor: pointer;
  box-shadow: 0 0 20px 1px rgba(0, 0, 0, 0.3);
  animation: Highlight 0.2s forwards;
}

#VoiceChannel #UserContainer .User .UserDetails {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

#VoiceChannel #UserContainer .User .UserDetails .Username {
  width: 100%;
  font-size: 1.2em;
  letter-spacing: 5px;
  font-weight: bold;
  text-shadow: 0 0 2px black;
  overflow: hidden;
  white-space: nowrap;
  text-align: center;
}

#VoiceChannel #UserContainer .User .UserDetails .Username span {
  display: inline-block;
}

#VoiceChannel #UserContainer .User .UserDetails .Username:hover span {
 animation: Scroll 4s linear infinite;
}

#VoiceChannel #UserContainer .User.Speaking .UserDetails .Avatar {
  box-shadow: 0 0 20px rgba(100, 100, 100, 0.8);
}

#VoiceChannel #UserContainer .User .UserDetails .Avatar {
  width: 128px;
  height: 128px;
  border-radius: 50%;
  border-style: solid;
  border-width: 5px;
  border-color: #323232;
  flex-shrink: 0;
}

#VoiceChannel #UserContainer .User .UserDetails .Avatar img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  display: block;
}

#VoiceChannel #UserContainer .User .StreamingIcon {
  display: flex;
  gap: 4px;
}

#VoiceChannel #UserContainer .User .StreamingIcon .StreamingText {
  font-size: 0.6em;
  letter-spacing: 1px;
  text-shadow: 0 0 2px black;
}
</style>
