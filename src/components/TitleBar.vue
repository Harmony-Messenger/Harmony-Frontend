<script setup lang="ts">
import { QBar } from 'quasar';
import { onMounted, ref } from 'vue';
import { api } from 'src/boot/axios';

const Mode = process.env.MODE;
const Me = ref(undefined);
const Loading = ref(true);

const emit = defineEmits(['resetpassword', 'manageprivatekeys']);

function ToggleMaximise() {
    if (process.env.MODE === 'electron') {
      //window.myWindowAPI.ToggleMaximise()
    }
}

function Minimise() {
  if (process.env.MODE === 'electron') {
    //window.myWindowAPI.Minimise()
  }
}

function Close() {
  if (process.env.MODE === 'electron') {
    //window.myWindowAPI.Close()
  }
}

function Logout()
{
  localStorage.removeItem('AuthToken');
  window.location.reload();
}

onMounted(async () => {
  const response = await api.get('/me');

  if(response.status == 401)
  {
    localStorage.removeItem('AuthToken');
    window.location.reload();
  }

  Me.value = response.data[0];

  const ProfileImage = await api.get('/image/'+Me.value.Username, { responseType: 'blob' });

  if(ProfileImage.status == 401)
  {
    localStorage.removeItem('AuthToken');
    window.location.reload();
  }

  Me.value.ProfileImage = URL.createObjectURL(ProfileImage.data);
  Loading.value = false;
});
</script>

<template>
  <QBar id="TitleBar" class="q-electron-drag" color="black" v-if="!Loading">
    <img :src="Me.ProfileImage" class="ProfileImage" />
    <q-menu dark style="box-shadow: 0 0 25px 5px rgba(10, 10, 10, 0.8);" class="Menu" :auto-close="true">
      <q-item dark dense clickable class="MenuItem" @click="emit('resetpassword', Me)"><q-icon name="lock_reset" size="24px" />Reset Password</q-item>
      <q-item dark dense clickable class="MenuItem" @click="emit('manageprivatekeys')"><q-icon name="sync_lock" size="24px" />Manage private keys</q-item>
      <q-item dark dense clickable class="MenuItem" @click="Logout()"><q-icon name="logout" size="24px" />Logout</q-item>
    </q-menu>
    <q-space />
    Harmony
    <q-space />
    <q-btn dense flat icon="minimize" @click="Minimise()" v-if="Mode == 'electron'" />
    <q-btn dense flat icon="crop_square" @click="ToggleMaximise()" v-if="Mode == 'electron'" />
    <q-btn dense flat icon="close" @click="Close()" v-if="Mode == 'electron'" />
  </QBar>
</template>

<style scoped>
#TitleBar {
  height: 40px;
  padding: 20px 10px;
  border-style: solid;
  border-width: 0 0 1px 0;
  border-color: rgba(255, 255, 255, 0.1);
}

#TitleBar .ProfileImage {
  height: 32px;
  width: 32px;
  border-radius: 50%;
  border-style: solid;
  border-width: 2px;
  border-color: #323232;
  box-shadow: 0 0 5px 2px rgba(0, 0, 0, 0.2);
  position: relative;
  flex-shrink: 0;
  cursor: pointer;
}

.MenuItem {
  padding: 10px;
  display: flex;
  align-items: center;
  gap: 5px;
}
</style>
