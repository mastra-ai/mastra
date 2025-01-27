import { createWriteStream } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import { writeFile } from 'fs/promises';

import { SpeechifyTTS } from './index';

describe('SpeechifyTTS', () => {
  const tts = new SpeechifyTTS({
    model: {
      name: 'simba-multilingual',
      voice: 'george',
    },
  });

  it('should list available voices', async () => {
    const voices = await tts.voices();
    expect(voices).toBeInstanceOf(Array);
    expect(voices.length).toBeGreaterThan(0);
    expect(voices[0]).toHaveProperty('voice_id');
  });

  it('should generate audio content', async () => {
    const result = await tts.generate({ text: 'Mastra T T S - Speechify' });
    expect(result).toHaveProperty('audioResult');

    expect(Buffer.isBuffer(result.audioResult)).toBe(true);

    // Write the audio to a file
    const outputPath = join(__dirname, '../test-outputs', 'test-audio.mp3');
    await writeFile(outputPath, result.audioResult);
    console.log(`Audio file written to: ${outputPath}`);
  });

  it('should stream audio content', async () => {
    const result = await tts.stream({ text: 'Hello world' });
    expect(result).toHaveProperty('audioResult');

    // Write the audio to a file using pipe
    const outputPath = join(__dirname, '../test-outputs', 'test-audio-stream.mp3');
    const writeStream = createWriteStream(outputPath);

    await new Promise((resolve, reject) => {
      result.audioResult.pipe(writeStream).on('finish', resolve).on('error', reject);
    });
  });
});
