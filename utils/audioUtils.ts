
export function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function pcmToWavBlob(pcmData: Uint8Array, sampleRate: number = 24000): Promise<Blob> {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  // RIFF identifier
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + pcmData.length, true); // file length - 8
  view.setUint32(8, 0x57415645, false); // "WAVE"

  // FMT chunk
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true); // length of fmt chunk
  view.setUint16(20, 1, true); // format (1 = PCM)
  view.setUint16(22, 1, true); // channels (1 = mono)
  view.setUint32(24, sampleRate, true); // sample rate
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample

  // Data chunk
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, pcmData.length, true); // data length

  const blob = new Blob([header, pcmData], { type: 'audio/wav' });
  return blob;
}

export async function playPcm(pcmData: Uint8Array, audioContext: AudioContext, sampleRate: number = 24000) {
  const dataInt16 = new Int16Array(pcmData.buffer);
  const buffer = audioContext.createBuffer(1, dataInt16.length, sampleRate);
  const channelData = buffer.getChannelData(0);
  
  for (let i = 0; i < dataInt16.length; i++) {
    channelData[i] = dataInt16[i] / 32768.0;
  }

  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.connect(audioContext.destination);
  source.start();
  return source;
}
