import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { openai } from '@ai-sdk/openai-v5';
import { describe, expect, it, beforeAll } from 'vitest';

import { CompositeVoice } from '../../composite-voice';

describe('CompositeVoice with AI SDK Models', () => {
  const outputDir = path.join(process.cwd(), 'test-outputs');

  beforeAll(() => {
    try {
      mkdirSync(outputDir, { recursive: true });
    } catch (err) {
      console.log('Directory already exists: ', err);
    }
  });

  describe('Auto-wrapping AI SDK models', () => {
    it('should auto-wrap AI SDK transcription and speech models', async () => {
      const voice = new CompositeVoice({
        input: openai.transcription('whisper-1'),
        output: openai.speech('tts-1'),
      });

      // Test speech generation
      const audioStream = await voice.speak('Hello from CompositeVoice!', {
        speaker: 'alloy',
      });

      expect(audioStream).toBeDefined();

      const chunks: Buffer[] = [];
      for await (const chunk of audioStream!) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const audioBuffer = Buffer.concat(chunks);

      expect(audioBuffer.length).toBeGreaterThan(0);

      const outputPath = path.join(outputDir, 'composite-aisdk-speech.mp3');
      writeFileSync(outputPath, audioBuffer);
    }, 10000);

    it('should transcribe using wrapped AI SDK model', async () => {
      const voice = new CompositeVoice({
        input: openai.transcription('whisper-1'),
        output: openai.speech('tts-1'),
      });

      // First generate audio
      const audioStream = await voice.speak('Testing CompositeVoice transcription', {
        speaker: 'nova',
      });

      expect(audioStream).toBeDefined();

      // Then transcribe it
      const text = await voice.listen(audioStream!);

      expect(text).toBeTruthy();
      expect(typeof text).toBe('string');
      expect(text.toLowerCase()).toContain('composite');
      console.log('CompositeVoice transcribed:', text);
    }, 15000);

    it('should work with only input provider (AI SDK)', async () => {
      const voice = new CompositeVoice({
        input: openai.transcription('whisper-1'),
      });

      // Generate audio with another voice first
      const tempVoice = new CompositeVoice({
        output: openai.speech('tts-1'),
      });

      const audioStream = await tempVoice.speak('Testing input only', {
        speaker: 'alloy',
      });

      // Transcribe with input-only voice
      const text = await voice.listen(audioStream!);

      expect(text).toBeTruthy();
      expect(typeof text).toBe('string');
      console.log('Input-only transcribed:', text);
    }, 15000);

    it('should work with only output provider (AI SDK)', async () => {
      const voice = new CompositeVoice({
        output: openai.speech('tts-1'),
      });

      const audioStream = await voice.speak('Testing output only', {
        speaker: 'nova',
      });

      expect(audioStream).toBeDefined();

      const chunks: Buffer[] = [];
      for await (const chunk of audioStream!) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const audioBuffer = Buffer.concat(chunks);

      expect(audioBuffer.length).toBeGreaterThan(0);
    }, 10000);

    it('should pass provider-specific options through', async () => {
      const voice = new CompositeVoice({
        input: openai.transcription('whisper-1'),
        output: openai.speech('tts-1'),
      });

      const audioStream = await voice.speak('Testing with speed option', {
        speaker: 'alloy',
        providerOptions: {
          openai: {
            speed: 1.5,
          },
        },
      });

      expect(audioStream).toBeDefined();

      const chunks: Buffer[] = [];
      for await (const chunk of audioStream!) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const audioBuffer = Buffer.concat(chunks);

      expect(audioBuffer.length).toBeGreaterThan(0);
    }, 10000);
  });

  describe('Round-trip with CompositeVoice', () => {
    it('should complete full speech-to-text-to-speech cycle', async () => {
      const voice = new CompositeVoice({
        input: openai.transcription('whisper-1'),
        output: openai.speech('tts-1'),
      });

      const originalText = 'CompositeVoice round trip test with AI SDK models';

      // Generate speech
      const audioStream1 = await voice.speak(originalText, {
        speaker: 'alloy',
      });

      expect(audioStream1).toBeDefined();

      // Transcribe speech
      const transcribedText = await voice.listen(audioStream1!);

      expect(transcribedText).toBeTruthy();
      expect(typeof transcribedText).toBe('string');
      console.log('Original:', originalText);
      console.log('Transcribed:', transcribedText);

      // Generate speech again from transcribed text
      const audioStream2 = await voice.speak(transcribedText, {
        speaker: 'nova',
      });

      expect(audioStream2).toBeDefined();

      const chunks: Buffer[] = [];
      for await (const chunk of audioStream2!) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const audioBuffer = Buffer.concat(chunks);

      expect(audioBuffer.length).toBeGreaterThan(0);

      const outputPath = path.join(outputDir, 'composite-round-trip.mp3');
      writeFileSync(outputPath, audioBuffer);
    }, 25000);
  });

  describe('Error handling', () => {
    it('should throw when trying to speak without output provider', async () => {
      const voice = new CompositeVoice({
        input: openai.transcription('whisper-1'),
      });

      await expect(voice.speak('test')).rejects.toThrow();
    });

    it('should throw when trying to listen without input provider', async () => {
      const voice = new CompositeVoice({
        output: openai.speech('tts-1'),
      });

      const tempVoice = new CompositeVoice({
        output: openai.speech('tts-1'),
      });
      const audioStream = await tempVoice.speak('test', { speaker: 'alloy' });

      await expect(voice.listen(audioStream!)).rejects.toThrow();
    });
  });
});
