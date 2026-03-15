const MU_LAW_TABLE = new Int16Array(256);
for (let i = 0; i < 256; i++) {
  let MU = ~i;
  let Sign = (MU & 0x80);
  let Exponent = (MU >> 4) & 0x07;
  let Mantissa = MU & 0x0F;
  let Sample = (Mantissa << 3) + 132;
  Sample <<= Exponent;
  Sample -= 132;
  MU_LAW_TABLE[i] = (Sign !== 0) ? -Sample : Sample;
}

class PlaybackProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.Buffer = [];
    this.IsReady = false;
    this.LastSample = 0;

    this.port.onmessage = (event) => {
      let Data = new Uint8Array(event.data);

      for(let i = 0; i < Data.length; i++)
      {
        this.Buffer.push(MU_LAW_TABLE[Data[i]] / 32768);
      }

      if(!this.IsReady && this.Buffer.length >= 4800)
      {
        this.IsReady = true;
      }


    };
  }

  process(inputs, outputs) {
    const Output = outputs[0];
    const Channel = Output[0];

    if(!this.IsReady)
    {
      Channel.fill(0);
      return true;
    }

    for (let i = 0; i < Channel.length; i++) {
      if(this.Buffer.length > 0)
      {
        Channel[i] = this.Buffer.shift();
        this.LastSample = Channel[i];
      }
      else
      {
        this.IsReady = false;
        Channel.fill(0, i);
        this.Buffer = [];
        this.PacketCount = 0;

        for (let j = i; j < Channel.length; j++) {
          this.LastSample *= 0.9;
          Channel[j] = this.LastSample;
        }

        break;
      }
    }

    if (this.Buffer.length > 16000) {
        this.Buffer = this.Buffer.slice(-3200);
    }

    return true;
  }
}

registerProcessor('playback-processor', PlaybackProcessor);
