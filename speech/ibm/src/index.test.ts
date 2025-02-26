import { createWriteStream } from 'fs';
import { writeFile, stat as fsStat } from 'fs/promises';
import { join } from 'path';
import { describe, expect, it } from 'vitest';


import { IbmTTS } from './index';

describe('IbmTTS', () => {
  const tts = new IbmTTS({
    model: {
      voice: 'en-US_AllisonV3Voice',
    },
  });

  it('should list available voices', async () => {
    const voices = await tts.voices();
    expect(voices.length).toBeGreaterThan(0);
    expect(voices[0]).toHaveProperty('voice_id');
  });

  it('should generate audio content', async () => {
    const result = await tts.generate({ text: 'Hello world' });
    expect(result).toHaveProperty('audioResult');

    const outputPath = join(__dirname, '../test-outputs', 'test-audio.mp3');
    await writeFile(outputPath, result.audioResult);
  });

  it('should stream audio content', async () => {
    const result = await tts.stream({ text: 'Hello world' });
    expect(result).toHaveProperty('audioResult');
    expect(result.audioResult).toHaveProperty('pipe');

    // Write the audio to a file using pipe
    const outputPath = join(__dirname, '../test-outputs', 'test-audio-stream.mp3');
    const writeStream = createWriteStream(outputPath);

    await new Promise((resolve, reject) => {
      result.audioResult.pipe(writeStream).on('finish', resolve).on('error', reject);
    });

    // Verify the file exists and has content
    const stats = await fsStat(outputPath);
    expect(stats.size).toBeGreaterThan(0);
  });
});
