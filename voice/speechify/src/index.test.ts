import { createWriteStream, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { PassThrough } from 'stream';
import { describe, expect, it, beforeAll } from 'vitest';

import { SpeechifyVoice } from './index';

describe('SpeechifyVoice Integration Tests', () => {
  let voice: SpeechifyVoice;
  const outputDir = path.join(process.cwd(), 'test-outputs');

  beforeAll(() => {
    // Create output directory if it doesn't exist
    try {
      mkdirSync(outputDir, { recursive: true });
    } catch (err) {
      // Ignore if directory already exists
    }

    voice = new SpeechifyVoice({
      model: {
        name: 'simba-multilingual',
        voice: 'george',
      },
    });
  });

  describe('voices', () => {
    it('should list available voices', async () => {
      const voices = await voice.voices();
      expect(voices).toBeInstanceOf(Array);
      expect(voices.length).toBeGreaterThan(0);
      expect(voices[0]).toHaveProperty('voice_id');
    });
  });

  describe('speech', () => {
    it('should generate audio and save to file', async () => {
      const result = await voice.speech({ text: 'Hello from Mastra Voice - Speechify' });

      expect(result).toHaveProperty('audioResult');
      expect(Buffer.isBuffer(result.audioResult)).toBe(true);

      const outputPath = path.join(outputDir, 'speechify-speech-test.mp3');
      writeFileSync(outputPath, result.audioResult);
    }, 10000);

    it('should work with different parameters', async () => {
      const result = await voice.speech({
        text: 'Test with parameters',
        voice: 'daniel',
      });

      expect(result).toHaveProperty('audioResult');
      expect(Buffer.isBuffer(result.audioResult)).toBe(true);

      const outputPath = path.join(outputDir, 'speechify-speech-test-params.mp3');
      writeFileSync(outputPath, result.audioResult);
    }, 10000);
  });

  describe('speechStream', () => {
    it('should stream audio to file', async () => {
      const result = await voice.speechStream({ text: 'Test streaming with Speechify' });

      return new Promise((resolve, reject) => {
        const outputPath = path.join(outputDir, 'speechify-stream-test.mp3');
        const fileStream = createWriteStream(outputPath);
        const chunks: Buffer[] = [];

        result.audioResult.on('data', (chunk: Buffer) => chunks.push(chunk));
        result.audioResult.pipe(fileStream);

        fileStream.on('finish', () => {
          expect(chunks.length).toBeGreaterThan(0);
          resolve(undefined);
        });

        result.audioResult.on('error', reject);
        fileStream.on('error', reject);
      });
    }, 10000);

    it('should stream with different parameters', async () => {
      const result = await voice.speechStream({
        text: 'Testing with different voice and parameters',
        voice: 'daniel',
      });

      return new Promise((resolve, reject) => {
        const outputPath = path.join(outputDir, 'speechify-stream-test-params.mp3');
        const fileStream = createWriteStream(outputPath);

        result.audioResult.pipe(fileStream);

        fileStream.on('finish', resolve);
        result.audioResult.on('error', reject);
        fileStream.on('error', reject);
      });
    }, 10000);
  });

  // Error cases
  describe('error handling', () => {
    it('should handle empty text', async () => {
      await expect(voice.speech({ text: '' })).rejects.toThrow();
    });

    it('should handle invalid voice', async () => {
      await expect(
        voice.speech({
          text: 'Test',
          voice: 'invalid_voice',
        }),
      ).rejects.toThrow();
    });
  });
});
