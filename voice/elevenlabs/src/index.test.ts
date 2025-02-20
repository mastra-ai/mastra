import { createWriteStream, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { describe, expect, it, beforeAll } from 'vitest';

import { ElevenLabsVoice } from './index.js';

describe('ElevenLabsVoice Integration Tests', () => {
  let voice: ElevenLabsVoice;
  const outputDir = path.join(process.cwd(), 'test-outputs');

  beforeAll(() => {
    // Create output directory if it doesn't exist
    try {
      mkdirSync(outputDir, { recursive: true });
    } catch (err) {
      // Ignore if directory already exists
    }

    voice = new ElevenLabsVoice({
      model: {
        name: 'eleven_multilingual_v2',
      },
    });
  });

  describe('voices', () => {
    it('should list available voices', async () => {
      const voices = await voice.voices();
      expect(voices.length).toBeGreaterThan(0);
      expect(voices[0]).toHaveProperty('voice_id');
      expect(voices[0]).toHaveProperty('name');
      expect(voices[0]).toHaveProperty('language');
      expect(voices[0]).toHaveProperty('gender');
    });
  });

  describe('speech', () => {
    it('should generate audio and save to file', async () => {
      const { audioResult } = await voice.speech({
        text: 'Hello World',
        voice: (await voice.voices())[0].voice_id,
      });

      expect(Buffer.isBuffer(audioResult)).toBeTruthy();
      expect(audioResult.length).toBeGreaterThan(0);

      const outputPath = path.join(outputDir, 'elevenlabs-speech-test.mp3');
      writeFileSync(outputPath, audioResult);
    }, 10000);

    it('should work with different parameters', async () => {
      const { audioResult } = await voice.speech({
        text: 'Test with parameters',
        voice: (await voice.voices())[1]?.voice_id,
      });

      expect(Buffer.isBuffer(audioResult)).toBeTruthy();

      const outputPath = path.join(outputDir, 'elevenlabs-speech-test-params.mp3');
      writeFileSync(outputPath, audioResult);
    }, 10000);
  });

  describe('speechStream', () => {
    it('should stream audio to file', async () => {
      const { audioResult } = await voice.speechStream({
        text: 'Test streaming',
        voice: (await voice.voices())[0].voice_id,
      });

      return new Promise((resolve, reject) => {
        const outputPath = path.join(outputDir, 'elevenlabs-speech-stream-test.mp3');
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
        text: 'Testing with different voice',
        voice: (await voice.voices())[1]?.voice_id,
      });

      return new Promise((resolve, reject) => {
        const outputPath = path.join(outputDir, 'elevenlabs-speech-stream-test-params.mp3');
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
          voice: (await voice.voices())[0].voice_id,
        }),
      ).rejects.toThrow();
    });
  });
});
