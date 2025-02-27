import { mkdirSync } from 'fs';
import { writeFile, stat as fsStat } from 'fs/promises';
import path, { join } from 'path';
import { Readable } from 'stream';
import { describe, expect, it, beforeAll } from 'vitest';

import { MurfVoice } from './index';

describe('MurfVoice', () => {
  const voice = new MurfVoice({
    speechModel: {
      name: 'GEN2',
    },
    speaker: 'en-US-natalie',
  });

  const outputDir = path.join(process.cwd(), 'test-outputs');
  beforeAll(() => {
    // Create output directory if it doesn't exist
    try {
      mkdirSync(outputDir, { recursive: true });
    } catch (err) {
      console.error(`Failed to create output directory: ${err}`);
    }
  });

  it('should list available speakers', async () => {
    const speakers = await voice.getSpeakers();
    expect(speakers.length).toBeGreaterThan(0);
    expect(speakers[0]).toHaveProperty('voiceId');
  });

  it('should generate audio from text', async () => {
    const audioStream = await voice.speak('Hello world!!!');
    expect(audioStream).toHaveProperty('pipe');

    // Collect the audio data
    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.from(chunk));
    }
    const audioBuffer = Buffer.concat(chunks);
    expect(audioBuffer.length).toBeGreaterThan(0);

    // Write the audio to a file
    const outputPath = join(outputDir, 'test-audio.mp3');
    await writeFile(outputPath, audioBuffer);
  });

  it('should handle stream input', async () => {
    // Create a readable stream from text
    const textStream = Readable.from(['Hello', ' from', ' stream', ' input!']);

    const audioStream = await voice.speak(textStream);
    expect(audioStream).toHaveProperty('pipe');

    // Write the audio to a file using pipe
    const outputPath = join(outputDir, 'test-audio-stream.mp3');

    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.from(chunk));
    }
    const audioBuffer = Buffer.concat(chunks);
    await writeFile(outputPath, audioBuffer);
    const stats = await fsStat(outputPath);
    expect(stats.size).toBeGreaterThan(0);
  });

  it('should work with default configuration', async () => {
    // Create instance with no args
    const defaultVoice = new MurfVoice();

    // Should use default model name and get API key from env
    const audioStream = await defaultVoice.speak('Testing default configuration');
    expect(audioStream).toHaveProperty('pipe');

    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.from(chunk));
    }
    const audioBuffer = Buffer.concat(chunks);

    await writeFile(join(outputDir, 'murf-default-config-output.mp3'), audioBuffer);
    expect(audioBuffer.length).toBeGreaterThan(0);

    // Verify default speaker was used
    const speakers = await defaultVoice.getSpeakers();
    expect(speakers.length).toBeGreaterThan(0);
  });

  it('should throw error for speech recognition', async () => {
    const audioStream = Readable.from(Buffer.from('dummy audio data'));
    await expect(voice.listen(audioStream)).rejects.toThrow('Murf does not support speech recognition');
  });
});
