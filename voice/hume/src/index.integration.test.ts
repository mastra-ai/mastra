import { createWriteStream, mkdirSync } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { describe, expect, it, beforeAll } from 'vitest';

import { HumeVoice } from './index.js';

describe('HumeVoice Integration Tests', () => {
  let voice: HumeVoice;
  const outputDir = path.join(process.cwd(), 'test-outputs');

  beforeAll(() => {
    mkdirSync(outputDir, { recursive: true });

    voice = new HumeVoice();
  });

  describe('getSpeakers', () => {
    it('should list available speakers', async () => {
      const speakers = await voice.getSpeakers();
      expect(speakers.length).toBeGreaterThan(0);
      expect(speakers[0]).toHaveProperty('voiceId');
    }, 15000);
  });

  describe('speak', () => {
    it('should speak with default values and produce audio', async () => {
      const defaultVoice = new HumeVoice();
      const audioStream = await defaultVoice.speak('Hello, this is a test.');

      return new Promise<void>((resolve, reject) => {
        const outputPath = path.join(outputDir, 'hume-speech-default.mp3');
        const fileStream = createWriteStream(outputPath);
        const chunks: Buffer[] = [];

        audioStream.on('data', (chunk: Buffer) => chunks.push(chunk));
        audioStream.pipe(fileStream);

        fileStream.on('finish', () => {
          expect(chunks.length).toBeGreaterThan(0);
          resolve();
        });

        audioStream.on('error', reject);
        fileStream.on('error', reject);
      });
    }, 15000);

    it('should generate audio with a specific speaker', async () => {
      const speakers = await voice.getSpeakers();
      expect(speakers.length).toBeGreaterThan(0);
      const speaker = speakers[0].name ?? speakers[0].voiceId;
      const provider = speakers[0].provider;

      const audioStream = await voice.speak('Hello World', { speaker, provider });

      return new Promise<void>((resolve, reject) => {
        const outputPath = path.join(outputDir, 'hume-speech-speaker.mp3');
        const fileStream = createWriteStream(outputPath);
        const chunks: Buffer[] = [];

        audioStream.on('data', (chunk: Buffer) => chunks.push(chunk));
        audioStream.pipe(fileStream);

        fileStream.on('finish', () => {
          expect(chunks.length).toBeGreaterThan(0);
          resolve();
        });

        audioStream.on('error', reject);
        fileStream.on('error', reject);
      });
    }, 15000);

    it('should support wav output format', async () => {
      const audioStream = await voice.speak('Testing wav format', {
        format: { type: 'wav' },
      });

      return new Promise<void>((resolve, reject) => {
        const outputPath = path.join(outputDir, 'hume-speech-wav.wav');
        const fileStream = createWriteStream(outputPath);
        const chunks: Buffer[] = [];

        audioStream.on('data', (chunk: Buffer) => chunks.push(chunk));
        audioStream.pipe(fileStream);

        fileStream.on('finish', () => {
          expect(chunks.length).toBeGreaterThan(0);
          resolve();
        });

        audioStream.on('error', reject);
        fileStream.on('error', reject);
      });
    }, 15000);

    it('should support pcm output format', async () => {
      const audioStream = await voice.speak('Testing pcm format', {
        format: { type: 'pcm' },
      });

      return new Promise<void>((resolve, reject) => {
        const outputPath = path.join(outputDir, 'hume-speech-pcm.raw');
        const fileStream = createWriteStream(outputPath);
        const chunks: Buffer[] = [];

        audioStream.on('data', (chunk: Buffer) => chunks.push(chunk));
        audioStream.pipe(fileStream);

        fileStream.on('finish', () => {
          expect(chunks.length).toBeGreaterThan(0);
          resolve();
        });

        audioStream.on('error', reject);
        fileStream.on('error', reject);
      });
    }, 15000);

    it('should accept a ReadableStream as input', async () => {
      const textStream = Readable.from('Hello from a stream');
      const audioStream = await voice.speak(textStream);

      return new Promise<void>((resolve, reject) => {
        const outputPath = path.join(outputDir, 'hume-speech-stream-input.mp3');
        const fileStream = createWriteStream(outputPath);
        const chunks: Buffer[] = [];

        audioStream.on('data', (chunk: Buffer) => chunks.push(chunk));
        audioStream.pipe(fileStream);

        fileStream.on('finish', () => {
          expect(chunks.length).toBeGreaterThan(0);
          resolve();
        });

        audioStream.on('error', reject);
        fileStream.on('error', reject);
      });
    }, 15000);

    it('should throw on empty text', async () => {
      await expect(voice.speak('')).rejects.toThrow('Input text is empty');
    });
  });

  describe('listen', () => {
    it('should throw since Hume does not support speech-to-text', async () => {
      const audioStream = Readable.from(Buffer.from('dummy'));
      await expect(voice.listen(audioStream)).rejects.toThrow('Hume does not support speech recognition');
    });
  });

  describe('getListener', () => {
    it('should return enabled: false', async () => {
      const result = await voice.getListener();
      expect(result).toEqual({ enabled: false });
    });
  });
});
