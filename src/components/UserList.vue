<script setup>
import { onUnmounted, onMounted, ref } from 'vue';
import { api } from 'src/boot/axios';
import { useRouter } from 'vue-router';
import NewMessageSound from './../assets/audio/new-message.wav';

const Loading = ref(true);
const UserList = ref([]);
const SelectedUser = ref();
const WindowWidth = ref(window.innerWidth);
const Router = useRouter();
const IsExpanded = ref(false);
const NewMessageAudio = new Audio(NewMessageSound);

const props = defineProps({
  Me: Object
});

const emit = defineEmits(['banuser', 'unbanuser', 'activateuser', 'resetpassword', 'configureroles', 'changeuserrole', 'deleteuser'])

async function RefreshUsers()
{
  const response = await api.get('/user');
  const RemoteUsers = response.data.map(u => u.Username);

  UserList.value.sort((a, b) => b.Notifications - a. Notifications);
  UserList.value = UserList.value.filter(c => RemoteUsers.includes(c.Username));

  for(const RemoteUser of response.data)
  {
    const Exists = UserList.value.find(u => u.Username == RemoteUser.Username);

    if(!Exists)
    {
      UserList.value.push(RemoteUser);
    }
    else
    {
      Exists.IsBanned = RemoteUser.IsBanned;
      Exists.IsPendingActivation = RemoteUser.IsPendingActivation;
      Exists.AccessLevelColour = RemoteUser.AccessLevelColour;
      Exists.AccessLevelName = RemoteUser.AccessLevelName;
      Exists.AccessLevelID = RemoteUser.AccessLevelID;

      if(Exists.Notifications != RemoteUser.Notifications && RemoteUser.Notifications != 0)
      {
        NewMessageAudio.play();
      }

      Exists.Notifications = RemoteUser.Notifications;
    }
  }

  for(const User of UserList.value)
  {
    if(!User.ProfilePhoto)
    {
      const response = await api.get('/image/'+User.Username, { responseType: 'blob' });

      User.ProfilePhoto = URL.createObjectURL(response.data);
    }
  }

  Loading.value = false;
}

const RefreshTimer = setInterval(RefreshUsers, 1000);

function DM(User)
{
  Router.push('/dm/'+User.Username);
}



RefreshUsers();

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
  <div :id="WindowWidth > 960 ? 'UserList' : 'UserListCompact'" :class="IsExpanded ? 'Expanded' : 'NotExpanded'" v-if="!Loading">
    <div class="Header" v-if="WindowWidth > 960">
      <h2>Users</h2>

      <q-btn dark dense v-if="Me.CanModifyAccess">
        <q-icon name="settings" title="Configure Roles" @click="emit('configureroles')" />
      </q-btn>
    </div>

    <div id="UserListWrapper">
      <div id="Expander" v-if="WindowWidth < 960" @click="IsExpanded = !IsExpanded">
        Users
      </div>

      <ul v-if="(WindowWidth < 960 && IsExpanded) || WindowWidth > 960">
        <li :class="'User '+(SelectedUser == User ? 'Selected': '')+(User.IsBanned ? ' Banned': '')" v-for="User in UserList" :key="User.ID" @auxclick="SelectedUser = User" @click.prevent="DM(User); IsExpanded = false;">
          <q-menu target :auto-close="true" context-menu dark @before-hide="SelectedUser = null" style="box-shadow: 0 0 25px 5px rgba(10, 10, 10, 0.8);" clas="ContextMenu">
            <q-item clickable :to="'/user/'+User.Username">View Profile</q-item>
            <q-item clickable :to="'/dm/'+User.Username">Direct Message</q-item>
            <q-separator dark v-if="props.Me.CanBanUsers" />
            <q-item clickable dark v-if="props.Me.CanBanUsers" @click="emit('resetpassword', User)">Reset password</q-item>
            <q-item clickable dark v-if="props.Me.CanBanUsers && User.IsPendingActivation" @click="emit('activateuser', User)">Manually activate user</q-item>
            <q-item clickable dark v-if="props.Me.CanBanUsers && !User.IsBanned" @click="emit('banuser', User)">Ban User</q-item>
            <q-item clickable dark v-if="props.Me.CanBanUsers && User.IsBanned" @click="emit('unbanuser', User)">Unban User</q-item>
            <q-item clickable dark v-if="props.Me.CanDeleteUsers" @click="emit('deleteuser', User)" style="background-color: rgb(140, 0, 0);">Delete User</q-item>
            <q-item clickable dark v-if="props.Me.CanModifyAccess" @click="emit('changeuserrole', User)">Change Role</q-item>
          </q-menu>
          <div class="Avatar">
            <div class="ImageContainer">
              <img :src="User.ProfilePhoto" v-if="!User.Avatar"/>
            </div>
            <span :class="'StatusIndicator'+(User.IsOnline == 1 ? ' Online' : ' Offline')">
              &nbsp;
            </span>
          </div>
          <div class="Username" :style="'color: '+User.AccessLevelColour">
            {{ User.Username }}
          </div>

          <div class="Notifications" v-if="User.Notifications > 0">
            {{ User.Notifications }}
          </div>
        </li>
      </ul>
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

.q-menu {
  box-shadow: 0 0 5px rgba(50, 50, 50, 0.5);
}

#UserList {
  max-width: 50%;
  width: 350px;
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  overflow: auto;
}

#UserListCompact {
  width: 40px;
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  overflow: auto;
  background-color: rgb(20, 20, 20);
  position: absolute;
  right: 0;
}

#UserListCompact #UserListWrapper {
  display: flex;
}

#UserListCompact.Expanded {
  width: 50vw;
  animation: 0.5s SlideOut forwards;
}

#UserListCompact.NotExpanded {
  animation: 0.5s SlideIn forwards;
}

#UserListCompact.Expanded #Expander {
  width: 40px;
  position: relative;
}

#UserListCompact #Expander {
  height: 100%;
  width: 100%;
  text-align: center;
  background-color: rgb(40, 40, 40);
  border-style: solid;
  border-width: 0 0 0 1px;
  border-color: rgba(200, 200, 200, 0.1);
  writing-mode: sideways-lr;
}

#UserListCompact.Expanded #Expander {
  animation: 0.5s Shrink forwards;
}

#UserListCompact.NotExpanded #Expander {
  animation: 0.5s Grow forwards;
}


#UserListCompact #Expander:hover {
  cursor: pointer;
}

.Header {
  padding: 10px 10px 10px 0;
  border-style: solid;
  border-width: 0 0 1px 0;
  border-color: rgba(200, 200, 200, 0.1);
  display: flex;
  align-items: center;
}

.Header h2 {
  margin: 0;
  padding: 0 0 0 10px;
  font-size: 0.9em;
  line-height: 2rem;
  letter-spacing: 4px;
  word-spacing: 4px;
  font-weight: bold;
  text-shadow: 0 0 4px rgba(0, 0, 0, 0.2);
  color: rgba(255, 255, 255, 0.8);
  flex-grow: 1;
}

ul {
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  list-style-type: none;
  overflow-x: hidden;
  overflow-y: auto;
  flex-grow: 1;
}

ul .User {
  padding: 10px 10px;
  display: flex;
  cursor: pointer;
  gap: 10px;
  align-items: center;
  overflow: hidden;
}

ul .User:hover {
  animation: 0.2s FadeHighlight forwards;
}

ul .Selected {
  animation: 0.2s FadeHighlight forwards;
}

ul .User .Avatar {
  height: 32px;
  width: 32px;
  border-radius: 50%;
  border-style: solid;
  border-width: 2px;
  border-color: #323232;
  box-shadow: 0 0 5px 2px rgba(0, 0, 0, 0.2);
  position: relative;
  flex-shrink: 0;
}

ul .User.Banned .Username {
  color: rgba(150, 150, 150, 0.5)!important;
  text-decoration: line-through;
}

ul .User .Avatar .ImageContainer {
  height: 100%;
  width: 100%;
  border-radius: 50%;
  overflow: hidden;
}

ul .User .Avatar .ImageContainer img {
  width: 100%;
  height: 100%;
  display: block;
}

ul .User .Avatar .StatusIndicator {
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

ul .User .StatusIndicator.Online {
  background-color: rgb(2, 114, 2);
}

ul .User .StatusIndicator.Offline {
  background-color: rgb(95, 0, 0);
}

ul .User .Username {
  flex-grow: 1;
  text-shadow: 0 0 5px rgba(0, 0, 0, 0.8);
}

ul .User .Notifications {
  border-radius: 50%;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8em;
  animation: FadeIn forwards 0.3s;
}
</style>
