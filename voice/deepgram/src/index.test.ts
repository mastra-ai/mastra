import { writeFileSync, mkdirSync, createReadStream } from 'fs';
import path from 'path';
import { PassThrough } from 'stream';
import { describe, expect, it, beforeAll } from 'vitest';

import { DeepgramVoice } from './index.js';

describe('DeepgramVoice Integration Tests', () => {
  let voice: DeepgramVoice;
  const outputDir = path.join(process.cwd(), 'test-outputs');

  beforeAll(() => {
    try {
      mkdirSync(outputDir, { recursive: true });
    } catch (err) {
      console.log('Directory already exists: ', err);
    }

    voice = new DeepgramVoice({
      speechModel: {
        name: 'aura',
      },
      listeningModel: {
        name: 'whisper',
      },
      speaker: 'asteria-en',
    });
  });

  describe('getSpeakers', () => {
    it('should list available voices', async () => {
      const speakers = await voice.getSpeakers();
      const expectedVoiceIds = ['asteria-en', 'stella-en', 'luna-en'];
      expectedVoiceIds.forEach(voiceId => {
        expect(speakers.some(s => s.voiceId === voiceId)).toBe(true);
      });
    });
  });

  describe('speak', () => {
    it('should generate audio and save to file', async () => {
      const audioResult = await voice.speak('Hello World', {
        text: 'Hello World',
      });

      const chunks: Buffer[] = [];
      for await (const chunk of audioResult) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const audioBuffer = Buffer.concat(chunks);
      const outputPath = path.join(outputDir, 'deepgram-speech-test.mp3');
      writeFileSync(outputPath, audioBuffer);
      expect(audioBuffer.length).toBeGreaterThan(0);
    }, 10000);

    it('should work with different parameters', async () => {
      const audioResult = await voice.speak('Hello World', {
        text: 'Test with parameters',
        speaker: 'luna-en',
      });

      const chunks: Buffer[] = [];
      for await (const chunk of audioResult) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const audioBuffer = Buffer.concat(chunks);
      const outputPath = path.join(outputDir, 'deepgram-speech-test-params.mp3');
      writeFileSync(outputPath, audioBuffer);
      expect(audioBuffer.length).toBeGreaterThan(0);
    }, 10000);
  });

  // Error cases
  describe('error handling', () => {
    it('should handle invalid voice names', async () => {
      await expect(voice.speak('Test', { speaker: 'invalid_voice' })).rejects.toThrow();
    });

    it('should handle empty text', async () => {
      await expect(voice.speak('', { speaker: 'asteria-en' })).rejects.toThrow('Input text is empty');
    });

    it('should handle whitespace-only text', async () => {
      await expect(voice.speak('   \n\t  ', { speaker: 'asteria-en' })).rejects.toThrow('Input text is empty');
    });
  });

  describe('listen', () => {
    it('should transcribe audio buffer', async () => {
      // First generate some audio to transcribe
      const audioResult = await voice.speak('This is a test of transcription');

      // Collect audio chunks
      const chunks: Buffer[] = [];
      for await (const chunk of audioResult) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const audioBuffer = Buffer.concat(chunks);

      // Create stream from the buffer
      const stream = new PassThrough();
      stream.end(audioBuffer);
      const result = await voice.listen(stream);

      expect(typeof result).toBe('string');
      expect(result.toLowerCase()).toContain('test');
      expect(result.toLowerCase()).toContain('transcription');
    }, 15000);

    it('should transcribe audio from fixture file', async () => {
      const fixturePath = path.join(process.cwd(), '__fixtures__', 'voice-test.m4a');
      const audioStream = createReadStream(fixturePath);

      console.log('listening to audio stream');
      const text = await voice.listen(audioStream, {
        filetype: 'm4a',
      });
      console.log('text', text);

      expect(text).toBeTruthy();
      console.log(text);
      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(0);
    }, 15000);

    it('should handle invalid audio', async () => {
      const invalidAudio = Buffer.from('not valid audio');
      const stream = new PassThrough();
      stream.end(invalidAudio);

      await expect(voice.listen(stream)).rejects.toThrow();
    });
  });
});
