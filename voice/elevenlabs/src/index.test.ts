import { createWriteStream, writeFileSync, mkdirSync, createReadStream } from 'fs';
import path from 'path';
import { describe, expect, it, beforeAll } from 'vitest';

import { ElevenLabsVoice } from './index.js';

describe('ElevenLabsVoice Integration Tests', () => {
  let voice: ElevenLabsVoice;
  const outputDir = path.join(process.cwd(), 'test-outputs');

  beforeAll(() => {
    try {
      mkdirSync(outputDir, { recursive: true });
    } catch (err) {
      console.log('Directory already exists: ', err);
    }

    voice = new ElevenLabsVoice({
      speechModel: {
        name: 'eleven_multilingual_v2',
      },
    });
  });

  describe('getSpeakers', () => {
    it('should list available speakers', async () => {
      const speakers = await voice.getSpeakers();
      console.log(speakers);
      expect(speakers.length).toBeGreaterThan(0);
      expect(speakers[0]).toHaveProperty('voiceId');
      expect(speakers[0]).toHaveProperty('name');
      expect(speakers[0]).toHaveProperty('language');
      expect(speakers[0]).toHaveProperty('gender');
    });
  });

  describe('speak', () => {
    it('should speak with default values', async () => {
      const defaultVoice = new ElevenLabsVoice();
      const audioStream = await defaultVoice.speak('Hello World, how are you?');

      const outputPath = path.join(outputDir, 'elevenlabs-speech-test-default.mp3');
      const fileStream = createWriteStream(outputPath);
      const chunks: Buffer[] = [];

      audioStream.on('data', (chunk: Buffer) => chunks.push(chunk));
      audioStream.pipe(fileStream);
      writeFileSync(outputPath, Buffer.concat(chunks));
    }, 10000);

    it('should generate audio from text and save to file', async () => {
      const speakers = await voice.getSpeakers();
      const speaker = speakers[0].voiceId;

      const audioStream = await voice.speak('Hello World', { speaker });

      return new Promise((resolve, reject) => {
        const outputPath = path.join(outputDir, 'elevenlabs-speech-test.mp3');
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

    it('should work with different speaker', async () => {
      const speakers = await voice.getSpeakers();
      const speaker = speakers[1]?.voiceId;

      const audioStream = await voice.speak('Test with different speaker', { speaker });

      return new Promise((resolve, reject) => {
        const outputPath = path.join(outputDir, 'elevenlabs-speech-test-params.mp3');
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
    it('should convert audio to text', async () => {
      const outputPath = path.join(outputDir, 'elevenlabs-speech-test-params.mp3');
      const audio = createReadStream(outputPath);
      const result = await voice.listen(audio);

      if (typeof result !== 'string') {
        return expect(result).toBeInstanceOf(String);
      }

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle API errors gracefully', async () => {
      // Create a voice instance with an invalid API key to force an error
      const invalidVoice = new ElevenLabsVoice({
        listeningModel: {
          name: 'eleven_multilingual_v2',
          apiKey: 'invalid-api-key',
        },
      });

      const outputPath = path.join(outputDir, 'elevenlabs-speech-test-params.mp3');
      const audio = createReadStream(outputPath);

      // The API call should fail with an authentication error
      await expect(invalidVoice.listen(audio)).rejects.toThrow();
    });

    it('should handle invalid audio input', async () => {
      // Create a path to a non-existent file
      const nonExistentPath = path.join(outputDir, 'non-existent-file.mp3');

      // Attempting to create a read stream from a non-existent file should throw
      await expect(async () => {
        const audio = createReadStream(nonExistentPath);
        await voice.listen(audio);
      }).rejects.toThrow();
    });
  });
});
