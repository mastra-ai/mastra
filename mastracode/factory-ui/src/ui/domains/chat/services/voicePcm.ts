const TARGET_SAMPLE_RATE = 16_000;
const CHUNKS_PER_SECOND = 10;

export interface PcmEncoder {
  readonly sampleRate: number;
  push(samples: Float32Array): string[];
  flush(): string | undefined;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function toInt16(sample: number): number {
  const clamped = Math.max(-1, Math.min(1, sample));
  return Math.round(clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff);
}

export function createPcmEncoder(inputSampleRate: number): PcmEncoder {
  const sampleRate = Math.min(inputSampleRate, TARGET_SAMPLE_RATE);
  const inputPerOutput = inputSampleRate / sampleRate;
  const samplesPerChunk = Math.round(sampleRate / CHUNKS_PER_SECOND);
  const chunk = new DataView(new ArrayBuffer(samplesPerChunk * 2));
  let filled = 0;
  let sum = 0;
  let count = 0;
  let untilNextOutput = inputPerOutput;

  return {
    sampleRate,
    push(samples) {
      const ready: string[] = [];
      for (const sample of samples) {
        sum += sample;
        count += 1;
        untilNextOutput -= 1;
        if (untilNextOutput > 0) continue;
        untilNextOutput += inputPerOutput;
        chunk.setInt16(filled * 2, toInt16(sum / count), true);
        sum = 0;
        count = 0;
        filled += 1;
        if (filled === samplesPerChunk) {
          ready.push(toBase64(new Uint8Array(chunk.buffer, 0, filled * 2)));
          filled = 0;
        }
      }
      return ready;
    },
    flush() {
      if (filled === 0) return undefined;
      const rest = toBase64(new Uint8Array(chunk.buffer, 0, filled * 2));
      filled = 0;
      return rest;
    },
  };
}
