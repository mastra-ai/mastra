import { createReadStream, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { Readable } from 'stream';
import { describe, it, expect, beforeAll } from 'vitest';

import { AzureVoice } from './index';

describe('AzureVoice Integration Tests', () => {
  let voice: AzureVoice;
  const outputDir = join(process.cwd(), 'test-outputs');
  const subscriptionKey = process.env.AZURE_API_KEY ?? 'fake-key';
  const region = process.env.AZURE_REGION ?? 'eastus';

  beforeAll(() => {
    try {
      mkdirSync(outputDir, { recursive: true });
    } catch (err) {
      // Ignore if directory already exists
      console.log('Directory already exists:', err);
    }

    voice = new AzureVoice({
      speechModel: { apiKey: subscriptionKey, region },
      listeningModel: { apiKey: subscriptionKey, region },
    });
  });

  describe('getSpeakers', () => {
    it('should list available voices', async () => {
      const voices = await voice.getSpeakers();
      expect(voices.length).toBeGreaterThan(0);
      expect(voices[0]).toHaveProperty('voiceId');
      expect(voices[0]).toHaveProperty('language');
      expect(voices[0]).toHaveProperty('region');
    });
  });

  it('should initialize with default parameters', async () => {
    const defaultVoice = new AzureVoice();
    const voices = await defaultVoice.getSpeakers();
    expect(voices).toBeInstanceOf(Array);
    expect(voices.length).toBeGreaterThan(0);
  });

  describe('speak', () => {
    it('should speak with default parameters', async () => {
      const defaultVoice = new AzureVoice({
        speechModel: { apiKey: subscriptionKey, region },
      });
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
        speaker: 'en-US-AriaNeural',
      });

      const chunks: Buffer[] = [];
      for await (const chunk of audioStream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const audioBuffer = Buffer.concat(chunks);
      expect(audioBuffer.length).toBeGreaterThan(0);

      const outputPath = join(outputDir, 'azure-speech-test.wav');
      writeFileSync(outputPath, audioBuffer);
    });

    it('should work with different parameters', async () => {
      const audioStream = await voice.speak('Test with parameters', {
        speaker: 'en-US-JennyNeural',
      });

      const chunks: Buffer[] = [];
      for await (const chunk of audioStream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const audioBuffer = Buffer.concat(chunks);
      expect(audioBuffer.length).toBeGreaterThan(0);

      const outputPath = join(outputDir, 'azure-speech-params.wav');
      writeFileSync(outputPath, audioBuffer);
    });

    it('should accept text stream as input', async () => {
      const inputStream = new Readable();
      inputStream.push('Hello from stream');
      inputStream.push(null);

      const audioStream = await voice.speak(inputStream, {
        speaker: 'en-US-AriaNeural',
      });

      const chunks: Buffer[] = [];
      for await (const chunk of audioStream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const audioBuffer = Buffer.concat(chunks);
      expect(audioBuffer.length).toBeGreaterThan(0);

      const outputPath = join(outputDir, 'azure-speech-stream.wav');
      writeFileSync(outputPath, audioBuffer);
    });
  });

  describe('listen', () => {
    it('should listen with default parameters', async () => {
      const defaultVoice = new AzureVoice({
        speechModel: { apiKey: subscriptionKey, region },
        listeningModel: { apiKey: subscriptionKey, region },
      });
      const audioStream = await defaultVoice.speak('Listening test with defaults');

      const text = await defaultVoice.listen(audioStream);
      expect(text).toBeTruthy();
      expect(typeof text).toBe('string');
      expect(text.toLowerCase()).toContain('listening test');
    });

    it('should transcribe audio from file', async () => {
      const filePath = join(outputDir, 'azure-speech-test.wav');
      const audioStream = createReadStream(filePath);

      const text = await voice.listen(audioStream);
      expect(text).toBeTruthy();
      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(0);
    });

    it('should transcribe audio stream', async () => {
      const audioStream = await voice.speak('This is a test for transcription', {
        speaker: 'en-US-AriaNeural',
      });

      const text = await voice.listen(audioStream);
      expect(text).toBeTruthy();
      expect(typeof text).toBe('string');
      expect(text.toLowerCase()).toContain('test');
    });
  });

  describe('error handling', () => {
    it('should handle empty text', async () => {
      await expect(voice.speak('')).rejects.toThrow('Input text is empty');
    });

    it('should handle missing API key', () => {
      const { AZURE_API_KEY } = process.env;
      delete process.env.AZURE_API_KEY;

      expect(() => {
        new AzureVoice({
          speechModel: { region: 'eastus' },
        });
      }).toThrow('No Azure API key provided for speech model');

      process.env.AZURE_API_KEY = AZURE_API_KEY;
    });
  });
});
