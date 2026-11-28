import { describe, expect, it } from 'vitest';

import { createPcmEncoder } from '../voicePcm';

function samples(base64: string): number[] {
  const bytes = Buffer.from(base64, 'base64');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return Array.from({ length: bytes.byteLength / 2 }, (_, i) => view.getInt16(i * 2, true));
}

describe('createPcmEncoder', () => {
  it('sends a 48 kHz microphone as 16 kHz chunks of 100 ms', () => {
    const encoder = createPcmEncoder(48_000);

    const chunks = encoder.push(new Float32Array(48_000 / 5).fill(0.5));

    expect(encoder.sampleRate).toBe(16_000);
    expect(chunks).toHaveLength(2);
    expect(chunks.map(chunk => samples(chunk).length)).toEqual([1600, 1600]);
    expect(new Set(samples(chunks[0] ?? ''))).toEqual(new Set([Math.round(0.5 * 0x7fff)]));
    expect(encoder.flush()).toBeUndefined();
  });

  it('keeps chunk boundaries steady across uneven worklet frames from a 44.1 kHz microphone', () => {
    const encoder = createPcmEncoder(44_100);
    const chunks: string[] = [];
    for (let frame = 0; frame < 345; frame++) chunks.push(...encoder.push(new Float32Array(128)));

    const rest = encoder.flush();
    const total = chunks.reduce((sum, chunk) => sum + samples(chunk).length, 0) + samples(rest ?? '').length;

    expect(chunks.every(chunk => samples(chunk).length === 1600)).toBe(true);
    expect(Math.abs(total - Math.round((345 * 128 * 16_000) / 44_100))).toBeLessThanOrEqual(1);
  });

  it('averages each group of input samples, clamps out-of-range input, and encodes little-endian 16-bit', () => {
    const encoder = createPcmEncoder(48_000);

    encoder.push(Float32Array.from([1, 1, 1, -2, -2, -2, 0.25, -0.25, 0]));

    expect(samples(encoder.flush() ?? '')).toEqual([0x7fff, -0x8000, 0]);
  });

  it('keeps a slow microphone at its own rate instead of inventing samples', () => {
    const encoder = createPcmEncoder(8_000);

    expect(encoder.sampleRate).toBe(8_000);
    expect(encoder.push(new Float32Array(800))).toHaveLength(1);
  });

  it('sends the unfinished last chunk when dictation stops', () => {
    const encoder = createPcmEncoder(16_000);
    encoder.push(new Float32Array(250));

    expect(samples(encoder.flush() ?? '')).toHaveLength(250);
    expect(encoder.flush()).toBeUndefined();
  });
});
