class RecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.Phase = 0;
    this.Threshold = 0.0025;
  }

  process(Inputs) {
    const Input = Inputs[0][0];
    if(Input && Input.length > 0)
    {
      let Sum = 0;

      for (let i = 0; i < Input.length; i++) {
        Sum += Input[i] * Input[i];
      }

      const RMS = Math.sqrt(Sum / Input.length);

      if (RMS > this.Threshold)
      {
        const Downsampled = [];
        for (let i = 0; i < Input.length; i++) {
          this.Phase++;
          if (this.Phase >= 3) {
            Downsampled.push(Input[i]);
            this.Phase = 0;
          }
        }
        this.port.postMessage({ RecordingData: Downsampled, Speaking: true });
      }
      else
      {
        this.port.postMessage({ RecordingData: [], Speaking: false });
      }
    }
    return true;
  }
}
registerProcessor('recorder-processor', RecorderProcessor);
