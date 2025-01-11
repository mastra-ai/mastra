import { createWriteStream, writeFileSync } from 'fs';
import path from 'path';

import { OpenAITTS } from './index.js';

describe('OpenAITTS Integration Tests', () => {
  let tts: OpenAITTS;

  beforeAll(() => {
    tts = new OpenAITTS({
      model: {
        name: 'tts-1',
      },
    });
  });

  describe('stream', () => {
    it('should stream audio data to file', async () => {
      const { audioResult } = await tts.stream({
        text: 'Test streaming',
        voice: 'alloy',
      });

      return new Promise((resolve, reject) => {
        const outputPath = path.join(process.cwd(), 'test-outputs/stream-test.mp3');
        const fileStream = createWriteStream(outputPath);
        const chunks: Buffer[] = [];

        audioResult.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        audioResult.pipe(fileStream);

        fileStream.on('finish', () => {
          expect(chunks.length).toBeGreaterThan(0);
          resolve(undefined);
        });

        audioResult.on('error', reject);
        fileStream.on('error', reject);
      });
    }),
      50000;

    it('should stream with different parameters and save to file', async () => {
      const { audioResult } = await tts.stream({
        text: 'Testing with different voice and speed',
        voice: 'nova',
        speed: 1.2,
      });

      return new Promise((resolve, reject) => {
        const outputPath = path.join(process.cwd(), 'test-outputs/stream-test-params.mp3');
        const fileStream = createWriteStream(outputPath);

        audioResult.pipe(fileStream);

        fileStream.on('finish', resolve);
        audioResult.on('error', reject);
        fileStream.on('error', reject);
      });
    });
  });

  describe('generate', () => {
    it('should return a complete audio buffer and save to file', async () => {
      const { audioResult } = await tts.generate({
        text: 'Hello World',
        voice: 'alloy',
      });

      expect(Buffer.isBuffer(audioResult)).toBeTruthy();
      expect(audioResult.length).toBeGreaterThan(0);

      const outputPath = path.join(process.cwd(), 'test-outputs/open-aigenerate-test.mp3');
      writeFileSync(outputPath, audioResult);
    });

    it('should work with different parameters and save to file', async () => {
      const { audioResult } = await tts.generate({
        text: 'Test with parameters',
        voice: 'nova',
        speed: 1.5,
      });

      expect(Buffer.isBuffer(audioResult)).toBeTruthy();

      const outputPath = path.join(process.cwd(), 'test-outputs/open-nova-aigenerate-test.mp3');
      writeFileSync(outputPath, audioResult);
    });
  });

  // Error cases
  describe('error handling', () => {
    it('should handle invalid voice names', async () => {
      await expect(
        tts.stream({
          text: 'Test',
          voice: 'invalid_voice',
        }),
      ).rejects.toThrow();
    });

    it('should handle empty text', async () => {
      await expect(
        tts.stream({
          text: '',
          voice: 'alloy',
        }),
      ).rejects.toThrow();
    });
  });
});
