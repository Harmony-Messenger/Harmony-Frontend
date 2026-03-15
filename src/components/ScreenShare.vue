<script setup>
import { useRoute } from 'vue-router';
import { api } from 'src/boot/axios';
import { onMounted, onUnmounted, ref } from 'vue';

const Route = useRoute();
const VideoPlayer = ref(null);
const ConnectedUsers = ref(0);

let Queue = [];
let mediaSource = null;
let sourceBuffer = undefined;
let CurrentID = 1;
let LastQueuedID = 0;
let ChunksBuffered = 0;
let FetchTimer = undefined;
let ConnectedUsersTimer = undefined;

function ProcessQueue()
{
  if(Queue.length > 0 && sourceBuffer && !sourceBuffer.updating)
  {
    sourceBuffer.appendBuffer(Queue.shift());
  }
}

function SourceBufferUpdateEnd()
{
  if(ChunksBuffered > 3 && VideoPlayer.value.paused)
  {
    VideoPlayer.value.play();
  }

  if(sourceBuffer && !sourceBuffer.updating)
  {
    const Buffered = sourceBuffer.buffered;
    const CurrentTime = VideoPlayer.value.currentTime;

    if(Buffered.length > 0 && CurrentTime - Buffered.start(0) > 30)
    {
      sourceBuffer.remove(Buffered.start(0), Math.max(0, CurrentTime - 10));
      return;
    }

    ProcessQueue();
  }
}

async function FetchNextChunk()
{
  const response = await api.get('/video/'+Route.params.username, { params: { 'LastProcessedID': CurrentID }, responseType: 'arraybuffer' });

  if(response.status == 401)
  {
    localStorage.removeItem('AuthToken');
    window.location.reload();
  }

  const ServedID = parseInt(response.headers['current-id']);

  if(response.status == 200 && ServedID > LastQueuedID)
  {
    Queue.push(response.data);

    if(!sourceBuffer)
    {
      const bytes = new Uint8Array(response.data);
      const str = new TextDecoder().decode(bytes.slice(0, 512));

      const HasAudio = str.includes('A_OPUS') || str.includes('A_VORBIS');
      const VideoCodec = str.includes('V_VP9') ? 'vp9' : 'vp8';

      let Codec = 'video/webm; codecs='+VideoCodec;

      if(HasAudio)
      {
        Codec = Codec+', opus';
      }

      sourceBuffer = mediaSource.addSourceBuffer(Codec);
      sourceBuffer.mode = 'sequence';
      mediaSource.duration = Infinity;
      sourceBuffer.onupdateend = SourceBufferUpdateEnd;
    }

    LastQueuedID = ServedID;
    CurrentID = ServedID + 1;

    ChunksBuffered++;

    FetchTimer = setTimeout(FetchNextChunk, 700);
    ProcessQueue();
  }
  else
  {
    FetchTimer = setTimeout(FetchNextChunk, 300);
  }
}

function UpdateConnectedUsers()
{
  api.get('/video/'+Route.params.username, { params: { 'ConnectedUsers': true } }).then(response => {
    if(response.status == 401)
    {
      localStorage.removeItem('AuthToken');
      window.location.reload();
    }

    ConnectedUsers.value = response.data.Total;
  });
}

onMounted(() => {
  mediaSource = new MediaSource();
  VideoPlayer.value.src = URL.createObjectURL(mediaSource);

  ConnectedUsersTimer = setInterval(UpdateConnectedUsers, 1000);

  mediaSource.onsourceopen = () => {
    if(sourceBuffer) return;

    FetchNextChunk();
  }
});

onUnmounted(() => {
  if(FetchTimer)
  {
    clearInterval(FetchTimer);
    clearInterval(ConnectedUsersTimer);
  }
});

</script>

<template>
  <div id="ScreenShare">
    <div id="VideoContainer">
      <video ref="VideoPlayer" id="Video" autoplay controls></video>
    </div>

    <div id="UsersCounter">
      <q-icon name="groups" size="32px"></q-icon>

      <div id="UsersCounterNumber">
        {{ ConnectedUsers }}
      </div>
    </div>
  </div>
</template>

<style lang="css" scoped>
#ScreenShare {
  width: 100%;
  display: flex;
  padding: 20px;
  border-style: solid;
  border-width: 0 1px 0 0;
  border-color: rgba(200, 200, 200, 0.1);
  align-items: center;
  flex-direction: column;
  gap: 10px;
}

#ScreenShare #VideoContainer {
  width: 100%;
  max-width: 2140px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 15px rgba(0,0,0,0.3);
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 1;
}

#ScreenShare #VideoContainer #Video {
  width: 100%;
}

#ScreenShare #VideoContainer #Video:fullscreen {
  width: 100vw;
  height: 100vh;
  object-fit: fill;
}

#ScreenShare #UsersCounter {
  width: 100%;
  max-width: 2140px;
  padding: 0 10px;
  justify-content: right;
  align-items: center;
  display: flex;
  gap: 8px;
  font-size: 1.2em;
  font-weight: bold;
}
</style>
