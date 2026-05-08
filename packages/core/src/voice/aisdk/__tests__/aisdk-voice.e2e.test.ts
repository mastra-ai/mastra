import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { PassThrough } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { openai } from '@ai-sdk/openai-v5';
import { useLLMRecording } from '@internal/llm-recorder';
import { describe, expect, it, beforeAll } from 'vitest';

import { AISDKSpeech } from '../speech';
import { AISDKTranscription } from '../transcription';

const testDir = dirname(fileURLToPath(import.meta.url));
const recordingsDir = resolve(testDir, '__recordings__');
const outputDir = resolve(testDir, 'test-outputs');

describe('AI SDK Voice Integration Tests', () => {
  useLLMRecording('core-src-voice-aisdk-__tests__-aisdk-voice.e2e', { recordingsDir });

  beforeAll(() => {
    mkdirSync(outputDir, { recursive: true });
  });

  let speech: AISDKSpeech;

  beforeAll(() => {
    speech = new AISDKSpeech(openai.speech('tts-1'), { voice: 'alloy' });
  });

  describe('AISDKSpeech', () => {
    it('should generate audio from text', async () => {
      const audioStream = await speech.speak('Hello from AI SDK!');

      const chunks: Buffer[] = [];
      for await (const chunk of audioStream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const audioBuffer = Buffer.concat(chunks);

      expect(audioBuffer.length).toBeGreaterThan(0);

      const outputPath = resolve(outputDir, 'aisdk-speech-test.mp3');
      writeFileSync(outputPath, audioBuffer);
    }, 10000);

    it('should generate audio with custom speaker', async () => {
      const audioStream = await speech.speak('Testing with Nova voice', {
        speaker: 'nova',
      });

      const chunks: Buffer[] = [];
      for await (const chunk of audioStream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const audioBuffer = Buffer.concat(chunks);

      expect(audioBuffer.length).toBeGreaterThan(0);

      const outputPath = resolve(outputDir, 'aisdk-speech-nova.mp3');
      writeFileSync(outputPath, audioBuffer);
    }, 10000);

    it('should handle text stream input', async () => {
      const inputStream = new PassThrough();
      inputStream.end('Hello from stream');

      const audioStream = await speech.speak(inputStream, {
        speaker: 'alloy',
      });

      const chunks: Buffer[] = [];
      for await (const chunk of audioStream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const audioBuffer = Buffer.concat(chunks);

      expect(audioBuffer.length).toBeGreaterThan(0);

      const outputPath = resolve(outputDir, 'aisdk-speech-stream.mp3');
      writeFileSync(outputPath, audioBuffer);
    }, 10000);

    it('should handle provider-specific options', async () => {
      const audioStream = await speech.speak('Testing provider options', {
        speaker: 'alloy',
        providerOptions: {
          openai: {
            speed: 1.25,
          },
        },
      });

      const chunks: Buffer[] = [];
      for await (const chunk of audioStream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const audioBuffer = Buffer.concat(chunks);

      expect(audioBuffer.length).toBeGreaterThan(0);
    }, 10000);

    it('should throw when trying to listen', async () => {
      await expect(speech.listen()).rejects.toThrow('AI SDK speech models do not support transcription');
    });

    it('should return empty speakers array', async () => {
      const speakers = await speech.getSpeakers();
      expect(speakers).toEqual([]);
    });

    it('should return listener disabled', async () => {
      const listener = await speech.getListener();
      expect(listener.enabled).toBe(false);
    });
  });

  describe('AISDKTranscription', () => {
    let transcription: AISDKTranscription;

    beforeAll(() => {
      transcription = new AISDKTranscription(openai.transcription('whisper-1'));
    });

    it('should transcribe generated audio', async () => {
      // Generate audio first
      const speech = new AISDKSpeech(openai.speech('tts-1'));
      const audioStream = await speech.speak('This is a transcription test');

      // Transcribe it
      const text = await transcription.listen(audioStream);

      expect(text).toBeTruthy();
      expect(typeof text).toBe('string');
      expect(text.toLowerCase()).toContain('transcription');
      console.log('Transcribed text:', text);
    }, 15000);

    it('should transcribe audio file', async () => {
      const speechStream = await speech.speak('This is a transcription test');
      const text = await transcription.listen(speechStream);

      expect(text).toBeTruthy();
      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(0);
      console.log('Transcribed fixture:', text);
    }, 15000);

    it('should handle provider-specific options', async () => {
      const speech = new AISDKSpeech(openai.speech('tts-1'));
      const audioStream = await speech.speak('Testing language option');

      const text = await transcription.listen(audioStream, {
        providerOptions: {
          openai: {
            language: 'en',
            temperature: 0.0,
          },
        },
      });

      expect(text).toBeTruthy();
      expect(typeof text).toBe('string');
      console.log('Transcribed with options:', text);
    }, 15000);

    it('should handle abort signal', async () => {
      const speech = new AISDKSpeech(openai.speech('tts-1'));
      const audioStream = await speech.speak('This will be aborted');

      const controller = new AbortController();
      controller.abort();

      await expect(
        transcription.listen(audioStream, {
          abortSignal: controller.signal,
        }),
      ).rejects.toThrow();
    }, 15000);

    it('should handle buffer input', async () => {
      // Generate audio first
      const speech = new AISDKSpeech(openai.speech('tts-1'));
      const audioStream = await speech.speak('Testing buffer input');

      // Convert to buffer
      const chunks: Buffer[] = [];
      for await (const chunk of audioStream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const audioBuffer = Buffer.concat(chunks);

      // Create a stream from buffer
      const bufferStream = new PassThrough();
      bufferStream.end(audioBuffer);

      const text = await transcription.listen(bufferStream);

      expect(text).toBeTruthy();
      expect(typeof text).toBe('string');
      console.log('Transcribed from buffer:', text);
    }, 15000);

    it('should throw when trying to speak', async () => {
      await expect(transcription.speak()).rejects.toThrow('AI SDK transcription models do not support text-to-speech');
    });

    it('should return empty speakers array', async () => {
      const speakers = await transcription.getSpeakers();
      expect(speakers).toEqual([]);
    });

    it('should return listener enabled', async () => {
      const listener = await transcription.getListener();
      expect(listener.enabled).toBe(true);
    });
  });

  describe('Round-trip test (Speech -> Transcription)', () => {
    it('should successfully transcribe generated speech', async () => {
      const speech = new AISDKSpeech(openai.speech('tts-1'), { voice: 'alloy' });
      const transcription = new AISDKTranscription(openai.transcription('whisper-1'));

      const originalText = 'Hello, this is a round trip test using AI SDK voice models';

      // Generate speech
      const audioStream = await speech.speak(originalText, {
        speaker: 'nova',
      });

      // Transcribe speech
      const transcribedText = await transcription.listen(audioStream);

      expect(transcribedText).toBeTruthy();
      expect(typeof transcribedText).toBe('string');
      // Exact match not expected due to speech synthesis variations
      // but key words should be present
      expect(transcribedText.toLowerCase()).toMatch(/round.?trip/);
      console.log('Original:', originalText);
      console.log('Transcribed:', transcribedText);
    }, 20000);
  });
});
