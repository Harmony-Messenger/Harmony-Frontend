<script setup>
import { onUnmounted, onMounted, ref, watch } from 'vue';
import ChannelList from 'src/components/ChannelList.vue';
import TextChannel from 'src/components/TextChannel.vue';
import VoiceChannel from 'src/components/VoiceChannel.vue';
import UserProfile from 'src/components/UserProfile.vue';
import DirectMessage from 'src/components/DirectMessage.vue';
import ScreenShare from 'src/components/ScreenShare.vue';
import InfoPane from 'src/components/InfoPane.vue';
import LoginPage from './LoginPage.vue';
import UserList from 'src/components/UserList.vue';
import TitleBar from 'src/components/TitleBar.vue';
import { useRoute } from 'vue-router';
import RecorderProcessorURL from 'src/modules/RecorderProcessor.js?url';
import PlaybackProcessorURL from 'src/modules/PlaybackProcessor.js?url';
import { date } from 'quasar';
import { api } from 'src/boot/axios';

const AuthToken = ref('');
const SelectedServer = ref(0);
const SelectedChannel = ref({ Name: null, ID: null, Type: null });
const Channels = ref([]);
const Loading = ref(true);
const Mode = process.env.MODE;
const Route = useRoute();
const ChannelID = ref(Route.params.channelid);
const ScreenShareSession = ref(undefined);
const IsScreenSharing = ref(false);
const Me = ref(undefined);
const PendingChannelDelete = ref(false);
const PendingChannelCreate = ref(false);
const PendingChannelEdit = ref(false);
const PendingBanUser = ref(false);
const PendingResetPassword = ref(false);
const PendingConfigureRoles = ref(false);
const PendingUserRole = ref(false);
const PendingDeleteUser = ref(false);
const PendingRekeyConversation = ref(false);
const PendingKeyManagement = ref(false);
let AudioInputStream = undefined;
let AudioInputBuffer = [];
let PlaybackCtx = undefined;
let RecordingCtx = undefined;
let RefreshTimer = undefined;
let RefreshConnectedChannelTimer = undefined;
let AudioRecorder = undefined;
let Audio = undefined;
let ConnectedChannel = undefined;
let AudioFilter = undefined;
let LastProcessedID = 0;
let SilenceGracePeriod = 0;
let VideoElement = undefined;
let ScreenShareRecorder = undefined;

watch(Route, async () => {
  if(!Route.params.username)
  {
    ChannelID.value = Route.params.channelid;

    Loading.value = true;

    for(const Channel of Channels.value)
    {
      if(Channel.ID == ChannelID.value)
      {
        SelectedChannel.value = Channel;
      }
    }

    if(SelectedChannel.value.Type == 'V')
    {
      if(ConnectedChannel != undefined)
      {
        if(SelectedChannel.value != ConnectedChannel)
        {
          await DisconnectVoice();
        }
      }

      JoinVoiceChannel();
    }
  }

  Loading.value = false;
});

if(Mode == 'electron')
{
  const Servers = JSON.parse(localStorage.getItem('Servers') || '[]');
  //const DisplayAddServerModal = ref(false);

  if(Servers.length > 0)
  {
    Servers.forEach(element => {
      if(element.ID == SelectedServer.value)
      {
        AuthToken.value = element.Token;
      }
    });
  }
}
else
{
  if(localStorage.getItem('AuthToken'))
  {
    AuthToken.value = localStorage.getItem('AuthToken') || '';
  }
}

async function StartScreenShare() {
  if(!ScreenShareSession.value)
  {
    ScreenShareSession.value = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 60, width: { max: 1920 }, height: { max: 1080 } }, audio: true });

    let Codecs = [];

    if(ScreenShareSession.value.getAudioTracks().length > 0)
    {
      Codecs =
      [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp8'
      ]
    }
    else
    {
      Codecs =
      [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8'
      ]
    }

    const MimeType = Codecs.find(c => MediaRecorder.isTypeSupported(c));

    ScreenShareRecorder = new MediaRecorder(ScreenShareSession.value, { mimeType: MimeType, videoBitsPerSecond: 10240000 });

    VideoElement = document.createElement('video');
    VideoElement.id = 'VideoPreview';
    VideoElement.autoplay = true;
    VideoElement.playsInline = true;
    VideoElement.muted = true;

    VideoElement.style.width = '400px';
    VideoElement.style.borderRadius = '8px';
    VideoElement.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
    VideoElement.style.position = 'fixed';
    VideoElement.style.bottom = '20px';
    VideoElement.style.left = '20px';

    VideoElement.srcObject = ScreenShareSession.value;

    document.body.appendChild(VideoElement);

    function StartNewRecording()
    {
      ScreenShareRecorder.ondataavailable = async (e) => {
        if(e.data.size > 0)
        {
          const Data = e.data;
          await api.post('/video',  Data, { headers: { 'Content-Type': 'video/webm'} });
        }

        if(ScreenShareSession.value.active)
        {
          StartNewRecording();
        }
      };

      ScreenShareRecorder.start();

      setTimeout(() => {
        if(ScreenShareRecorder.state === 'recording')
        {
          ScreenShareRecorder.stop();
        }
      }, 1000);
    }

    StartNewRecording();
  }
}

function StopScreenShare()
{
  if (ScreenShareSession.value) {
      ScreenShareSession.value.getTracks().forEach(track => {
          track.stop();
      });
      ScreenShareSession.value = undefined;
  }

  IsScreenSharing.value = false;
  document.body.removeChild(VideoElement);
}

async function RefreshConnectedChannel()
{
  const Channel = await api.get('/channel/'+ConnectedChannel.ID);

  for(const ConnectedUser of Channel.data[0].ConnectedUsers)
  {
    try{
      const User = ConnectedChannel.ConnectedUsers.find(u => u.Username == ConnectedUser.Username);

      if(!User)
      {
        ConnectedUser.AudioNode = new AudioWorkletNode(PlaybackCtx, 'playback-processor');
        ConnectedUser.AudioNode.connect(PlaybackCtx.destination);
        ConnectedUser.AudioNode.connect(AudioFilter);
        ConnectedChannel.ConnectedUsers.push(ConnectedUser);
      }
      else
      {
        if(!User.AudioNode)
        {
          User.AudioNode = new AudioWorkletNode(PlaybackCtx, 'playback-processor');
          User.AudioNode.connect(PlaybackCtx.destination);
          User.AudioNode.connect(AudioFilter);
        }
      }
    }
    catch(e)
    {
      console.log(e);
    }
  }
}

async function JoinVoiceChannel()
{
  var AudioContext = window.AudioContext || window.webkitAudioContext;
  PlaybackCtx = new AudioContext({ sampleRate: 16000 });
  RecordingCtx = new AudioContext();
  ConnectedChannel = SelectedChannel.value;

  AudioFilter = PlaybackCtx.createBiquadFilter();
  AudioFilter.type = 'highpass';
  AudioFilter.frequency.value = 100;
  AudioFilter.connect(PlaybackCtx.destination);



  await RecordingCtx.audioWorklet.addModule(RecorderProcessorURL);
  await PlaybackCtx.audioWorklet.addModule(PlaybackProcessorURL);

  await api.post('/channel/'+SelectedChannel.value.ID+'/join');
  await RefreshConnectedChannel();

  AudioInputStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  });

  Audio = RecordingCtx.createMediaStreamSource(AudioInputStream);
  AudioRecorder = new AudioWorkletNode(RecordingCtx, 'recorder-processor');

  AudioRecorder.port.onmessage = (Recording) => {

    const { RecordingData, Speaking } = Recording.data;

    if(Speaking)
    {
      SilenceGracePeriod = 20;
    }
    else
    {
      if(SilenceGracePeriod > 0)
      {
          SilenceGracePeriod--;
      }
      else
      {
        if(AudioInputBuffer.length > 0)
        {
          while(AudioInputBuffer.length < 3200)
          {
            AudioInputBuffer.push(0);
          }

          const MuLawBuffer = new Uint8Array(3200);

          for(let i = 0; i < 3200; i++)
          {
            MuLawBuffer[i] = EncodeMuLaw(AudioInputBuffer[i]);
          }

          api.post('/voice/'+ConnectedChannel.ID, MuLawBuffer.buffer, { headers: { 'Content-Type': 'application/octet-stream'}});
          AudioInputBuffer = [];
        }
        else
        {
          return;
        }
      }
    }

    if(!Speaking)
    {
      if(AudioInputBuffer.length < 500)
      {
        AudioInputBuffer = [];
      }

      return;
    }

    for (let i = 0; i < RecordingData.length; i++) {

      const s = Math.max(-1, Math.min(1, RecordingData[i]));
      AudioInputBuffer.push(s < 0 ? s * 0x8000 : s * 0x7FFF);
    }

    if(AudioInputBuffer.length >= 3200)
    {
      const MuLawBuffer = new Uint8Array(3200);

      for(let i = 0; i < 3200; i++)
      {
        MuLawBuffer[i] = EncodeMuLaw(AudioInputBuffer[i]);
      }

      api.post('/voice/'+ConnectedChannel.ID, MuLawBuffer.buffer, { headers: { 'Content-Type': 'application/octet-stream'}});
      AudioInputBuffer = [];
    }
  }

  Audio.connect(AudioRecorder);

  if(RefreshTimer == undefined)
  {
    RefreshTimer = setInterval(GrabAndPlay, 200);
  }

  if(RefreshConnectedChannelTimer == undefined)
  {
    RefreshConnectedChannelTimer = setInterval(RefreshConnectedChannel, 50);
  }
}

function EncodeMuLaw(Sample) {
  const PCM = Sample;
  const Mask = 0xFF;
  const Sign = (PCM < 0) ? 0x80 : 0x00;

  if(PCM < 0)
  {
    Sample = -PCM;
  }

  if(Sample > 32767)
  {
    Sample = 32767;
  }

  Sample += 132;

  let Exponent = 7;

  for(let ExpMask = 0x4000; (Sample & ExpMask) === 0 && Exponent > 0; Exponent--)
  {
    ExpMask >>= 1;
  }

  const Mantissa = (Sample >> (Exponent + 3)) & 0x0F;
  return ~(Sign | (Exponent << 4) | Mantissa) & Mask;
}

async function GrabAndPlay()
{
  const Data = await api.get('/voice/'+ConnectedChannel.ID, { params: { 'LastProcessedID': LastProcessedID } } );

  for(const UserGroup of Data.data)
  {
    const User = ConnectedChannel.ConnectedUsers.find(u => u.Username === UserGroup.Username);

    if (User && User.AudioNode) {
      if (User.AudioNode.context.state === 'suspended') {
          User.AudioNode.context.resume();
      }

      const SortedPackets = UserGroup.VoiceData.sort((a, b) => a.ID - b.ID);

      for(const Packet of SortedPackets)
      {
        if (Packet.ID <= (User.LastId || 0)) continue;

        User.LastId = Packet.ID;
        LastProcessedID = Packet.ID;

        const BinaryString = atob(Packet.Data);
        const Bytes = new Uint8Array(BinaryString.length);

        for (let i = 0; i < BinaryString.length; i++) {
          Bytes[i] = BinaryString.charCodeAt(i);
        }

        User.AudioNode.port.postMessage(Bytes.buffer, [Bytes.buffer]);
      }
    }
    else
    {
      console.log(User);
    }

  }
}

async function EditChannel(Channel)
{
  if(!PendingChannelEdit.value)
  {
    PendingChannelEdit.value = {
      Type: Channel.Type,
      Name: Channel.Name,
      ID: Channel.ID,
      Permissions: []
    }

    const response = await api.get('/permissions/channel-access/'+Channel.ID);
    PendingChannelEdit.value.Permissions = response.data;

    for(const Permission of PendingChannelEdit.value.Permissions)
    {
      if(Permission.Access == 1)
      {
        Permission.Access = true;
      }
      else
      {
        Permission.Access = false;
      }

      if(Permission.Modify == 1)
      {
        Permission.Modify = true;
      }
      else
      {
        Permission.Modify = false;
      }
    }

    const AccessLevels = await api.get('/permissions/access-levels');
    PendingChannelEdit.value.AccessLevels = AccessLevels.data;

    PendingChannelEdit.value.AccessLevels = PendingChannelEdit.value.AccessLevels.filter(AccessLevel =>
      !PendingChannelEdit.value.Permissions.some(p => p.ID == AccessLevel.ID)
    );
  }
  else
  {
    api.post('/channel/'+PendingChannelEdit.value.ID, PendingChannelEdit.value);
    PendingChannelEdit.value = false;
  }
}

function CreateChannel(Type)
{
  if(!PendingChannelCreate.value)
  {
    PendingChannelCreate.value = {
      Type: Type,
      Name: '',
      Permissions: []
    }

    api.get('/permissions/access-levels').then(response => {
      if(response.status == 200)
      {
        PendingChannelCreate.value.AccessLevels = response.data;

        for(const AccessLevel of PendingChannelCreate.value.AccessLevels)
        {
          if(AccessLevel.ID == 1)
          {
            AccessLevel.Access = true;
            AccessLevel.Modify = true;

            PendingChannelCreate.value.AccessLevels.splice(PendingChannelCreate.value.AccessLevels.indexOf(AccessLevel), 1);
            PendingChannelCreate.value.Permissions.push(AccessLevel);
          }
        }
      }
    });
  }
  else
  {
    api.post('/channel', PendingChannelCreate.value);
    PendingChannelCreate.value = false;
  }
}

function AddAccessLevelToNewChannel(AccessLevel)
{
  AccessLevel.Access = true;
  AccessLevel.Modify = false;

  PendingChannelCreate.value.AccessLevels.splice(PendingChannelCreate.value.AccessLevels.indexOf(AccessLevel), 1);
  PendingChannelCreate.value.Permissions.push(AccessLevel);
}

function RemoveAccessLevelFromNewChannel(AccessLevel)
{
  PendingChannelCreate.value.AccessLevels.push(AccessLevel);
  PendingChannelCreate.value.Permissions.splice(PendingChannelCreate.value.Permissions.indexOf(AccessLevel), 1);
}

function AddAccessLevelToEditChannel(AccessLevel)
{
  AccessLevel.Access = true;
  AccessLevel.Modify = false;

  PendingChannelEdit.value.AccessLevels.splice(PendingChannelEdit.value.AccessLevels.indexOf(AccessLevel), 1);
  PendingChannelEdit.value.Permissions.push(AccessLevel);
}

function RemoveAccessLevelFromEditChannel(AccessLevel)
{
  PendingChannelEdit.value.AccessLevels.push(AccessLevel);
  PendingChannelEdit.value.Permissions.splice(PendingChannelEdit.value.Permissions.indexOf(AccessLevel), 1);
}

function DeleteChannel(Channel)
{
  if(!PendingChannelDelete.value)
  {
    PendingChannelDelete.value = Channel;
  }
  else
  {
    api.delete('/channel/'+PendingChannelDelete.value.ID).then(() => {
      PendingChannelDelete.value = undefined;
    });
  }
}

function BanUser(User)
{
  if(!PendingBanUser.value)
  {
    PendingBanUser.value = User;
    PendingBanUser.value.Reason = '';
    PendingBanUser.value.EndDate = date.formatDate(Date.now(), 'YYYY/MM/DD');
    PendingBanUser.value.BanUser = true;
  }
  else
  {
    api.post('/user/'+PendingBanUser.value.Username, PendingBanUser.value);
    PendingBanUser.value = undefined;
  }
}

function ActivateUser(User)
{
  let UserToActivate = User;
  UserToActivate.ActivateUser = true;

  api.post('/user/'+UserToActivate.Username, UserToActivate);
}

function UnbanUser(User)
{
  let UserToUnban = User;
  UserToUnban.UnbanUser = true;

  api.post('/user/'+UserToUnban.Username, UserToUnban);
}

function ResetPassword(User)
{
  if(!PendingResetPassword.value)
  {
    PendingResetPassword.value = User;
    PendingResetPassword.value.ResetPassword = true;
    PendingResetPassword.value.Password = '';
    PendingResetPassword.value.ConfirmPassword = '';
  }
  else
  {
    api.post('/user/'+PendingResetPassword.value.Username, PendingResetPassword.value);
    PendingResetPassword.value = false;
  }
}

async function ConfigureRoles()
{
  if(!PendingConfigureRoles.value)
  {
    const response = await api.get('/permissions/access-levels', { params: { 'WithGlobalPermissions': true } });

    if(response.status == 401)
    {
      localStorage.removeItem('AuthToken');
      window.location.reload();
    }

    PendingConfigureRoles.value = {};
    PendingConfigureRoles.value.AccessLevels = response.data;

    for(const AccessLevel of PendingConfigureRoles.value.AccessLevels)
    {
      if(AccessLevel.GlobalPermissions.ModifyChannels == 1)
      {
        AccessLevel.GlobalPermissions.ModifyChannels = true;
      }
      else
      {
        AccessLevel.GlobalPermissions.ModifyChannels = false;
      }

      if(AccessLevel.GlobalPermissions.BanUsers == 1)
      {
        AccessLevel.GlobalPermissions.BanUsers = true;
      }
      else
      {
        AccessLevel.GlobalPermissions.BanUsers = false;
      }

      if(AccessLevel.GlobalPermissions.DeleteMessages == 1)
      {
        AccessLevel.GlobalPermissions.DeleteMessages = true;
      }
      else
      {
        AccessLevel.GlobalPermissions.DeleteMessages = false;
      }

      if(AccessLevel.GlobalPermissions.ModifyAccess == 1)
      {
        AccessLevel.GlobalPermissions.ModifyAccess = true;
      }
      else
      {
        AccessLevel.GlobalPermissions.ModifyAccess = false;
      }

      if(AccessLevel.GlobalPermissions.ModifyProfiles == 1)
      {
        AccessLevel.GlobalPermissions.ModifyProfiles = true;
      }
      else
      {
        AccessLevel.GlobalPermissions.ModifyProfiles = false;
      }

      if(AccessLevel.GlobalPermissions.DeleteUsers == 1)
      {
        AccessLevel.GlobalPermissions.DeleteUsers = true;
      }
      else
      {
        AccessLevel.GlobalPermissions.DeleteUsers = false;
      }

    }

  }
  else
  {
    api.post('/permissions/access-levels', PendingConfigureRoles.value.AccessLevels);
    PendingConfigureRoles.value = false;
  }
}

function AddRoleToPending()
{
  const AccessLevel = {
    Name: PendingConfigureRoles.value.NewName,
    Colour: '#ffffff',
    New: true,
    GlobalPermissions: {
      ModifyAccess: false,
      ModifyChannels: false,
      BanUsers: false,
      DeleteUsers: false,
    }
  }

  const Exists = PendingConfigureRoles.value.AccessLevels.find(l => l.Name == PendingConfigureRoles.value.NewName);

  if(!Exists && PendingConfigureRoles.value.NewName != '')
  {
    PendingConfigureRoles.value.AccessLevels.push(AccessLevel);
    PendingConfigureRoles.value.NewName = '';
  }
}

async function ChangeUserRole(User)
{
  if(!PendingUserRole.value)
  {
    PendingUserRole.value = {};
    PendingUserRole.value.User = User;
    const response = await api.get('/permissions/access-levels');
    PendingUserRole.value.AccessLevels = response.data;
  }
  else
  {
    const Role = PendingUserRole.value.AccessLevels.find(l => l.ID === PendingUserRole.value.User.AccessLevelID);
    api.post('/api/permissions/change-role/'+PendingUserRole.value.User.Username, { Role });

    PendingUserRole.value = false;
  }
}

function RemoveRoleFromPending(AccessLevel)
{
  PendingConfigureRoles.value.AccessLevels.splice(PendingConfigureRoles.value.AccessLevels.indexOf(AccessLevel), 1);
}

function RekeyConversation(User, Key)
{
  if(!PendingRekeyConversation.value)
  {
    PendingRekeyConversation.value = {};
    PendingRekeyConversation.value.User = User;
    PendingRekeyConversation.value.Key = Key;
  }
  else
  {
    api.post('/dm/'+PendingRekeyConversation.value.User.Username+'/rekey', { 'PublicKey': PendingRekeyConversation.value.Key });
    PendingRekeyConversation.value = false;
  }
}

function DeleteUser(User)
{
  if(!PendingDeleteUser.value)
  {
    PendingDeleteUser.value = {};
    PendingDeleteUser.value.User = User;
  }
  else
  {
    api.delete('/user/'+PendingDeleteUser.value.User.Username);
    PendingDeleteUser.value = undefined;
  }
}

async function ManageKeys()
{
  if(!PendingKeyManagement.value)
  {
    PendingKeyManagement.value = {};
  }
  else
  {
    const Text = await PendingKeyManagement.value.ImportedKeys.text();
    const Keys = JSON.parse(Text);

    const DBRequest = indexedDB.open('DMKeys', 2);

    DBRequest.onsuccess = async (e) => {
        const DB = e.target.result;

        for(const Entry of Keys) {
            try {
                const Binary = atob(Entry.Key);
                const Bytes = new Uint8Array(Binary.length);

                for(let i = 0; i < Binary.length; i++) {
                    Bytes[i] = Binary.charCodeAt(i);
                }

                const CryptoKey = await crypto.subtle.importKey(
                    'pkcs8',
                    Bytes.buffer,
                    { name: 'RSA-OAEP', hash: 'SHA-256' },
                    true,
                    ['decrypt']
                );

                const Transaction = DB.transaction('PrivateKeys', 'readwrite');
                Transaction.objectStore('PrivateKeys').put({
                    Username: Entry.Username,
                    Key: CryptoKey
                });
            }
            catch(e) {
                console.error('Failed to import key for', Entry.Username, e);
            }
        }
    }

    PendingKeyManagement.value = false;
  }
}

function ExportKeys() {
    const DBRequest = indexedDB.open('DMKeys', 2);

    DBRequest.onsuccess = (e) => {
        const DB = e.target.result;
        const Transaction = DB.transaction('PrivateKeys', 'readonly');
        const Store = Transaction.objectStore('PrivateKeys');
        const GetAll = Store.getAll();

        GetAll.onsuccess = async () => {
            const Keys = [];

            for(const Entry of GetAll.result) {

                try {
                    const Exported = await crypto.subtle.exportKey('pkcs8', Entry.Key);
                    const Bytes = new Uint8Array(Exported);
                    let Binary = '';

                    for(let i = 0; i < Bytes.length; i++) {
                        Binary += String.fromCharCode(Bytes[i]);
                    }

                    Keys.push({
                        Username: Entry.Username,
                        Key: btoa(Binary)
                    });
                }
                catch(e) {
                    console.error('Failed to export key for', Entry.Username, e);
                }
            }

            const Data = JSON.stringify(Keys);
            const blob = new Blob([Data], { type: 'application/json' });
            const URL = window.URL.createObjectURL(blob);

            const Link = document.createElement('a');
            Link.href = URL;
            Link.download = 'keys-backup.json';
            Link.click();

            window.URL.revokeObjectURL(URL);
        };
    };
}

function ImportKeys()
{
  const Input = document.createElement('input');
  Input.type = 'file';
  Input.accept = 'application/json';
  Input.click();

  Input.onchange = (e) => {
    PendingKeyManagement.value.ImportedKeys = e.target.files[0];
  }
}

function ClearAllPendingActivities()
{
  PendingKeyManagement.value = undefined;
  PendingBanUser.value = undefined;
  PendingChannelCreate.value = undefined;
  PendingChannelDelete.value = undefined;
  PendingChannelEdit.value = undefined;
  PendingResetPassword.value = undefined;
  PendingConfigureRoles.value = undefined;
  PendingUserRole.value = undefined;
  PendingRekeyConversation.value = undefined;
  PendingDeleteUser.value = undefined;
}

function MuteAudioDevice()
{
  AudioInputStream.getAudioTracks().forEach(Track => {
    Track.enabled = false;
  });
}

function UnmuteAudioDevice()
{
  AudioInputStream.getAudioTracks().forEach(Track => {
    Track.enabled = true;
  });
}

async function DisconnectVoice()
{
  clearInterval(RefreshTimer);
  clearInterval(RefreshConnectedChannelTimer);
  RefreshTimer = undefined;
  RefreshConnectedChannelTimer = undefined;

  AudioRecorder = undefined;

  if(AudioInputStream != null)
  {
    AudioInputStream.getTracks().forEach((element) => {
      element.stop();
    });

    RecordingCtx = undefined;
    PlaybackCtx = undefined;
  }

  for(const ConnectedUser of ConnectedChannel.ConnectedUsers)
  {
    ConnectedUser.AudioNode = undefined;
  }

  await api.post('/channel/'+ConnectedChannel.ID+'/disconnect');

  ConnectedChannel = undefined;
  Audio = undefined;
}

onMounted(async () => {
  if(AuthToken.value != '')
  {
    const response = await api.get('/me');

    if(response.status == 401)
    {
      localStorage.removeItem('AuthToken');
      window.location.reload();
    }

    Me.value =response.data[0];

    api.get('/channel').then(response => {
    if(response.status == 200)
    {
      Channels.value = response.data;

      Channels.value.forEach(element =>
      {
        if(element.ID == Route.params.channelid)
        {
          SelectedChannel.value = element;
        }

        if(element.ConnectedUsers != undefined)
        {
          for(const ConnectedUser of element.ConnectedUsers)
          {
            if(ConnectedUser.Me && element != ConnectedChannel)
            {
              api.post('/channel/'+element.ID+'/disconnect');
            }
          }
        }
      });


      if(SelectedChannel.value.Type == 'V')
      {
        if(ConnectedChannel != undefined)
        {
          if(SelectedChannel.value != ConnectedChannel)
          {
              DisconnectVoice();
          }
        }
        JoinVoiceChannel();
      }

      Loading.value = false;
      }
    });
  }
});

onUnmounted(() =>
{
  if(ConnectedChannel)
  {
    DisconnectVoice();
  }

  if(ScreenShare.value)
  {
    StopScreenShare();
  }
});

addEventListener("beforeunload", async () => {
  if(ConnectedChannel)
  {
    await DisconnectVoice();
    StopScreenShare();
  }
})
</script>

<template>
  <title-bar @resetpassword="ResetPassword" @manageprivatekeys="ManageKeys()" v-if="AuthToken != '' && !Loading" />

  <div id="Wrapper">

    <div class="Overlay" v-if="PendingBanUser || PendingChannelDelete || PendingChannelEdit || PendingChannelCreate || PendingResetPassword || PendingConfigureRoles || PendingUserRole || PendingRekeyConversation || PendingKeyManagement || PendingDeleteUser"
    @click="ClearAllPendingActivities()">
      <div class="Popup" v-if="PendingChannelDelete" @click.stop>
        Are you sure you want to delete {{ PendingChannelDelete.Name }}?

        <div class="Options">
          <q-btn dark dense color="green-9" @click="DeleteChannel"><q-icon name="check" />Confirm</q-btn>
          <q-btn dark dense color="red-10" @click="PendingChannelDelete=undefined"><q-icon name="clear" />Cancel</q-btn>
        </div>
      </div>

      <div class="Popup BanUser" v-if="PendingBanUser" @click.stop>
        Are you sure you want to ban {{ PendingBanUser.Username }}?

        <textarea placeholder="Reason" v-model="PendingBanUser.Reason">

        </textarea>

        <q-date dark v-model="PendingBanUser.EndDate" :minimal="true"></q-date>

        <div class="Options">
          <q-btn dark dense color="green-9" @click="BanUser"><q-icon name="check" />Confirm</q-btn>
          <q-btn dark dense color="red-10" @click="PendingBanUser=undefined"><q-icon name="clear" />Cancel</q-btn>
        </div>
      </div>

      <div class="Popup DeleteUser" v-if="PendingDeleteUser" @click.stop>
        Are you sure you want to delete {{ PendingDeleteUser.User.Username }}?  This will remove all of their messages.

        <div class="Options">
          <q-btn dark dense color="green-9" @click="DeleteUser"><q-icon name="check" />Confirm</q-btn>
          <q-btn dark dense color="red-10" @click="PendingDeleteUser=undefined"><q-icon name="clear" />Cancel</q-btn>
        </div>
      </div>

      <div class="Popup RekeyConversation" v-if="PendingRekeyConversation" @click.stop>
        <p>WARNING: You should only use this if you have lost access to your old private key.</p>

        <p>If you are trying to decrypt messages on a new device then use the Key Management option to export your keys from your old device and import them on the new one.</p>

        <div class="Options">
          <q-btn dark dense color="green-9" @click="RekeyConversation"><q-icon name="check" />Confirm</q-btn>
          <q-btn dark dense color="red-10" @click="PendingRekeyConversation=undefined"><q-icon name="clear" />Cancel</q-btn>
        </div>
      </div>

      <div class="Popup ResetPassword" v-if="PendingResetPassword" @click.stop>
        Reseting password for {{ PendingResetPassword.Username }}

        <div class="DataInput">
          <input type="password" v-model="PendingResetPassword.Password" placeholder="Password" />
          <input type="password" v-model="PendingResetPassword.ConfirmPassword" placeholder="Confirm password" />
        </div>

        <div class="Options">
          <q-btn dark dense color="green-9" @click="ResetPassword"><q-icon name="check" />Confirm</q-btn>
          <q-btn dark dense color="red-10" @click="PendingResetPassword=undefined"><q-icon name="clear" />Cancel</q-btn>
        </div>
      </div>

      <div class="Popup ChangeRole" v-if="PendingUserRole" @click.stop>
        Changing role for {{ PendingUserRole.User.Username }}
        <div class="DataInput">

          <select v-model="PendingUserRole.User.AccessLevelID">
            <option v-for="AccessLevel in PendingUserRole.AccessLevels" :key="AccessLevel" :value="AccessLevel.ID">
              {{ AccessLevel.Name }}
            </option>
          </select>
        </div>

        <div class="Options">
          <q-btn dark dense color="green-9" @click="ChangeUserRole"><q-icon name="check" />Confirm</q-btn>
          <q-btn dark dense color="red-10" @click="PendingUserRole=undefined"><q-icon name="clear" />Cancel</q-btn>
        </div>
      </div>

      <div class="Popup ManageKeys" v-if="PendingKeyManagement" @click.stop>
        <p>It is recommended that you export your private keys regularly to prevent being unable to decrypt your conversations in the event that your browser is cleared unexpectedly.</p>

        <p>It is advised that you store the exported keys in an encrypted archive that is itself password or key protected.</p>

        <q-btn dark color="grey-10" @click="ExportKeys()">Export</q-btn>
        <q-btn dark color="grey-10" @click="ImportKeys()">Import</q-btn>

        <p v-if="PendingKeyManagement.ImportedKeys" class="KeyOverwriteWarning"><q-icon name="warning" size="24px" color="yellow-8"></q-icon>Warning: clicking confirm will overwrite your current private keys.</p>

        <div class="Options">
          <q-btn dark dense color="green-9" @click="ManageKeys()"><q-icon name="check" />Confirm</q-btn>
          <q-btn dark dense color="red-10" @click="PendingKeyManagement=undefined"><q-icon name="clear" />Cancel</q-btn>
        </div>
      </div>


      <div class="Popup CreateChannel" v-if="PendingChannelCreate" @click.stop>

        You are creating a new {{ PendingChannelCreate.Type }} Channel.

        <div class="DataInput">
          <input type="text" class="TextInput" v-model="PendingChannelCreate.Name" placeholder="Channel Name" />


          <table>
            <thead>
              <tr>
                <td>Access Level</td>
                <td class="Centered">Access</td>
                <td class="Centered">Modify</td>
                <td class="Centered">Remove</td>
              </tr>
            </thead>
            <tbody>
              <tr v-for="AccessLevel in PendingChannelCreate.Permissions" :key="AccessLevel">
                <td>{{ AccessLevel.Name }}</td>
                <td class="Centered" v-if="AccessLevel.ID == 1"><q-checkbox dark v-model="AccessLevel.Access" toggle-order="tf" :val="true" disable /></td>
                <td class="Centered" v-else><q-checkbox dark v-model="AccessLevel.Access" toggle-order="tf" :val="true" /></td>
                <td class="Centered" v-if="AccessLevel.ID == 1"><q-checkbox dark v-model="AccessLevel.Modify" toggle-order="tf" :val="true" disable /></td>
                <td class="Centered" v-else><q-checkbox dark v-model="AccessLevel.Modify" toggle-order="tf" :val="true" /></td>
                <td class="Centered" v-if="AccessLevel.ID == 1"><q-btn dark dense disable><q-icon name="delete"></q-icon></q-btn></td>
                <td class="Centered" v-else><q-btn dark dense @click="RemoveAccessLevelFromNewChannel(AccessLevel)"><q-icon name="delete"></q-icon></q-btn></td>
              </tr>

              <tr>
                <td>
                  <select>
                    <option v-for="AccessLevel in PendingChannelCreate.AccessLevels" :key="AccessLevel" @click="AddAccessLevelToNewChannel(AccessLevel)">
                      {{ AccessLevel.Name }}
                    </option>
                  </select>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="Options">
          <q-btn dark dense color="green-9" @click="CreateChannel"><q-icon name="check" />Confirm</q-btn>
          <q-btn dark dense color="red-10" @click="PendingChannelCreate=undefined"><q-icon name="clear" />Cancel</q-btn>
        </div>
      </div>

        <div class="Popup CreateChannel" v-if="PendingChannelEdit" @click.stop>

        You are updating {{ PendingChannelEdit.Name }}.

        <div class="DataInput">
          <input type="text" class="TextInput" v-model="PendingChannelEdit.Name" placeholder="Channel Name" />


          <table>
            <thead>
              <tr>
                <td>Access Level</td>
                <td class="Centered">Access</td>
                <td class="Centered">Modify</td>
                <td class="Centered">Remove</td>
              </tr>
            </thead>
            <tbody>
              <tr v-for="AccessLevel in PendingChannelEdit.Permissions" :key="AccessLevel">
                <td>{{ AccessLevel.Name }}</td>
                <td class="Centered" v-if="AccessLevel.ID == 1"><q-checkbox dark v-model="AccessLevel.Access" toggle-order="tf" :val="true" disable /></td>
                <td class="Centered" v-else><q-checkbox dark v-model="AccessLevel.Access" toggle-order="tf" :val="true" /></td>
                <td class="Centered" v-if="AccessLevel.ID == 1"><q-checkbox dark v-model="AccessLevel.Modify" toggle-order="tf" :val="true" disable /></td>
                <td class="Centered" v-else><q-checkbox dark v-model="AccessLevel.Modify" toggle-order="tf" :val="true" /></td>
                <td class="Centered" v-if="AccessLevel.ID == 1"><q-btn dark dense disable><q-icon name="delete"></q-icon></q-btn></td>
                <td class="Centered" v-else><q-btn dark dense @click="RemoveAccessLevelFromEditChannel(AccessLevel)"><q-icon name="delete"></q-icon></q-btn></td>
              </tr>

              <tr>
                <td>
                  <select>
                    <option v-for="AccessLevel in PendingChannelEdit.AccessLevels" :key="AccessLevel" @click="AddAccessLevelToEditChannel(AccessLevel)">
                      {{ AccessLevel.Name }}
                    </option>
                  </select>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="Options">
          <q-btn dark dense color="green-9" @click="EditChannel"><q-icon name="check" />Confirm</q-btn>
          <q-btn dark dense color="red-10" @click="PendingChannelEdit=undefined"><q-icon name="clear" />Cancel</q-btn>
        </div>
      </div>

      <div class="Popup CreateChannel" v-if="PendingConfigureRoles" @click.stop>

        You are configuring roles.

        <div class="DataInput">
          <div class="AddNewRole">
            <input type="text" class="TextInput" v-model="PendingConfigureRoles.NewName" @keyup.enter.stop.prevent="AddRoleToPending" placeholder="Add new role..." />
            <q-btn @click="AddRoleToPending" ><q-icon name="add" /></q-btn>
          </div>

          <table>
            <thead>
              <tr>
                <td>Access Level</td>
                <td class="Centered">Create/delete Channels</td>
                <td class="Centered">Ban Users</td>
                <td class="Centered">Modify Roles</td>
                <td class="Centered">Delete Users</td>
                <td class="Centered">Role Colour</td>
                <td class="Centered">Remove</td>
              </tr>
            </thead>
            <tbody>
              <tr v-for="AccessLevel in PendingConfigureRoles.AccessLevels" :key="AccessLevel">
                <td>{{ AccessLevel.Name }}</td>
                <td class="Centered" v-if="AccessLevel.ID == 1 || AccessLevel.ID == 2"><q-checkbox dark v-model="AccessLevel.GlobalPermissions.ModifyChannels" toggle-order="tf" :val="true" disable /></td>
                <td class="Centered" v-else><q-checkbox dark v-model="AccessLevel.GlobalPermissions.ModifyChannels" toggle-order="tf" :val="true" /></td>
                <td class="Centered" v-if="AccessLevel.ID == 1 || AccessLevel.ID == 2"><q-checkbox dark v-model="AccessLevel.GlobalPermissions.BanUsers" toggle-order="tf" :val="true" disable /></td>
                <td class="Centered" v-else><q-checkbox dark v-model="AccessLevel.GlobalPermissions.BanUsers" toggle-order="tf" :val="true" /></td>
                <td class="Centered" v-if="AccessLevel.ID == 1 || AccessLevel.ID == 2"><q-checkbox dark v-model="AccessLevel.GlobalPermissions.ModifyAccess" toggle-order="tf" :val="true" disable /></td>
                <td class="Centered" v-else><q-checkbox dark v-model="AccessLevel.GlobalPermissions.ModifyAccess" toggle-order="tf" :val="true" /></td>
                <td class="Centered" v-if="AccessLevel.ID == 1 || AccessLevel.ID == 2"><q-checkbox dark v-model="AccessLevel.GlobalPermissions.DeleteUsers" toggle-order="tf" :val="true" disable /></td>
                <td class="Centered" v-else><q-checkbox dark v-model="AccessLevel.GlobalPermissions.DeleteUsers" toggle-order="tf" :val="true" /></td>
                <td class="Centered"><input type="text" v-model="AccessLevel.Colour" /><q-menu><q-color dark no-header no-footer v-model="AccessLevel.Colour" formar-model="hex" /></q-menu></td>
                <td class="Centered" v-if="AccessLevel.ID == 1 || AccessLevel.ID == 2"><q-btn dark dense disable><q-icon name="delete"></q-icon></q-btn></td>
                <td class="Centered" v-else><q-btn dark dense @click="RemoveRoleFromPending(AccessLevel)"><q-icon name="delete"></q-icon></q-btn></td>

              </tr>
            </tbody>
          </table>
        </div>

        <div class="Options">
          <q-btn dark dense color="green-9" @click="ConfigureRoles"><q-icon name="check" />Confirm</q-btn>
          <q-btn dark dense color="red-10" @click="PendingConfigureRoles=undefined"><q-icon name="clear" />Cancel</q-btn>
        </div>
      </div>

    </div>



    <div id="Main" v-if="AuthToken != '' && !Loading && !Route.params.username">
      <ChannelList @disconnect="DisconnectVoice()" @mute="MuteAudioDevice()" @unmute="UnmuteAudioDevice()"
      @startscreenshare="StartScreenShare()" @stopscreenshare="StopScreenShare()" @deletechannel="DeleteChannel" @editchannel="EditChannel" @createchannel="CreateChannel" @banuser="BanUser"
      :-me="Me"/>
      <TextChannel class="MainComponent" :key="SelectedChannel" v-if="SelectedChannel.Type == 'T'"/>
      <VoiceChannel class="MainComponent" v-else-if="SelectedChannel.Type == 'V'" @startvideostream="StartScreenShare()" @stopvideostream="StopScreenShare()" :-me="Me" @banuser="BanUser" />
      <InfoPane class="MainComponent" v-else />

      <UserList :-me="Me" @banuser="BanUser" @unbanuser="UnbanUser" @activateuser="ActivateUser" @resetpassword="ResetPassword" @configureroles="ConfigureRoles" @changeuserrole="ChangeUserRole" @deleteuser="DeleteUser" />
    </div>

    <div id="Main" v-else-if="AuthToken != '' && !Loading && Route.meta.name == 'Profile'">
      <ChannelList @disconnect="DisconnectVoice()" @mute="MuteAudioDevice()" @unmute="UnmuteAudioDevice()"
      @startscreenshare="StartScreenShare()" @stopscreenshare="StopScreenShare()" @deletechannel="DeleteChannel" @editchannel="EditChannel" @createchannel="CreateChannel" @banuser="BanUser"
      :-me="Me" />
      <UserProfile class="MainComponent" :key="Route.params.username"/>

      <UserList :-me="Me" @banuser="BanUser" @unbanuser="UnbanUser" @activateuser="ActivateUser" @resetpassword="ResetPassword" @configureroles="ConfigureRoles" @changeuserrole="ChangeUserRole" @deleteuser="DeleteUser" />
    </div>

    <div id="Main" v-else-if="AuthToken != '' && !Loading && Route.meta.name == 'DM'">
      <ChannelList @disconnect="DisconnectVoice()" @mute="MuteAudioDevice()" @unmute="UnmuteAudioDevice()"
      @startscreenshare="StartScreenShare()" @stopscreenshare="StopScreenShare()" @deletechannel="DeleteChannel" @editchannel="EditChannel" @createchannel="CreateChannel" @banuser="BanUser"
      :-me="Me" />
      <DirectMessage class="MainComponent" :key="Route.params.username" @rekeyconversation="RekeyConversation"/>

      <UserList :-me="Me" @banuser="BanUser" @unbanuser="UnbanUser" @activateuser="ActivateUser" @resetpassword="ResetPassword" @configureroles="ConfigureRoles" @changeuserrole="ChangeUserRole" @deleteuser="DeleteUser" />

    </div>

    <div id="Main" v-else-if="AuthToken != '' && !Loading && Route.meta.name == 'Screen Share'">
      <ChannelList @disconnect="DisconnectVoice()" @mute="MuteAudioDevice()" @unmute="UnmuteAudioDevice()"
      @startscreenshare="StartScreenShare()" @stopscreenshare="StopScreenShare()" @deletechannel="DeleteChannel" @editchannel="EditChannel" @createchannel="CreateChannel" @banuser="BanUser"
      :-me="Me" />
      <ScreenShare class="MainComponent" :key="Route.params.username"/>

      <UserList :-me="Me" @banuser="BanUser" @unbanuser="UnbanUser" @activateuser="ActivateUser" @resetpassword="ResetPassword" @configureroles="ConfigureRoles" @changeuserrole="ChangeUserRole" @deleteuser="DeleteUser" />

    </div>

    <div id="Main" v-else-if="AuthToken != '' && Loading">

    </div>

    <div id="Main" v-else>
      <LoginPage />
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

@media only screen and (max-width: 992px) {
  #Wrapper #Main .MainComponent {
    padding: 0 40px;
  }
}

#Wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row;
  overflow: hidden;
}

#Wrapper #Main {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row;
  overflow: hidden;
}

#Wrapper .Overlay {
  width: 100%;
  height: 100%;
  padding: 20px 0 0 0;
  background-color: rgba(0, 0, 0, 0.9);
  position: absolute;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  z-index: 1000;
  animation: 0.3s forwards FadeIn;
}

#Wrapper .Overlay .Popup {
  padding: 20px;
  background-color: #181818;
  border-radius: 10px;
  border-style: solid;
  border-width: 1px;
  border-color: rgba(255, 255, 255, 0.1);
  display: flex;
  gap: 20px;
  flex-direction: column;
}

#Wrapper .Overlay .CreateChannel {
  min-width: 400px;
}

#Wrapper .Overlay .Popup .DataInput {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

#Wrapper .Overlay .Popup .DataInput .AddNewRole {
  display: flex;
}

#Wrapper .Overlay .Popup .DataInput h2 {
  margin: 0;
  padding: 0 0 0 5px;
  font-size: 1em;
  line-height: 2;
  font-weight: bold;
  border-style: solid;
  border-width: 1px 0;
  border-color: rgba(255, 255, 255, 0.1);
}

#Wrapper .Overlay .BanUser textarea {
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

#Wrapper .Overlay .RekeyConversation {
  max-width: 450px;
}

#Wrapper .Overlay .ManageKeys {
  max-width: 450px;
}

#Wrapper .Overlay .ManageKeys .KeyOverwriteWarning {
  padding: 20px 0;
  font-size: 0.7em;
  display: flex;
  align-items: center;
  gap: 10px;
}

#Wrapper .Overlay .Popup .DataInput input, #Wrapper .Overlay .Popup .DataInput select {
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

#Wrapper .Overlay .Popup .DataInput table {
  border-style: solid;
  border-width: 1px;
  border-color: rgba(255, 255, 255, 0.1);
  border-collapse: collapse;
}

#Wrapper .Overlay .Popup .DataInput table thead {
  background-color: rgba(0, 0, 0, 0.4);
}

#Wrapper .Overlay .Popup .DataInput table td {
  padding: 5px 10px;
  border-style: solid;
  border-width: 0 0 1px 0;
  border-color: rgba(255, 255, 255, 0.1);
}

#Wrapper .Overlay .Popup .DataInput table td.Centered {
  text-align: center;
}

#Wrapper .Overlay .Popup .Options {
  display: flex;
  gap: 10px;
  align-self: center;
}
</style>
