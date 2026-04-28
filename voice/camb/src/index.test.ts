import { mkdirSync } from 'node:fs';
import { writeFile, stat as fsStat } from 'node:fs/promises';
import path, { join } from 'node:path';
import { Readable } from 'node:stream';
import { describe, expect, it, beforeAll } from 'vitest';

import { CambVoice } from './index';

describe('CambVoice', () => {
  // Using mars-pro as default since mars-flash has intermittent backend issues
  const voice = new CambVoice({
    speechModel: {
      name: 'mars-pro',
    },
  });

  const outputDir = path.join(process.cwd(), 'test-outputs');

  beforeAll(() => {
    mkdirSync(outputDir, { recursive: true });
  });

  it('should list available speakers', async () => {
    const speakers = await voice.getSpeakers();
    expect(speakers.length).toBeGreaterThan(0);
    expect(speakers[0]).toHaveProperty('voiceId');
    expect(speakers[0]).toHaveProperty('name');
    expect(speakers[0]).toHaveProperty('gender');
    expect(speakers[0]).toHaveProperty('age');
    expect(speakers[0]).toHaveProperty('language');
  }, 30000);

  it('should generate audio from text', async () => {
    const audioStream = await voice.speak('Hello world! This is a test of the Camb AI voice integration.');
    expect(audioStream).toHaveProperty('pipe');

    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.from(chunk));
    }
    const audioBuffer = Buffer.concat(chunks);
    expect(audioBuffer.length).toBeGreaterThan(44); // At least WAV header size

    // Verify WAV header
    expect(audioBuffer.toString('ascii', 0, 4)).toBe('RIFF');
    expect(audioBuffer.toString('ascii', 8, 12)).toBe('WAVE');

    const outputPath = join(outputDir, 'camb-test-audio.wav');
    await writeFile(outputPath, audioBuffer);

    const stats = await fsStat(outputPath);
    expect(stats.size).toBeGreaterThan(44);
  }, 30000);

  it('should handle stream input', async () => {
    const textStream = Readable.from(['Hello', ' from', ' stream', ' input!']);

    const audioStream = await voice.speak(textStream);
    expect(audioStream).toHaveProperty('pipe');

    const outputPath = join(outputDir, 'camb-test-audio-stream.wav');

    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.from(chunk));
    }
    const audioBuffer = Buffer.concat(chunks);
    expect(audioBuffer.length).toBeGreaterThan(44);

    // Verify WAV header
    expect(audioBuffer.toString('ascii', 0, 4)).toBe('RIFF');
    expect(audioBuffer.toString('ascii', 8, 12)).toBe('WAVE');

    await writeFile(outputPath, audioBuffer);

    const stats = await fsStat(outputPath);
    expect(stats.size).toBeGreaterThan(44);
  }, 30000);

  it('should work with default configuration', async () => {
    const defaultVoice = new CambVoice();

    const audioStream = await defaultVoice.speak('Testing default configuration with Camb AI.');
    expect(audioStream).toHaveProperty('pipe');

    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.from(chunk));
    }
    const audioBuffer = Buffer.concat(chunks);

    await writeFile(join(outputDir, 'camb-default-config-output.wav'), audioBuffer);
    expect(audioBuffer.length).toBeGreaterThan(44);
  }, 30000);

  it('should work with mars-pro model', async () => {
    const proVoice = new CambVoice({
      speechModel: {
        name: 'mars-pro',
      },
    });

    const audioStream = await proVoice.speak('Testing with mars-pro model at higher sample rate.');
    expect(audioStream).toHaveProperty('pipe');

    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.from(chunk));
    }
    const audioBuffer = Buffer.concat(chunks);

    // Verify sample rate in WAV header (bytes 24-27)
    const sampleRate = audioBuffer.readUInt32LE(24);
    expect(sampleRate).toBe(48000);

    await writeFile(join(outputDir, 'camb-mars-pro-output.wav'), audioBuffer);
  }, 30000);

  it('should work with mars-instruct model and user instructions', async () => {
    const instructVoice = new CambVoice({
      speechModel: {
        name: 'mars-instruct',
      },
    });

    const audioStream = await instructVoice.speak('Hello! How are you doing today?', {
      userInstructions: 'Speak in a friendly and cheerful tone',
    });
    expect(audioStream).toHaveProperty('pipe');

    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.from(chunk));
    }
    const audioBuffer = Buffer.concat(chunks);

    await writeFile(join(outputDir, 'camb-mars-instruct-output.wav'), audioBuffer);
    expect(audioBuffer.length).toBeGreaterThan(44);
  }, 60000);

  it('should throw error for text that is too short', async () => {
    await expect(voice.speak('Hi')).rejects.toThrow('Text must be between 3 and 3000 characters');
  });

  it('should throw error for text that is too long', async () => {
    const longText = 'a'.repeat(3001);
    await expect(voice.speak(longText)).rejects.toThrow('Text must be between 3 and 3000 characters');
  });

  it('should return disabled listener', async () => {
    const listener = await voice.getListener();
    expect(listener).toEqual({ enabled: false });
  });

  it('should throw error for speech recognition', async () => {
    const audioStream = Readable.from(Buffer.from('dummy audio data'));
    await expect(voice.listen(audioStream)).rejects.toThrow('Camb AI does not support speech recognition');
  });
});
