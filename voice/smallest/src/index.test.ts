import { createReadStream, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';

import { describe, expect, it, beforeAll } from 'vitest';

import { SmallestVoice, SMALLEST_MAX_INPUT_CHARS } from './index';

const outputDir = path.join(process.cwd(), 'test-outputs');

const collect = async (stream: NodeJS.ReadableStream): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
};

// These hit the live API. Skipped rather than failed when no key is present, so
// the suite stays green for contributors without Smallest AI credentials.
const describeLive = process.env.SMALLEST_API_KEY ? describe : describe.skip;

describe('SmallestVoice', () => {
  it('throws when no API key is available', () => {
    const key = process.env.SMALLEST_API_KEY;
    delete process.env.SMALLEST_API_KEY;
    expect(() => new SmallestVoice()).toThrow('SMALLEST_API_KEY must be set');
    if (key) {
      process.env.SMALLEST_API_KEY = key;
    }
  });

  it('rejects input past the model limit with an actionable message', async () => {
    const voice = new SmallestVoice({ speechModel: { apiKey: 'test-key' } });
    await expect(voice.speak('a'.repeat(SMALLEST_MAX_INPUT_CHARS + 1))).rejects.toThrow(/at most 250/);
  });

  it('rejects empty input before making a request', async () => {
    const voice = new SmallestVoice({ speechModel: { apiKey: 'test-key' } });
    await expect(voice.speak('   ')).rejects.toThrow('Input text is empty');
  });

  it('reports listening as supported', async () => {
    const voice = new SmallestVoice({ speechModel: { apiKey: 'test-key' } });
    await expect(voice.getListener()).resolves.toStrictEqual({ enabled: true });
  });
});

describeLive('SmallestVoice (live API)', () => {
  let voice: SmallestVoice;

  beforeAll(() => {
    voice = new SmallestVoice();
    mkdirSync(outputDir, { recursive: true });
  });

  it('lists the configured pool voices', async () => {
    const speakers = await voice.getSpeakers();

    expect(speakers.length).toBeGreaterThan(0);
    expect(speakers[0]).toHaveProperty('voiceId');
  }, 30000);

  it('synthesizes speech as a playable WAV', async () => {
    const audio = await collect(await voice.speak('Hello from Mastra!'));

    expect(audio.length).toBeGreaterThan(44);
    expect(audio.subarray(0, 4).toString()).toBe('RIFF');
    writeFileSync(path.join(outputDir, 'smallest-speak.wav'), audio);
  }, 30000);

  it('accepts a stream as speak input', async () => {
    const audio = await collect(await voice.speak(Readable.from(['Streamed input.'])));

    expect(audio.length).toBeGreaterThan(44);
  }, 30000);

  it('honors a per-call speaker override', async () => {
    const [first] = await voice.getSpeakers();
    const audio = await collect(await voice.speak('Voice override.', { speaker: first!.voiceId }));

    expect(audio.length).toBeGreaterThan(44);
  }, 30000);

  it('transcribes what it just synthesized', async () => {
    const spoken = path.join(outputDir, 'smallest-roundtrip.wav');
    writeFileSync(spoken, await collect(await voice.speak('The quick brown fox.')));

    const transcript = await voice.listen(createReadStream(spoken));

    expect(transcript.toLowerCase()).toContain('fox');
  }, 60000);
});
