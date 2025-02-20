import { createWriteStream, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { PassThrough } from 'stream';
import { describe, expect, it, beforeAll } from 'vitest';

import { ReplicateVoice } from './index';

describe('ReplicateVoice Integration Tests', () => {
  let voice: ReplicateVoice;
  const MODEL_ID = 'jaaari/kokoro-82m:dfdf537ba482b029e0a761699e6f55e9162cfd159270bfe0e44857caa5f275a6';
  const outputDir = join(process.cwd(), 'test-outputs');

  beforeAll(() => {
    // Create output directory if it doesn't exist
    try {
      mkdirSync(outputDir, { recursive: true });
    } catch (err) {
      // Ignore if directory already exists
    }

    voice = new ReplicateVoice({
      model: {
        name: MODEL_ID,
      },
    });
  });

  describe('voices', () => {
    it('should return a list of available voices', async () => {
      const voices = await voice.voices();
      expect(voices.length).toBe(1);
      expect(voices[0]).toHaveProperty('voice_id', 'default');
    });
  });

  describe('speech', () => {
    it('should generate audio and save to file', async () => {
      const result = await voice.speech({ text: 'Hello from Mastra Voice - Replicate' });

      expect(result).toHaveProperty('audioResult');
      expect(Buffer.isBuffer(result.audioResult)).toBe(true);

      const outputPath = join(outputDir, 'replicate-speech-test.mp3');
      writeFileSync(outputPath, result.audioResult);
    }, 50000);
  });

  describe('speechStream', () => {
    it('should stream audio to file', async () => {
      const result = await voice.speechStream({ text: 'Test streaming with Replicate' });

      return new Promise((resolve, reject) => {
        const outputPath = join(outputDir, 'replicate-stream-test.mp3');
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
    }, 50000);
  });

  describe('transcribe', () => {
    it('should transcribe audio', async () => {
      // Use a generated audio file for transcription
      const { audioResult } = await voice.speech({
        text: 'This is a test for transcription with Replicate',
      });

      const result = await voice.transcribe({ audio: audioResult });
      expect(result).toHaveProperty('text');
      expect(typeof result.text).toBe('string');
      expect(result.text.toLowerCase()).toContain('test');
    }, 50000);
  });

  describe('transcribeStream', () => {
    it('should transcribe streaming audio', async () => {
      // Create a test audio stream
      const audioStream = new PassThrough();
      const { audioResult } = await voice.speech({
        text: 'This is a streaming transcription test with Replicate',
      });
      audioStream.end(audioResult);

      const textStream = await voice.transcribeStream({ audio: audioStream });
      const chunks: Buffer[] = [];

      await new Promise((resolve, reject) => {
        textStream.on('data', (chunk: Buffer) => chunks.push(chunk));
        textStream.on('end', resolve);
        textStream.on('error', reject);
      });

      const text = Buffer.concat(chunks).toString();
      expect(typeof text).toBe('string');
      expect(text.toLowerCase()).toContain('test');
    }, 50000);
  });

  // Error cases
  describe('error handling', () => {
    it('should handle empty text', async () => {
      await expect(
        voice.speech({
          text: '',
        }),
      ).rejects.toThrow();
    });

    it('should handle invalid audio data for transcription', async () => {
      await expect(voice.transcribe({ audio: Buffer.from('') })).rejects.toThrow();
    });
  });
});
