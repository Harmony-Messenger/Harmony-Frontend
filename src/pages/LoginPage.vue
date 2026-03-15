<script setup lang="ts">
import RegisterModal from 'src/components/RegisterModal.vue';
import { ref } from 'vue';
import { api } from 'src/boot/axios';

const DisplayRegisterModal = ref(false);
const Mode = process.env.MODE;

const Username = ref('');
const Password = ref('');

const ErrorState = ref('');
const ErrorMessage = ref('');



function Submit()
{

  const Data = {
    Username: Username.value,
    Password: Password.value
  }

  api.post('/user/actions/login', Data).then(response => {
    if(response.data != undefined)
    {
      if(response.data.Status == 'Banned')
      {
        ErrorState.value = 'Banned';
        ErrorMessage.value = 'You have been banned until '+response.data.End+' for the following reason: '+response.data.Reason;
      }
      else if(response.data.Status == 'OK')
      {
        if(Mode == 'electron')
        {
          console.log("blah");
        }
        else
        {
          localStorage.setItem('AuthToken', response.data.AuthToken);
          window.location.reload();
        }
      }
    }

  }).catch(response => {
    console.log(response);
  });
}

</script>

<template>
  <div id="Banned" v-if="ErrorState == 'Banned'">
    {{ ErrorMessage }}
  </div>

  <div id="LoginPage" v-else>
    <RegisterModal v-if="DisplayRegisterModal" @close="DisplayRegisterModal = false"></RegisterModal>

    <div id="Inputs">
      <h2>Login</h2>
      <input type="text" placeholder="Username" name="Username" v-model="Username" @keyup.enter="Submit()" autofocus />
      <input type="password" placeholder="Password" name="Password" v-model="Password" @keyup.enter="Submit()" />
      <input type="text" placeholder="Server Address" name="Server" v-if="Mode == 'electron'" />
    </div>

    <p id="Register">No account? <a href="#" @click="DisplayRegisterModal = true">Register here</a></p>
    <q-btn icon-right="send" dense color="black" label="Login" padding="10px" id="LoginButton" @click="Submit()"></q-btn>
  </div>
</template>

<style lang="css" scoped>
@keyframes Hover {
  0% {
    opacity: 0.6;
  }
  100% {
    opacity: 1;
  }
}

#Banned {
  align-items: center;
  width: 450px;
  height: 500px;
  padding: 20px 0 0 0;
  display: flex;
  flex-direction: column;
}

#LoginPage {
  margin: 0 auto;
  width: 450px;
  height: 500px;
  padding: 20px 0 0 0;
  display: flex;
  flex-direction: column;
}

#LoginPage #Inputs {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

#LoginPage #Inputs h2 {
  margin: 0;
  padding: 0;
  line-height: 1.2;
  font-size: 2em;
  letter-spacing: 2px;
}

#LoginPage #Inputs input {
  width: 100%;
  padding: 10px;
  border-radius: 5px;
  resize: none;
  outline: none;
  background-color: rgba(0, 0, 0, 0.4);
  color: rgb(255, 255, 255);
  align-content: center;
  font-size: 0.8em;
  border: none;
}

#LoginPage #Register {
  font-size: 0.9em;
  text-align: right;
  padding: 4px 0 0 0;
  text-shadow: 0 1px black;
}

#LoginPage #Register a {
  color: rgb(0, 117, 212);
  text-decoration: none;
  opacity: 0.6;
}

#LoginPage #Register a:hover {
  animation: Hover 0.3s forwards;
}

</style>
