import { createWriteStream, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { describe, expect, it, beforeAll } from 'vitest';

import { GoogleVoice } from './index';

describe('GoogleVoice Integration Tests', () => {
  let voice: GoogleVoice;
  const outputDir = join(process.cwd(), 'test-outputs');

  beforeAll(() => {
    // Create output directory if it doesn't exist
    try {
      mkdirSync(outputDir, { recursive: true });
    } catch (err) {
      console.error(err);
      // Ignore if directory already exists
    }

    voice = new GoogleVoice();
  });

  describe('getSpeakers', () => {
    it('should list available voices', async () => {
      const voices = await voice.getSpeakers();
      expect(voices.length).toBeGreaterThan(0);
      expect(voices[0]).toHaveProperty('voiceId');
      expect(voices[0]).toHaveProperty('languageCodes');
    }, 10000);
  });

  describe('speak', () => {
    it('should generate audio from text and save to file', async () => {
      const audioStream = await voice.speak('Hello World', {
        speaker: 'en-US-Standard-F',
      });

      return new Promise((resolve, reject) => {
        const outputPath = join(outputDir, 'speech-test.wav');
        const fileStream = createWriteStream(outputPath);
        const chunks: Buffer[] = [];

        audioStream.on('data', (chunk: Buffer) => chunks.push(chunk));
        audioStream.pipe(fileStream);

        fileStream.on('finish', () => {
          expect(chunks.length).toBeGreaterThan(0);
          resolve(undefined);
        });

        audioStream.on('error', reject);
        fileStream.on('error', reject);
      });
    }, 10000);

    it('should work with default voice', async () => {
      const audioStream = await voice.speak('Test with default voice');

      return new Promise((resolve, reject) => {
        const outputPath = join(outputDir, 'speech-test-default.wav');
        const fileStream = createWriteStream(outputPath);
        const chunks: Buffer[] = [];

        audioStream.on('data', (chunk: Buffer) => chunks.push(chunk));
        audioStream.pipe(fileStream);

        fileStream.on('finish', () => {
          expect(chunks.length).toBeGreaterThan(0);
          resolve(undefined);
        });

        audioStream.on('error', reject);
        fileStream.on('error', reject);
      });
    }, 10000);

    it('should handle stream input', async () => {
      const textStream = Readable.from(['Hello', ' from', ' stream', ' input!']);

      const audioStream = await voice.speak(textStream);

      return new Promise((resolve, reject) => {
        const outputPath = join(outputDir, 'speech-stream-input-test.wav');
        const fileStream = createWriteStream(outputPath);
        const chunks: Buffer[] = [];

        audioStream.on('data', (chunk: Buffer) => chunks.push(chunk));
        audioStream.pipe(fileStream);

        fileStream.on('finish', () => {
          expect(chunks.length).toBeGreaterThan(0);
          resolve(undefined);
        });

        audioStream.on('error', reject);
        fileStream.on('error', reject);
      });
    }, 10000);
  });

  describe('listen', () => {
    it('should transcribe audio stream to text', async () => {
      const audioStream = Readable.from(readFileSync(join(outputDir, 'speech-test.wav')));

      const result = await voice.listen(audioStream);
      console.log(result);
      expect(typeof result).toBe('string');
      expect(result).toContain('hello world');
    }, 10000);

    // it('should support streaming transcription', async () => {
    //   const audioStream = Readable.from(
    //     readFileSync(join(outputDir, 'speech-test.mp3'))
    //   );

    //   const outputStream = await voice.listen(audioStream, { stream: true });
    //   expect(outputStream).toBeInstanceOf(PassThrough);

    //   return new Promise((resolve, reject) => {
    //     const chunks: string[] = [];
    //     (outputStream as PassThrough).on('data', (chunk: string) => chunks.push(chunk));
    //     (outputStream as PassThrough).on('end', () => {
    //       expect(chunks.length).toBeGreaterThan(0);
    //       const transcription = chunks.join('');
    //       expect(transcription).toContain('hello world');
    //       resolve(undefined);
    //     });
    //     (outputStream as PassThrough).on('error', reject);
    //   });
    // });
  });
});
