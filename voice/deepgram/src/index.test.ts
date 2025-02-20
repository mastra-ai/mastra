import { createWriteStream, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { describe, expect, it, beforeAll } from 'vitest';

import { DeepgramVoice } from './index.js';

describe('DeepgramVoice Integration Tests', () => {
  let voice: DeepgramVoice;
  const outputDir = path.join(process.cwd(), 'test-outputs');

  beforeAll(() => {
    // Create output directory if it doesn't exist
    try {
      mkdirSync(outputDir, { recursive: true });
    } catch (err) {
      // Ignore if directory already exists
    }

    voice = new DeepgramVoice({
      model: {
        name: 'aura',
      },
    });
  });

  describe('voices', () => {
    it('should list available voices', async () => {
      const voices = await voice.voices();
      expect(voices).toEqual([
        { voice_id: 'asteria-en', name: 'asteria-en', language: 'en', gender: 'neutral' },
        { voice_id: 'luna-en', name: 'luna-en', language: 'en', gender: 'neutral' },
        { voice_id: 'stella-en', name: 'stella-en', language: 'en', gender: 'neutral' },
        { voice_id: 'athena-en', name: 'athena-en', language: 'en', gender: 'neutral' },
        { voice_id: 'hera-en', name: 'hera-en', language: 'en', gender: 'neutral' },
        { voice_id: 'orion-en', name: 'orion-en', language: 'en', gender: 'neutral' },
        { voice_id: 'arcas-en', name: 'arcas-en', language: 'en', gender: 'neutral' },
        { voice_id: 'perseus-en', name: 'perseus-en', language: 'en', gender: 'neutral' },
        { voice_id: 'angus-en', name: 'angus-en', language: 'en', gender: 'neutral' },
        { voice_id: 'orpheus-en', name: 'orpheus-en', language: 'en', gender: 'neutral' },
        { voice_id: 'helios-en', name: 'helios-en', language: 'en', gender: 'neutral' },
        { voice_id: 'zeus-en', name: 'zeus-en', language: 'en', gender: 'neutral' },
      ]);
    });
  });

  describe('speech', () => {
    it('should generate audio and save to file', async () => {
      const { audioResult } = await voice.speech({
        text: 'Hello World',
        voice: 'asteria-en',
      });

      expect(Buffer.isBuffer(audioResult)).toBeTruthy();
      expect(audioResult.length).toBeGreaterThan(0);

      const outputPath = path.join(outputDir, 'deepgram-speech-test.mp3');
      writeFileSync(outputPath, audioResult);
    }, 10000);

    it('should work with different parameters', async () => {
      const { audioResult } = await voice.speech({
        text: 'Test with parameters',
        voice: 'luna-en',
        speed: 1.5,
      });

      expect(Buffer.isBuffer(audioResult)).toBeTruthy();

      const outputPath = path.join(outputDir, 'deepgram-speech-test-params.mp3');
      writeFileSync(outputPath, audioResult);
    }, 10000);
  });

  describe('speechStream', () => {
    it('should stream audio to file', async () => {
      const { audioResult } = await voice.speechStream({
        text: 'Test streaming',
        voice: 'asteria-en',
      });

      return new Promise((resolve, reject) => {
        const outputPath = path.join(outputDir, 'deepgram-speech-stream-test.mp3');
        const fileStream = createWriteStream(outputPath);
        const chunks: Buffer[] = [];

        audioResult.on('data', (chunk: Buffer) => chunks.push(chunk));
        audioResult.pipe(fileStream);

        fileStream.on('finish', () => {
          expect(chunks.length).toBeGreaterThan(0);
          resolve(undefined);
        });

        audioResult.on('error', reject);
        fileStream.on('error', reject);
      });
    }, 10000);

    it('should stream with different parameters', async () => {
      const { audioResult } = await voice.speechStream({
        text: 'Testing with different voice and speed',
        voice: 'stella-en',
        speed: 1.2,
      });

      return new Promise((resolve, reject) => {
        const outputPath = path.join(outputDir, 'deepgram-speech-stream-test-params.mp3');
        const fileStream = createWriteStream(outputPath);

        audioResult.pipe(fileStream);

        fileStream.on('finish', resolve);
        audioResult.on('error', reject);
        fileStream.on('error', reject);
      });
    }, 10000);
  });

  // Error cases
  describe('error handling', () => {
    it('should handle invalid voice names', async () => {
      await expect(
        voice.speech({
          text: 'Test',
          voice: 'invalid_voice',
        }),
      ).rejects.toThrow();
    });

    it('should handle empty text', async () => {
      await expect(
        voice.speech({
          text: '',
          voice: 'asteria-en',
        }),
      ).rejects.toThrow();
    });
  });
});
