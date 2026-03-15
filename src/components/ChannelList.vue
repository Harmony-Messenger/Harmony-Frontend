<script setup>
import { ref, onUnmounted, onMounted, defineEmits } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import VoiceJoinedSound from './../assets/audio/voice-join.wav';
import VoiceLeftSound from './../assets/audio/voice-leave.wav';
import NewMessageSound from './../assets/audio/new-message.wav';
import { api } from 'src/boot/axios';

const Loading = ref(true);
const Route = useRoute();
const Router = useRouter();
const ChannelID = ref(Route.params.channelid);
const TextChannels = ref([]);
const VoiceChannels = ref([]);
const Error = ref('');
const SelectedUser = ref();
const VoiceJoinedAudio = new Audio(VoiceJoinedSound);
const VoiceLeftAudio = new Audio(VoiceLeftSound);
const NewMessageAudio = new Audio(NewMessageSound);
const Muted = ref(false);
const WindowWidth = ref(window.innerWidth);
const IsExpanded = ref(false);

const props = defineProps({
  Me: Object
});

const emit = defineEmits(['disconnect', 'mute', 'unmute', 'startscreenshare', 'stopscreenshare', 'editchannel', 'deletechannel', 'createchannel', 'banuser']);

api.get('/channel').then(response => {
  if(response.status == 200)
  {
    response.data.forEach(element => {
      if(element.Type == 'T')
      {
        if(element.ID == ChannelID.value)
        {
          element.Active = true;
        }
        else
        {
          element.Active = false;
        }

        TextChannels.value.push(element);
      }
      else if(element.Type == 'V')
      {
        if(element.ID == ChannelID.value)
        {
          element.Active = true;
        }
        else
        {
          element.Active = false;
        }

        VoiceChannels.value.push(element);
      }
    });

    Loading.value = false;
  }
  else
  {
    if(response.status == 401)
    {
      localStorage.removeItem('AuthToken');
      window.location.reload();
    }
    else
    {
      Error.value = 'Error getting channel data';
      Loading.value = false;
    }
  }
})

function RefreshChannels()
{
  api.get('/channel').then(response => {
  if(response.status == 200)
  {
    const RemoteIDs = response.data.map(c => c.ID);

    VoiceChannels.value = VoiceChannels.value.filter(c => RemoteIDs.includes(c.ID));
    TextChannels.value = TextChannels.value.filter(c => RemoteIDs.includes(c.ID));

    for(const RemoteChannel of response.data)
    {
      const Target = RemoteChannel.Type == 'V' ? VoiceChannels.value : TextChannels.value;

      const Existing = Target.find(c => c.ID === RemoteChannel.ID);

      if(Existing)
      {
        if(Existing.Notifications != RemoteChannel.Notifications)
        {
          if(RemoteChannel.Notifications > 0)
          {
            NewMessageAudio.play();
          }

          Existing.Notifications = RemoteChannel.Notifications;
        }

        if(Existing.Type == 'V')
        {
          const RemoteUsernames = RemoteChannel.ConnectedUsers.map(u => u.Username);
          let InitialLength = Existing.ConnectedUsers.length;

          Existing.ConnectedUsers = Existing.ConnectedUsers.filter(u => RemoteUsernames.includes(u.Username));
          const Me = Existing.ConnectedUsers.find(u => u.Me === true);

          if(InitialLength > Existing.ConnectedUsers.length && Me)
          {
            VoiceLeftAudio.play();
          }

          for(const RemoteUser of RemoteChannel.ConnectedUsers)
          {
            const ExistingUser = Existing.ConnectedUsers.find(u => u.Username == RemoteUser.Username);

            if(ExistingUser)
            {
              Object.assign(ExistingUser, RemoteUser);
            }
            else
            {
              Existing.ConnectedUsers.push(RemoteUser);
              if(Me)
              {
                VoiceJoinedAudio.play();
              }
            }
          }
        }
      }
      else
      {
        Target.push(RemoteChannel);
      }
    }

    Loading.value = false;
  }
  else
  {
    if(response.status == 401)
    {
      localStorage.removeItem('AuthToken');
      window.location.reload();
    }
    Error.value = 'Error getting channel data';
    Loading.value = false;
  }
});
}
function RedirectUserClick(User)
{
  if(User.IsScreenSharing == 1)
  {
    Router.push('/video/'+User.Username);
  }
}

function Mute()
{
  Muted.value = true;
  emit('mute');
}

function Unmute()
{
  Muted.value = false;
  emit('unmute');
}

function Disconnect()
{
  emit('disconnect');
  emit('stopscreenshare');
}

const RefreshTimer = setInterval(RefreshChannels, 400);

onMounted(() => {
  window.addEventListener('resize', () => {
    WindowWidth.value = window.innerWidth;
  })
});

onUnmounted(() =>
{
  clearInterval(RefreshTimer);
});

</script>

<template>
  <div :id="WindowWidth > 960 ? 'Channels' : 'ChannelsCompact'" :class="IsExpanded ? 'Expanded' :'NotExpanded' " v-if="!Loading">
    <div id="ChannelsWrapper">
      <div id="TextChannels" v-if="(WindowWidth < 960 && IsExpanded) || WindowWidth > 960">
        <div class="Header">
          <h2>Text Channels</h2>
          <q-btn flat dense icon="add" v-if="props.Me.CanModifyChannels" @click="emit('createchannel', 'Text')"></q-btn>
        </div>

        <ul class="ChannelList">
          <li v-for="Channel in TextChannels" :key="Channel.Name" :class="Channel.Active ? 'Channel Active' : 'Channel NotActive'">
            <q-menu target context-menu :auto-close="true" dark style="box-shadow: 0 0 25px 5px rgba(10, 10, 10, 0.8);" v-if="Channel.CanModify">
              <q-item clickable @click="emit('editchannel', Channel)" >Edit Channel</q-item>
              <q-item clickable class="DangerItem" @click="emit('deletechannel', Channel)">Delete Channel</q-item>
            </q-menu>

            <router-link :to="'/channel/'+Channel.ID" @click="IsExpanded = !IsExpanded">
              <q-icon class="Icon" name="tag" />

              <div class="ChannelName">
                {{ Channel.Name }}
              </div>

              <div class="Notifications" v-if="Channel.Notifications">
                {{ Channel.Notifications }}
              </div>
            </router-link>
          </li>
        </ul>
      </div>

      <div id="VoiceChannels" v-if="(WindowWidth < 960 && IsExpanded) || WindowWidth > 960">
        <div class="Header">
          <h2>Voice Channels</h2>
          <q-btn flat dense icon="add" v-if="props.Me.CanModifyChannels" @click="emit('createchannel', 'Voice')"></q-btn>
        </div>

        <ul class="ChannelList">
          <li v-for="Channel in VoiceChannels" :key="Channel.Name" :class="Channel.Active ? 'Channel Active' : 'Channel NotActive'">
            <q-menu target context-menu :auto-close="true" dark style="box-shadow: 0 0 25px 5px rgba(10, 10, 10, 0.8);" v-if="Channel.CanModify">
              <q-item clickable @click="emit('editchannel', Channel)" >Edit Channel</q-item>
              <q-item clickable class="DangerItem" @click="emit('deletechannel', Channel)">Delete Channel</q-item>
            </q-menu>

            <router-link :to="'/channel/'+Channel.ID">
              <q-icon name="graphic_eq" class="Icon" />

              <div class="ChannelName">
                {{ Channel.Name }}
              </div>
            </router-link>

            <ul class="ConnectedUsers">
              <li v-for="ConnectedUser in Channel.ConnectedUsers" :key="ConnectedUser" class="User" @click="RedirectUserClick(ConnectedUser)">
                <q-menu target context-menu :auto-close="true" dark style="box-shadow: 0 0 25px 5px rgba(10, 10, 10, 0.8);" @before-hide="SelectedUser = null">
                  <q-item clickable :to="'/user/'+ConnectedUser.Username">View Profile</q-item>
                  <q-item v-if="!ConnectedUser.Me" clickable :to="'/dm/'+ConnectedUser.Username">Direct Message</q-item>
                  <q-item v-if="ConnectedUser.Me && ConnectedUser.IsScreenSharing" clickable @click="emit('stopscreenshare')">Stop Sharing Screen</q-item>
                  <q-item v-if="ConnectedUser.Me && !ConnectedUser.IsScreenSharing" clickable @click="emit('startscreenshare')">Share Screen</q-item>
                  <q-separator v-if="props.Me.CanBanUsers" dark />
                  <q-item v-if="props.Me.CanBanUsers" clickable @click="emit('banuser')">Ban User</q-item>
                </q-menu>

                <q-icon name="volume_mute" v-if="ConnectedUser.IsSpeaking == 0"/>
                <q-icon name="volume_up" class="SpeakingIcon" v-else />

                <div :class="'Username'+ (ConnectedUser.IsSpeaking ? ' Speaking' : ' NotSpeaking')">
                  {{ ConnectedUser.Username }}
                </div>

                <div class="Options">
                  <div class="AllOptions">
                      <q-icon name="live_tv" size="20px" color="white" title="Currently sharing screen" v-if="ConnectedUser.IsScreenSharing == 1"></q-icon>
                  </div>

                  <div class="SelfOptions" v-if="ConnectedUser.Me">
                    <q-btn @click.stop="Mute()" dense flat v-if="!Muted">
                      <q-icon name="mic" color="white" size="20px" title="Mute"></q-icon>
                    </q-btn>

                    <q-btn @click.stop="Unmute()" dense flat v-else>
                      <q-icon name="mic_off" color="red" size="20px" title="Unmute"></q-icon>
                    </q-btn>

                    <q-btn @click.stop="Disconnect()" dense flat>
                      <q-icon name="call_end" color="red-6" size="20px" title="Disconnect"></q-icon>
                    </q-btn>
                  </div>
                </div>
              </li>
            </ul>
          </li>
        </ul>
      </div>
    </div>

    <div id="Expander" v-if="WindowWidth < 960" @click="IsExpanded = !IsExpanded">
      Channels
    </div>

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

@keyframes SlideOut {
  0% {
    width: 40px;
  }
  100% {
    width: 50vw;
  }
}

@keyframes SlideIn {
  0% {
    width: 50vw;
  }
  100% {
    width: 40px;
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


@media only screen and (min-width: 992px) {
  #Channels {
    display: flex;
  }

  #Channels #TextChannels {
    min-width: 250px;
  }
}

.DangerItem {
  background-color: rgb(80, 0, 0);
}

#ChannelsCompact {
  display: flex;
  flex-direction: row;
  flex-grow: 1;
  overflow: auto;
  background-color: rgb(20, 20, 20);
  position: absolute;
  z-index: 100;
}

#ChannelsCompact #ChannelsWrapper {
  display: flex;
  flex-direction: column;
  width: 100%;
}

#ChannelsCompact.Expanded {
  animation: 0.5s SlideOut forwards;
}

#ChannelsCompact.NotExpanded {
  animation: 0.5s SlideIn forwards;
}

#ChannelsCompact.NotExpanded #ChannelsWrapper {
  display: none;
}

#ChannelsCompact.Expanded #Expander {
  width: 40px;
  position: relative;
}

#ChannelsCompact #Expander {
  height: 100%;
  width: 100%;
  text-align: center;
  background-color: rgb(40, 40, 40);
  writing-mode: sideways-rl;
  border-style: solid;
  border-width: 0 1px 0 0;
  border-color: rgba(200, 200, 200, 0.1);
}

#ChannelsCompact #Expander:hover {
  cursor: pointer;
}

#Channels {
  width: 450px;
  display: flex;
  flex-direction: column;
  border-style: solid;
  border-width: 0 1px 0 0;
  border-color: rgba(200, 200, 200, 0.1);
}

#Channels #ChannelsWrapper {
  height: 100%;
  display: flex;
  flex-direction: column;
}

#ChannelsWrapper #TextChannels {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  overflow: auto;
  flex-basis: 50%;
  border-style: solid;
  border-width: 0 0 1px 0;
  border-color: rgba(200, 200, 200, 0.1);
}

#VoiceChannels {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  overflow: auto;
  flex-basis: 50%;
}

#TextChannels .Header,
#VoiceChannels .Header {
  padding: 10px 5px 10px 0;
  border-style: solid;
  border-width: 0 0 1px 0;
  border-color: rgba(200, 200, 200, 0.1);
  display: flex;
  align-items: center;
}

#TextChannels .Header h2,
#VoiceChannels .Header h2 {
  margin: 0;
  padding: 0 0 0 10px;
  font-size: 0.9em;
  text-shadow: 0 0 4px rgba(0, 0, 0, 0.2);
  font-weight: bold;
  letter-spacing: 4px;
  word-spacing: 4px;
  color: rgba(255, 255, 255, 0.8);
  line-height: 2rem;
  flex-grow: 1;
}

#TextChannels .ChannelList,
#VoiceChannels .ChannelList {
  margin: 0;
  padding: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  list-style-type: none;
  gap: 10px;
  text-shadow: 0 0 4px black;
  font-size: 0.8em;
  color: rgba(255, 255, 255, 0.6);
  letter-spacing: 2px;
  overflow: auto;
  flex-grow: 0;
}

#TextChannels .ChannelList .Channel .Notifications {
  border-radius: 50%;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8em;
  animation: FadeIn forwards 0.3s;
}

#VoiceChannels .ChannelList .Channel {
  display: flex;
  flex-direction: column;
}

#TextChannels .ChannelList .Channel .router-link-active,
#VoiceChannels .ChannelList .Channel .router-link-active {
  color: rgb(235, 235, 235);
}

#TextChannels .ChannelList .Channel a,
#VoiceChannels .ChannelList .Channel a {
  padding: 10px;
  display: flex;
  gap: 5px;
  align-items: center;
  text-decoration: none;
  color: rgb(255, 255, 255, 0.6);
}

#TextChannels .ChannelList .Channel a:hover,
#VoiceChannels .ChannelList .Channel a:hover {
  cursor: pointer;
  animation: 0.2s FadeHighlight forwards;
}

#TextChannels .ChannelList .Channel .ChannelName,
#VoiceChannels .ChannelList .Channel .ChannelName {
  flex-grow: 1;
}

#VoiceChannels .ChannelList .Channel .ConnectedUsers {
  margin: 0;
  padding: 0 0 0 10px;;
  list-style-type: none;
}

#VoiceChannels .ChannelList .Channel .ConnectedUsers .User {
  padding: 5px 10px 5px 10px;
  display: flex;
  align-items: center;
  gap: 10px;
}

#VoiceChannels .ChannelList .Channel .ConnectedUsers .User .Options {
  display: flex;
  flex-grow: 0;
  flex-shrink: 0;
}

#VoiceChannels .ChannelList .Channel .ConnectedUsers .User .SpeakingIcon {
  color: rgb(255, 255, 255);
  flex-shrink: 0;
}

#VoiceChannels .ChannelList .Channel .ConnectedUsers .User:hover {
  cursor: pointer;
  animation: 0.2s FadeHighlight forwards;
}

#VoiceChannels .ChannelList .Channel .ConnectedUsers .User .Username {
  overflow: hidden;
  flex-grow: 1;
}

#VoiceChannels .ChannelList .Channel .ConnectedUsers .User .Username.Speaking {
  color: rgb(255, 255, 255);
}
</style>
