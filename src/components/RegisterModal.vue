<script setup lang="ts">
import { ref } from 'vue';
import { api } from 'src/boot/axios';

const emit = defineEmits(['close']);

const Loading = ref(true);
const Success = ref(false);

const Username = ref({
  Name: '',
  ErrorState: false
});

const Email = ref({
  Name: '',
  ErrorState: false
});

const ErrorState = ref(false);
const FirstAttempt = ref(true);
const ErrorMessage = ref('');
const Server = ref(undefined);

api.get('/server/status').then(response => {
  if(response.status == 200)
  {

    Server.value = response.data;
    Loading.value = false;
  }
  else if(response.status == 401)
  {
    localStorage.removeItem('AuthToken');
    window.location.reload();
  }
});

function CheckInputs() {
  if(!FirstAttempt.value)
  {
    if(Username.value.Name == '')
    {
      Username.value.ErrorState = true;
    }
    else
    {
      Username.value.ErrorState = false;
    }

    if(Email.value.Name == '')
    {
      Email.value.ErrorState = true;
    }
    else
    {
      Email.value.ErrorState = false;
    }

    if(Username.value.ErrorState || Email.value.ErrorState)
    {
      ErrorState.value = true;
    }
    else
    {
      ErrorState.value = false;
    }
  }
}

function Submit()
{
  Loading.value = true;

  if(FirstAttempt.value)
  {
    FirstAttempt.value = false;
  }

  if(Username.value.Name == '' || Email.value.Name == '')
  {
    ErrorState.value = true;
  }

  if(!ErrorState.value)
  {
    const Data = {
      Username: Username.value.Name,
      Email: Email.value.Name
    };

    api.post('/user/actions/register', Data).then(response => {
      if(response.status == 401)
      {
        localStorage.removeItem('AuthToken');
        window.location.reload();
      }

      if(response.data[0] == 'OK')
      {
        Success.value = true;
        ErrorState.value = false
        ErrorMessage.value = '';
        Loading.value = false;
      }
      else if(response.data[0] == 'Email')
      {
        Success.value = false;
        Loading.value = false;
        ErrorState.value = true;
        Email.value.ErrorState = true;
        ErrorMessage.value = response.data[0];
      }
      else if(response.data[0] == 'Username')
      {
        Success.value = false;
        Loading.value = false;
        ErrorState.value = true;
        Username.value.ErrorState = true;
        ErrorMessage.value = response.data[0];
      }
    }).catch(error => {
      console.log(error);
      Loading.value = false;
    });
  }
}
</script>

<template>
  <div id="Overlay" @click.self="emit('close')">
    <div id="RegisterModal">
      <q-bar id="TitleBar">
        <div id="Title">
          Register Account
        </div>
        <q-space />
        <q-btn dense flat icon="close" @click="emit('close')" />
      </q-bar>

      <p v-if="Server.SkipEmailActivation != 1">
        An email will be sent to the provided e-mail address.
      </p>
      <p v-if="Server.SkipEmailActivation != 1">
        You will be prompted to set a password after following the activation instructions.
      </p>

      <p v-if="Server.SkipEmailActivation == 1">
        This server requires manual activation.
      </p>

      <p v-if="Server.SkipEmailActivation == 1">
        You will be able to log in once an admin has enabled your account.
      </p>

      <ul id="AccountInfo">
        <li class="Entry">
          <input type="text" name="Username" placeholder="Username" v-model="Username.Name" :class="Username.ErrorState ? 'Error' : 'OK'" @change="CheckInputs()" @keyup.enter="Submit()" autofocus />
        </li>

        <li class="Entry">
          <input type="text" name="Email" placeholder="Email Address" v-model="Email.Name" :class="Email.ErrorState ? 'Error' : 'OK'" @change="CheckInputs()" @keyup.enter="Submit()" />
        </li>
      </ul>

      <q-btn label="Submit" icon="send" dense color="black" padding="10px" @click="Submit()" v-if="!ErrorState && !Loading && !Success" />
      <q-btn label="Submit" icon="send" dense color="black" padding="10px" @click="Submit()" loading v-else-if="!ErrorState && Loading" />
      <q-btn label="Account registered - Check your email" icon="checkmark" dense color="green" padding="10px" disabled v-else-if="!ErrorState && Success && Server.SkipEmailActivation != 1" />
      <q-btn label="Account registered" icon="checkmark" dense color="green" padding="10px" disabled v-else-if="!ErrorState && Success && Server.SkipEmailActivation == 1" />
      <q-btn label="Submit" icon="error" dense color="red" disable padding="10px" v-else />
    </div>
  </div>
</template>

<style lang="css" scoped>
@keyframes FadeIn {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

#Overlay {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 40px;
  left: 0;
  z-index: 2;
  overflow: hidden;
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: FadeIn forwards 0.3s;
}

#RegisterModal {
  width: 450px;
  display: flex;
  flex-direction: column;
  background-color: rgb(20, 20, 20);
  border-radius: 5px;
  border-style: solid;
  border-width: 1px;
  border-color: rgba(255, 255, 255, 0.1);
}

#RegisterModal #TitleBar {
  height: 40px;
  border-style: solid;
  border-width: 0 0 1px 0;
  border-color: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
}

#RegisterModal #TitleBar #Title {
  padding: 0 0 0 8px;
  font-weight: bold;
}

#RegisterModal p {
  margin: 0;
  padding: 20px 20px 0 20px;
}

#RegisterModal #AccountInfo {
  margin: 0;
  padding: 20px 20px 30px 20px;
  display: flex;
  flex-direction: column;
  list-style-type: none;
  gap: 20px;
}

#RegisterModal #AccountInfo .Entry {
  display: flex;
  gap: 50px;
  align-items: center;
}

#RegisterModal #AccountInfo .Entry input {
  min-width: 350px;
  padding: 15px;
  outline: none;
  border: none;
  border-radius: 10px;
  background-color: rgba(0, 0, 0, 0.5);
  color: rgb(220,220,220);
}

#RegisterModal #AccountInfo .Entry .Error {
  border-style: solid;
  border-width: 1px;
  border-color: rgba(255, 0, 0, 0.8);
}

#RegisterModal #AccountInfo .Entry .OK {
  outline: red;
}
</style>
