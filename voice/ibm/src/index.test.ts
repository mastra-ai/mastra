import { createWriteStream, createReadStream } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import { writeFile, readFile, stat as fsStat } from 'fs/promises';

import { IbmVoice } from './index';

describe('IbmVoice', () => {
  const voice = new IbmVoice({
    model: {
      voice: 'en-US_AllisonV3Voice',
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

  it('should transcribe audio', async () => {
    const audioPath = join(__dirname, '../test-outputs', 'test-audio.mp3');
    const audioBuffer = await readFile(audioPath);
    const result = await voice.transcribe({ audio: audioBuffer });
    expect(result).toBe('Hello world');
  });

  it('should stream transcription', async () => {
    const audioPath = join(__dirname, '../test-outputs', 'test-audio.mp3');
    const audioStream = createReadStream(audioPath);
    const result = await voice.transcribeStream({ audio: audioStream });

    let transcription = '';
    for await (const chunk of result) {
      transcription += chunk;
    }
    expect(transcription).toBe('Hello world');
  });
});
