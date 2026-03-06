/**
 * Generate a 44-byte WAV header for raw PCM audio data
 * @param dataLength Length of audio data in bytes
 * @param sampleRate Sample rate in Hz
 * @param numChannels Number of channels (1 for mono)
 * @param bitsPerSample Bits per sample (16 for pcm_s16le)
 */
export function generateWavHeader(
  dataLength: number,
  sampleRate: number = 22050,
  numChannels: number = 1,
  bitsPerSample: number = 16,
): Buffer {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const fileSize = 36 + dataLength;

  const header = Buffer.alloc(44);

  // RIFF chunk descriptor
  header.write('RIFF', 0);
  header.writeUInt32LE(fileSize, 4);
  header.write('WAVE', 8);

  // fmt sub-chunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);

  // data sub-chunk
  header.write('data', 36);
  header.writeUInt32LE(dataLength, 40);

  return header;
}
