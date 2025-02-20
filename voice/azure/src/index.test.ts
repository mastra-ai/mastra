import { createWriteStream, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { describe, expect, it, beforeAll } from 'vitest';

import 'dotenv/config';

import { AzureVoice } from './index.js';
import { type VoiceId } from './voices';

describe('AzureVoice Integration Tests', () => {
  let voice: AzureVoice;
  const outputDir = path.join(process.cwd(), 'test-outputs');

  beforeAll(() => {
    // Create output directory if it doesn't exist
    try {
      mkdirSync(outputDir, { recursive: true });
    } catch (err) {
      // Ignore if directory already exists
    }

    voice = new AzureVoice({
      model: {
        name: 'en-US-JennyNeural' as VoiceId,
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
      expect(typeof voices[0].voice_id).toBe('string');
    });
  });

  describe('speech', () => {
    it.only('should generate audio and save to file', async () => {
      console.log('[TEST] Starting speech test...');

      const { audioResult } = await voice.speech({
        text: 'Hello World',
        voice: 'en-US-JennyNeural',
      });

      console.log('[TEST] Got audio result, checking buffer...');
      expect(Buffer.isBuffer(audioResult)).toBeTruthy();

      console.log('[TEST] Checking buffer length...');
      expect(audioResult.length).toBeGreaterThan(0);
      console.log(`[TEST] Buffer length: ${audioResult.length}`);

      console.log('[TEST] Creating output directory...');
      mkdirSync(outputDir, { recursive: true });

      const outputPath = path.join(outputDir, 'azure-speech-test.mp3');
      console.log(`[TEST] Writing audio to file: ${outputPath}`);
      writeFileSync(outputPath, audioResult);
      console.log('[TEST] File written successfully');
    }, 30000); // Increased timeout to 30 seconds

    it('should work with different voice', async () => {
      const { audioResult } = await voice.speech({
        text: 'Test with different voice',
        voice: 'en-US-GuyNeural',
      });

      expect(Buffer.isBuffer(audioResult)).toBeTruthy();

      const outputPath = path.join(outputDir, 'speech-test-voice.wav');
      writeFileSync(outputPath, audioResult);
    }, 10000);
  });

  describe('speechStream', () => {
    it('should stream audio to file', async () => {
      const { audioResult } = await voice.speechStream({
        text: 'Test streaming',
        voice: 'en-US-JennyNeural',
      });

      return new Promise((resolve, reject) => {
        const outputPath = path.join(outputDir, 'speech-stream-test.wav');
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

    it('should stream with different voice', async () => {
      const { audioResult } = await voice.speechStream({
        text: 'Testing with different voice',
        voice: 'en-US-GuyNeural',
      });

      return new Promise((resolve, reject) => {
        const outputPath = path.join(outputDir, 'speech-stream-test-voice.wav');
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
        voice: 'en-US-JennyNeural',
      });

      const result = await voice.transcribe({ audio: audioResult });
      expect(result).toHaveProperty('text');
      expect(typeof result.text).toBe('string');
      expect(result.text.toLowerCase()).toContain('test');
    }, 15000);
  });

  describe('transcribeStream', () => {
    it('should transcribe streaming audio', async () => {
      const { audioResult } = await voice.speechStream({
        text: 'This is a streaming transcription test',
        voice: 'en-US-JennyNeural',
      });

      const result = await voice.transcribeStream({ audio: audioResult });
      expect(result).toHaveProperty('text');
      expect(typeof result.text).toBe('string');
      expect(result.text.toLowerCase()).toContain('test');
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
          voice: 'en-US-JennyNeural',
        }),
      ).rejects.toThrow();
    });

    it('should handle invalid audio data for transcription', async () => {
      await expect(voice.transcribe({ audio: Buffer.from('') })).rejects.toThrow();
    });
  });
});
