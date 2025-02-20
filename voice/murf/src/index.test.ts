import { createWriteStream } from 'fs';
import { join } from 'path';
import { PassThrough } from 'stream';
import { describe, expect, it } from 'vitest';

import { writeFile, stat as fsStat } from 'fs/promises';

import { MurfVoice } from './index';

describe('MurfVoice', () => {
  const voice = new MurfVoice({
    model: {
      name: 'GEN2',
      voice: 'en-US-natalie',
    },
  });

  it('should list available voices', async () => {
    const voices = await voice.voices();
    expect(voices.length).toBeGreaterThan(0);
    expect(voices[0]).toHaveProperty('voice_id');
  });

  it('should generate audio content', async () => {
    const result = await voice.speech({ text: 'Hello world' });
    expect(result).toHaveProperty('audioResult');
    expect(Buffer.isBuffer(result.audioResult)).toBe(true);

    // Write the audio to a file
    const outputPath = join(__dirname, '../test-outputs', 'test-audio.mp3');
    await writeFile(outputPath, result.audioResult);
  });

  it('should stream audio content', async () => {
    const result = await voice.speechStream({ text: 'Hello world' });
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

  it('should throw error for transcribe', async () => {
    await expect(voice.transcribe({ audio: Buffer.from('test') })).rejects.toThrow(
      'Murf does not support speech-to-text',
    );
  });

  it('should throw error for transcribeStream', async () => {
    const mockStream = new PassThrough();
    await expect(voice.transcribeStream({ audio: mockStream })).rejects.toThrow('Murf does not support speech-to-text');
  });
});
