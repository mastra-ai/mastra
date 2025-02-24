import { writeFileSync, mkdirSync, createReadStream } from 'fs';
import path from 'path';
import { PassThrough } from 'stream';
import { describe, expect, it, beforeAll } from 'vitest';

import { OpenAIVoice } from './index.js';

describe('OpenAIVoice Integration Tests', () => {
  let voice: OpenAIVoice;
  const outputDir = path.join(process.cwd(), 'test-outputs');

  beforeAll(() => {
    try {
      mkdirSync(outputDir, { recursive: true });
    } catch (err) {
      // Ignore if directory already exists
      console.log('Directory already exists: ', err);
    }

    voice = new OpenAIVoice({
      speechModel: {
        name: 'tts-1',
      },
      listeningModel: {
        name: 'whisper-1',
      },
    });
  });

  describe('getSpeakers', () => {
    it('should list available voices', async () => {
      const speakers = await voice.getSpeakers();
      expect(speakers).toContainEqual({ voiceId: 'alloy' });
      expect(speakers).toContainEqual({ voiceId: 'nova' });
    });
  });

  it('should initialize with default parameters', async () => {
    const defaultVoice = new OpenAIVoice();
    const speakers = await defaultVoice.getSpeakers();
    expect(speakers).toBeInstanceOf(Array);
    expect(speakers.length).toBeGreaterThan(0);
  });

  describe('speak', () => {
    it('should speak with default parameters', async () => {
      const defaultVoice = new OpenAIVoice();
      const audioStream = await defaultVoice.speak('Hello with defaults');

      const chunks: Buffer[] = [];
      for await (const chunk of audioStream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const audioBuffer = Buffer.concat(chunks);

      expect(audioBuffer.length).toBeGreaterThan(0);
    });

    it('should generate audio stream from text', async () => {
      const audioStream = await voice.speak('Hello World', {
        speaker: 'alloy',
      });

      const chunks: Buffer[] = [];
      for await (const chunk of audioStream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const audioBuffer = Buffer.concat(chunks);

      expect(audioBuffer.length).toBeGreaterThan(0);

      const outputPath = path.join(outputDir, 'speech-test.mp3');
      writeFileSync(outputPath, audioBuffer);
    }, 10000);

    it('should work with different parameters', async () => {
      const audioStream = await voice.speak('Test with parameters', {
        speaker: 'nova',
        speed: 0.5,
      });

      const chunks: Buffer[] = [];
      for await (const chunk of audioStream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const audioBuffer = Buffer.concat(chunks);

      expect(audioBuffer.length).toBeGreaterThan(0);

      const outputPath = path.join(outputDir, 'speech-test-params.mp3');
      writeFileSync(outputPath, audioBuffer);
    }, 10000);

    it('should accept text stream as input', async () => {
      const inputStream = new PassThrough();
      inputStream.end('Hello from stream');

      const audioStream = await voice.speak(inputStream, {
        speaker: 'alloy',
      });

      const chunks: Buffer[] = [];
      for await (const chunk of audioStream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const audioBuffer = Buffer.concat(chunks);

      expect(audioBuffer.length).toBeGreaterThan(0);

      const outputPath = path.join(outputDir, 'speech-stream-input.mp3');
      writeFileSync(outputPath, audioBuffer);
    }, 10000);
  });

  describe('listen', () => {
    it('should listen with default parameters', async () => {
      const defaultVoice = new OpenAIVoice();
      const audioStream = await defaultVoice.speak('Listening test with defaults');

      const text = await defaultVoice.listen(audioStream);

      expect(text).toBeTruthy();
      expect(typeof text).toBe('string');
      expect(text.toLowerCase()).toContain('listening test');
    });

    it('should transcribe audio from fixture file', async () => {
      const fixturePath = path.join(process.cwd(), '__fixtures__', 'voice-test.m4a');
      const audioStream = createReadStream(fixturePath);

      const text = await voice.listen(audioStream, {
        filetype: 'm4a',
      });

      expect(text).toBeTruthy();
      console.log(text);
      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(0);
    }, 15000);

    it('should transcribe audio stream', async () => {
      // First generate some test audio
      const audioStream = await voice.speak('This is a test for transcription', {
        speaker: 'alloy',
      });

      // Then transcribe it
      const text = await voice.listen(audioStream, {
        filetype: 'm4a',
      });

      expect(text).toBeTruthy();
      expect(typeof text).toBe('string');
      expect(text.toLowerCase()).toContain('test');
    }, 15000);

    it('should accept options', async () => {
      const audioStream = await voice.speak('Test with language option', {
        speaker: 'nova',
      });

      const text = await voice.listen(audioStream, {
        language: 'en',
        filetype: 'm4a',
      });

      expect(text).toBeTruthy();
      expect(typeof text).toBe('string');
      expect(text.toLowerCase()).toContain('test');
    }, 15000);
  });

  // Error cases
  describe('error handling', () => {
    it('should handle invalid speaker names', async () => {
      await expect(
        voice.speak('Test', {
          speaker: 'invalid_voice',
        }),
      ).rejects.toThrow();
    });

    it('should handle empty text', async () => {
      await expect(
        voice.speak('', {
          speaker: 'alloy',
        }),
      ).rejects.toThrow();
    });
  });
});
