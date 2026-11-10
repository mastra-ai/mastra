// Hits the real Speechify API. Needs SPEECHIFY_API_KEY in the environment.
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { describe, expect, it, beforeAll } from 'vitest';

import { SpeechifyVoice } from './index';

async function drain(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

describe.skipIf(!process.env.SPEECHIFY_API_KEY)('SpeechifyVoice Integration Tests', () => {
  let voice: SpeechifyVoice;
  const outputDir = path.join(process.cwd(), 'test-outputs');

  beforeAll(() => {
    mkdirSync(outputDir, { recursive: true });
    // Defaults: simba-3.5 with the harper_32 voice.
    voice = new SpeechifyVoice();
  });

  describe('voices', () => {
    it('lists the live catalog', async () => {
      const voices = await voice.getSpeakers();
      expect(voices.length).toBeGreaterThan(0);
      const harper = voices.find(entry => entry.voiceId === 'harper_32');
      expect(harper?.models).toContain('simba-3.5');
    }, 30000);
  });

  describe('speech', () => {
    it('generates audio from text with the defaults', async () => {
      const audio = await drain(await voice.speak('Hello from Mastra Voice - Speechify'));
      expect(audio.length).toBeGreaterThan(0);
      writeFileSync(path.join(outputDir, 'speechify-speech-test.mp3'), audio);
    }, 20000);

    it('speaks another language on simba-3.5 with the same voice', async () => {
      const audio = await drain(await voice.speak('Olá, este é um teste em português.', { language: 'pt-BR' }));
      expect(audio.length).toBeGreaterThan(0);
      writeFileSync(path.join(outputDir, 'speechify-speech-test-pt-br.mp3'), audio);
    }, 20000);

    it('honours a per-request model and voice', async () => {
      const audio = await drain(await voice.speak('Test with parameters', { model: 'simba-3.2', speaker: 'wyatt_32' }));
      expect(audio.length).toBeGreaterThan(0);
    }, 20000);

    it('returns Ogg when asked', async () => {
      const audio = await drain(await voice.speak('Ogg container test', { audioFormat: 'ogg' }));
      expect(audio.subarray(0, 4).toString('ascii')).toBe('OggS');
    }, 20000);

    it('generates audio from a stream input', async () => {
      const audio = await drain(await voice.speak(Readable.from(['Hello from stream input - Speechify'])));
      expect(audio.length).toBeGreaterThan(0);
    }, 20000);
  });

  describe('error handling', () => {
    it('rejects empty text', async () => {
      await expect(voice.speak('')).rejects.toThrow();
    });

    it('rejects an unknown voice', async () => {
      await expect(voice.speak('Test', { speaker: 'invalid_voice' })).rejects.toThrow();
    });
  });
});
