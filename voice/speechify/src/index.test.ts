import { createWriteStream, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { PassThrough, Readable } from 'stream';
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
      speechModel: {
        name: 'simba-multilingual',
      },
      speaker: 'george',
    });
  });

  describe('voices', () => {
    it('should list available voices', async () => {
      const voices = await voice.getSpeakers();
      expect(voices).toBeInstanceOf(Array);
      expect(voices.length).toBeGreaterThan(0);
      expect(voices[0]).toHaveProperty('voiceId');
    });
  });

  describe('speech', () => {
    it('should generate audio and save to file from text input', async () => {
      const result = await voice.speak('Hello from Mastra Voice - Speechify');
      const outputPath = path.join(outputDir, 'speechify-speech-test.mp3');
      const chunks: Buffer[] = [];
      for await (const chunk of result) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      const audioBuffer = Buffer.concat(chunks);
      expect(audioBuffer.length).toBeGreaterThan(0);
      writeFileSync(outputPath, audioBuffer);
    }, 10000);

    it('should work with different parameters', async () => {
      const result = await voice.speak('Test with parameters', { speaker: 'george' });
      const chunks: Buffer[] = [];
      for await (const chunk of result) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const audioBuffer = Buffer.concat(chunks);
      const outputPath = path.join(outputDir, 'speechify-speech-test-params.mp3');
      writeFileSync(outputPath, audioBuffer);
    }, 10000);

    it('should generate audio from a stream input', async () => {
      const inputStream = Readable.from(['Hello from stream input - Speechify']);
      const result = await voice.speak(inputStream);
      const chunks: Buffer[] = [];
      for await (const chunk of result) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      const audioBuffer = Buffer.concat(chunks);
      expect(audioBuffer.length).toBeGreaterThan(0);
      const outputPath = path.join(outputDir, 'speechify-speech-test-stream.mp3');
      writeFileSync(outputPath, audioBuffer);
    }, 10000);

    it('should generate audio using default SpeechifyVoice instance', async () => {
      const defaultVoice = new SpeechifyVoice();
      const result = await defaultVoice.speak('Hello from default SpeechifyVoice instance');
      const chunks: Buffer[] = [];
      for await (const chunk of result) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      const audioBuffer = Buffer.concat(chunks);
      expect(audioBuffer.length).toBeGreaterThan(0);
      const outputPath = path.join(outputDir, 'speechify-speech-test-default.mp3');
      writeFileSync(outputPath, audioBuffer);
    }, 10000);
  });

  // Error cases
  describe('error handling', () => {
    it('should handle empty text', async () => {
      await expect(voice.speak('')).rejects.toThrow();
    });

    it('should handle invalid voice', async () => {
      await expect(voice.speak('Test', { speaker: 'invalid_voice' })).rejects.toThrow();
    });
  });
});
