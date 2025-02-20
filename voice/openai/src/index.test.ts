import { createWriteStream, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { PassThrough } from 'stream';
import { describe, expect, it, beforeAll } from 'vitest';

import { OpenAIVoice } from './index.js';

describe('OpenAIVoice Integration Tests', () => {
  let voice: OpenAIVoice;
  const outputDir = path.join(process.cwd(), 'test-outputs');

  beforeAll(() => {
    // Create output directory if it doesn't exist
    try {
      mkdirSync(outputDir, { recursive: true });
    } catch (err) {
      // Ignore if directory already exists
    }

    voice = new OpenAIVoice({
      model: {
        name: 'tts-1',
      },
    });
  });

  describe('voices', () => {
    it('should list available voices', async () => {
      const voices = await voice.voices();
      expect(voices).toEqual([
        { voice_id: 'alloy' },
        { voice_id: 'echo' },
        { voice_id: 'fable' },
        { voice_id: 'onyx' },
        { voice_id: 'nova' },
        { voice_id: 'shimmer' },
      ]);
    });
  });

  describe('speech', () => {
    it('should generate audio and save to file', async () => {
      const { audioResult } = await voice.speech({
        text: 'Hello World',
        voice: 'alloy',
      });

      expect(Buffer.isBuffer(audioResult)).toBeTruthy();
      expect(audioResult.length).toBeGreaterThan(0);

      const outputPath = path.join(outputDir, 'speech-test.mp3');
      writeFileSync(outputPath, audioResult);
    }, 10000);

    it('should work with different parameters', async () => {
      const { audioResult } = await voice.speech({
        text: 'Test with parameters',
        voice: 'nova',
        speed: 1.5,
      });

      expect(Buffer.isBuffer(audioResult)).toBeTruthy();

      const outputPath = path.join(outputDir, 'speech-test-params.mp3');
      writeFileSync(outputPath, audioResult);
    }, 10000);
  });

  describe('speechStream', () => {
    it('should stream audio to file', async () => {
      const { audioResult } = await voice.speechStream({
        text: 'Test streaming',
        voice: 'alloy',
      });

      return new Promise((resolve, reject) => {
        const outputPath = path.join(outputDir, 'speech-stream-test.mp3');
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
        voice: 'nova',
        speed: 1.2,
      });

      return new Promise((resolve, reject) => {
        const outputPath = path.join(outputDir, 'speech-stream-test-params.mp3');
        const fileStream = createWriteStream(outputPath);

        audioResult.pipe(fileStream);

        fileStream.on('finish', resolve);
        audioResult.on('error', reject);
        fileStream.on('error', reject);
      });
    }, 10000);
  });

  describe('transcribe', () => {
    it('should transcribe audio', async () => {
      // Use a generated audio file for transcription
      const { audioResult } = await voice.speech({
        text: 'This is a test for transcription',
        voice: 'alloy',
      });

      const result = await voice.transcribe({ audio: audioResult });
      expect(result).toHaveProperty('text');
      expect(typeof result.text).toBe('string');
      expect(result.text.toLowerCase()).toContain('test');
    }, 15000);
  });

  describe('transcribeStream', () => {
    it('should transcribe streaming audio', async () => {
      const { audioResult } = await voice.speech({
        text: 'This is a streaming transcription test',
        voice: 'alloy',
      });

      const stream = new PassThrough();
      stream.end(audioResult);

      const resultStream = await voice.transcribeStream({ audio: stream });

      // Read the stream data
      const chunks: Buffer[] = [];
      for await (const chunk of resultStream) {
        chunks.push(Buffer.from(chunk));
      }

      const text = Buffer.concat(chunks).toString();
      expect(typeof text).toBe('string');
      expect(text.toLowerCase()).toContain('test');
    }, 15000);
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
          voice: 'alloy',
        }),
      ).rejects.toThrow();
    });

    it('should handle invalid audio data for transcription', async () => {
      await expect(voice.transcribe({ audio: Buffer.from('') })).rejects.toThrow();
    });
  });
});
