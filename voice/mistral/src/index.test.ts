import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { describe, expect, it, beforeAll } from 'vitest';

import { MistralVoice } from './index.js';

describe('MistralVoice Integration Tests', () => {
  let voice: MistralVoice;
  const outputDir = path.join(process.cwd(), 'test-outputs');

  beforeAll(() => {
    try {
      mkdirSync(outputDir, { recursive: true });
    } catch (err) {
      console.log('Directory already exists: ', err);
    }

    voice = new MistralVoice();
  });

  describe('getSpeakers', () => {
    it('should list available preset voices', async () => {
      const speakers = await voice.getSpeakers();
      expect(speakers).toBeInstanceOf(Array);
      expect(speakers.length).toBeGreaterThan(0);
      expect(speakers[0]).toHaveProperty('voiceId');
      expect(speakers[0]).toHaveProperty('name');
    });
  });

  it('should initialize with default parameters', () => {
    const defaultVoice = new MistralVoice();
    expect(defaultVoice).toBeInstanceOf(MistralVoice);
  });

  describe('speak', () => {
    it('should generate audio from text', async () => {
      const audioStream = await voice.speak('Hello from Mistral.');

      const chunks: Buffer[] = [];
      for await (const chunk of audioStream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const audioBuffer = Buffer.concat(chunks);

      expect(audioBuffer.length).toBeGreaterThan(0);

      const outputPath = path.join(outputDir, 'mistral-speech.mp3');
      writeFileSync(outputPath, audioBuffer);
    }, 15000);

    it('should accept a speaker option', async () => {
      const speakers = await voice.getSpeakers();
      if (speakers.length === 0) return;

      const audioStream = await voice.speak('Hello with a preset voice.', {
        speaker: speakers[0]!.voiceId,
      });

      const chunks: Buffer[] = [];
      for await (const chunk of audioStream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      expect(Buffer.concat(chunks).length).toBeGreaterThan(0);
    }, 15000);

    it('should accept a text stream as input', async () => {
      const inputStream = new PassThrough();
      inputStream.end('Hello from a stream.');

      const audioStream = await voice.speak(inputStream);

      const chunks: Buffer[] = [];
      for await (const chunk of audioStream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      expect(Buffer.concat(chunks).length).toBeGreaterThan(0);
    }, 15000);

    it('should support responseFormat option', async () => {
      const audioStream = await voice.speak('Format test.', {
        responseFormat: 'wav',
      });

      const chunks: Buffer[] = [];
      for await (const chunk of audioStream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      expect(Buffer.concat(chunks).length).toBeGreaterThan(0);
    }, 15000);

    it('should stream audio chunks when stream is enabled', async () => {
      const audioStream = await voice.speak('Streaming test.', {
        stream: true,
      });

      const chunks: Buffer[] = [];
      for await (const chunk of audioStream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      expect(Buffer.concat(chunks).length).toBeGreaterThan(0);
    }, 15000);

    it('should throw on empty text', async () => {
      await expect(voice.speak('')).rejects.toThrow('Input text is empty');
    });
  });

  describe('listen', () => {
    it('should transcribe audio', async () => {
      const audioStream = await voice.speak('This is a transcription test.');

      const text = await voice.listen(audioStream);

      expect(text).toBeTruthy();
      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(0);
    }, 30000);

    it('should accept language option', async () => {
      const audioStream = await voice.speak('Testing with language option.');

      const text = await voice.listen(audioStream, {
        language: 'en',
      });

      expect(text).toBeTruthy();
      expect(typeof text).toBe('string');
    }, 30000);
  });

  describe('getListener', () => {
    it('should report listening as enabled', async () => {
      const result = await voice.getListener();
      expect(result).toEqual({ enabled: true });
    });
  });

  describe('error handling', () => {
    it('should throw when no API key is available', () => {
      const originalKey = process.env.MISTRAL_API_KEY;
      delete process.env.MISTRAL_API_KEY;

      try {
        expect(() => new MistralVoice()).toThrow();
      } finally {
        if (originalKey) {
          process.env.MISTRAL_API_KEY = originalKey;
        }
      }
    });
  });
});
