import { join } from 'path';
import { describe, expect, it } from 'vitest';

import { writeFile } from 'fs/promises';

import { IbmTTS } from './index';

describe('IbmTTS', () => {
  const tts = new IbmTTS({
    model: {
      voice: 'en-US_AllisonV3Voice',
    },
  });

  it('should list available voices', async () => {
    const voices = await tts.voices();
    expect(voices).toBeInstanceOf(Array);
    expect(voices.length).toBeGreaterThan(0);
    expect(voices[0]).toHaveProperty('voice_id');
  });

  it('should generate audio content', async () => {
    const result = await tts.generate({ text: 'Hello world' });
    expect(result).toHaveProperty('audioResult');
    expect(Buffer.isBuffer(result.audioResult)).toBe(true);

    // Write the audio to a file
    const outputPath = join(__dirname, '..', 'test-output', 'test-audio.mp3');
    await writeFile(outputPath, result.audioResult);
    console.log(`Audio file written to: ${outputPath}`);
  });

  it('should stream audio content', async () => {
    const result = await tts.stream({ text: 'Hello world' });
    expect(result).toHaveProperty('audioResult');
    expect(result.audioResult).toHaveProperty('pipe');
  });
});
