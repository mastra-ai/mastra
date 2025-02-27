import { writeFile } from 'fs/promises';
import { join } from 'path';
import { PassThrough } from 'stream';
import { describe, expect, it } from 'vitest';

import { ReplicateTTS } from './index';

describe('ReplicateTTS', () => {
  const MODEL_ID = 'jaaari/kokoro-82m:dfdf537ba482b029e0a761699e6f55e9162cfd159270bfe0e44857caa5f275a6';

  it('should return a list of available voices', async () => {
    const tts = new ReplicateTTS({ model: { name: MODEL_ID } });
    const voices = await tts.voices();
    expect(voices.length).toBe(1);
    expect(voices[0]).toHaveProperty('voice_id', 'default');
  });

  it('should generate audio content', async () => {
    const tts = new ReplicateTTS({ model: { name: MODEL_ID } });
    const result = await tts.generate({ text: 'Hello from Mastra T T S - Replicate' });

    // Write the audio to a file
    const outputPath = join(__dirname, '../test-outputs', 'test-audio.mp3');
    await writeFile(outputPath, result.audioResult);

    expect(result).toHaveProperty('audioResult');
    expect(Buffer.isBuffer(result.audioResult)).toBe(true);
  }, 50000);

  it('should stream audio content', async () => {
    const tts = new ReplicateTTS({ model: { name: MODEL_ID } });
    const result = await tts.stream({ text: 'Hello' });

    expect(result).toHaveProperty('audioResult');
    expect(result.audioResult).toBeInstanceOf(PassThrough);
  });
});
