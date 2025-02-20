import { createWriteStream, writeFileSync, mkdirSync, rmSync } from 'fs';
import path from 'path';
import { PassThrough } from 'stream';
import { describe, expect, it, beforeAll } from 'vitest';

import { GoogleVoice } from './index.js';

describe('GoogleVoice Integration Tests', () => {
  let voice: GoogleVoice;
  const outputDir = path.join(process.cwd(), 'test-outputs');

  beforeAll(() => {
    // Create output directory if it doesn't exist
    try {
      mkdirSync(outputDir, { recursive: true });
    } catch (err) {
      // Ignore if directory already exists
    }

    voice = new GoogleVoice({
      model: {
        name: 'en-US-Casual-K',
      },
    });
  });

  // afterAll(() => {
  //   // Delete output directory after tests are done
  //   try {
  //     rmSync(outputDir, { recursive: true });
  //   } catch (err) {
  //     // Ignore if directory doesn't exist
  //   }
  // });

  describe('voices', () => {
    it('should list available voices', async () => {
      const voices = await voice.voices();
      expect(voices.length).toBeGreaterThan(0);
      expect(voices[0]).toHaveProperty('voice_id');
    });
  });

  describe('speech', () => {
    it('should generate audio and save to file', async () => {
      const { audioResult } = await voice.speech({
        text: 'Hello World',
        voice: 'en-US-Casual-K',
      });

      expect(Buffer.isBuffer(audioResult)).toBeTruthy();
      expect(audioResult.length).toBeGreaterThan(0);

      const outputPath = path.join(outputDir, 'speech-test.mp3');
      writeFileSync(outputPath, audioResult);
    }, 10000);

    it('should work with default voice', async () => {
      const { audioResult } = await voice.speech({
        text: 'Test with default voice',
      });

      expect(Buffer.isBuffer(audioResult)).toBeTruthy();

      const outputPath = path.join(outputDir, 'speech-test-default.mp3');
      writeFileSync(outputPath, audioResult);
    }, 10000);
  });

  describe('speechStream', () => {
    it('should stream audio to file', async () => {
      const { audioResult } = await voice.speechStream({
        text: 'Test streaming',
        voice: 'en-US-Casual-K',
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

    it('should stream with default voice', async () => {
      const { audioResult } = await voice.speechStream({
        text: 'Test streaming with default voice',
      });

      return new Promise((resolve, reject) => {
        const outputPath = path.join(outputDir, 'speech-stream-test-default.mp3');
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
  });

  describe('transcribe', () => {
    it('should throw error for transcribe', async () => {
      await expect(voice.transcribe({ audio: Buffer.from('test') })).rejects.toThrow(
        'Transcription is not supported by Google Cloud Text-to-Speech',
      );
    });
  });

  describe('transcribeStream', () => {
    it('should throw error for transcribeStream', async () => {
      const stream = new PassThrough();
      await expect(voice.transcribeStream({ audio: stream })).rejects.toThrow(
        'Stream transcription is not supported by Google Cloud Text-to-Speech',
      );
    });
  });
});
