import { createReadStream, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

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
    try {
      expect(() => new SmallestVoice()).toThrow('SMALLEST_API_KEY must be set');
    } finally {
      if (key) {
        process.env.SMALLEST_API_KEY = key;
      }
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

describe('SmallestVoice request shapes', () => {
  const mockFetch = (body: BodyInit) => vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(body));

  const requestOf = (fetchMock: ReturnType<typeof mockFetch>) => {
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    return { url, init, headers: init.headers as Record<string, string> };
  };

  afterEach(() => vi.restoreAllMocks());

  it('posts synthesis to the unified /tts route', async () => {
    const fetchMock = mockFetch(new Uint8Array([1, 2, 3]));
    const voice = new SmallestVoice({ speechModel: { apiKey: 'test-key', speed: 1.2, sampleRate: 24000 } });

    await voice.speak('Hello from Mastra!', { speaker: 'raj' });

    const { url, init, headers } = requestOf(fetchMock);
    expect(url).toBe('https://api.smallest.ai/waves/v1/tts');
    expect(init.method).toBe('POST');
    expect(headers).toStrictEqual({
      Authorization: 'Bearer test-key',
      'Content-Type': 'application/json',
      Accept: 'audio/wav',
    });
    expect(JSON.parse(init.body as string)).toStrictEqual({
      text: 'Hello from Mastra!',
      voice_id: 'raj',
      model: 'lightning_v3.1_pro',
      language: 'auto',
      output_format: 'wav',
      sample_rate: 24000,
      speed: 1.2,
    });
  });

  it('posts transcription audio as an octet stream with its options in the query', async () => {
    const fetchMock = mockFetch(JSON.stringify({ transcription: 'the quick brown fox' }));
    const voice = new SmallestVoice({ listeningModel: { apiKey: 'listen-key' } });

    const transcript = await voice.listen(Readable.from([Buffer.from('audio')]), {
      language: 'en',
      wordTimestamps: true,
    });

    expect(transcript).toBe('the quick brown fox');
    const { url, init, headers } = requestOf(fetchMock);
    expect(url).toBe('https://api.smallest.ai/waves/v1/stt/?model=pulse&language=en&word_timestamps=true');
    expect(init.method).toBe('POST');
    expect(headers).toStrictEqual({
      Authorization: 'Bearer listen-key',
      'Content-Type': 'application/octet-stream',
    });
    expect(Buffer.from(init.body as Uint8Array).toString()).toBe('audio');
  });

  // The catalog is not per-pool: only `lightning-v3.1` is a valid segment, and
  // it answers with the standard and Pro voices together.
  it('gets the catalog from the lightning-v3.1 path regardless of the configured pool', async () => {
    const fetchMock = mockFetch(JSON.stringify({ voices: [{ voiceId: 'meher' }] }));
    const voice = new SmallestVoice({ speechModel: { apiKey: 'test-key', model: 'lightning_v3.1_pro' } });

    await expect(voice.getSpeakers()).resolves.toStrictEqual([{ voiceId: 'meher' }]);

    const { url, init, headers } = requestOf(fetchMock);
    expect(url).toBe('https://api.smallest.ai/waves/v1/lightning-v3.1/get_voices');
    expect(init.method).toBeUndefined();
    expect(headers).toStrictEqual({ Authorization: 'Bearer test-key' });
  });

  it('surfaces the status and body of a failed request', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('concurrency limit reached', { status: 429, statusText: 'Too Many Requests' }),
    );
    const voice = new SmallestVoice({ speechModel: { apiKey: 'test-key' } });

    await expect(voice.speak('Hello')).rejects.toThrow(
      'Smallest AI TTS error [429 Too Many Requests]: concurrency limit reached',
    );
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
