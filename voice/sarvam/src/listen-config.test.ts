import { Readable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@internal/voice', () => ({
  // Keeps the constructor options the way MastraVoice does, without its runtime.
  MastraVoice: class {
    listeningModel?: { name: string; apiKey?: string };
    speechModel?: { name: string; apiKey?: string };
    speaker?: string;
    constructor(config: Record<string, any> = {}) {
      this.listeningModel = config.listeningModel;
      this.speechModel = config.speechModel;
      this.speaker = config.speaker;
    }
  },
}));

const { SarvamVoice } = await import('./index');

async function sentForm(voice: InstanceType<typeof SarvamVoice>, options?: Record<string, any>) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ transcript: 'ok' }), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  await voice.listen(Readable.from([Buffer.from('RIFF')]), options);
  const init = fetchMock.mock.calls[0]![1] as RequestInit;
  return init.body as FormData;
}

describe('SarvamVoice.listen', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the listening model, language and mode set in the constructor', async () => {
    const voice = new SarvamVoice({
      listeningModel: { apiKey: 'test-key', model: 'saaras:v3', languageCode: 'hi-IN', mode: 'translit' },
    });

    const form = await sentForm(voice);

    expect(form.get('model')).toBe('saaras:v3');
    expect(form.get('language_code')).toBe('hi-IN');
    expect(form.get('mode')).toBe('translit');
  });

  it('lets per-call options override the constructor', async () => {
    const voice = new SarvamVoice({
      listeningModel: { apiKey: 'test-key', model: 'saaras:v3', languageCode: 'hi-IN' },
    });

    const form = await sentForm(voice, { model: 'saarika:v2.5', languageCode: 'ta-IN' });

    expect(form.get('model')).toBe('saarika:v2.5');
    expect(form.get('language_code')).toBe('ta-IN');
  });

  it('applies the constructor mode only to the constructor model', async () => {
    const voice = new SarvamVoice({
      listeningModel: { apiKey: 'test-key', model: 'saaras:v3', mode: 'translit' },
    });

    expect((await sentForm(voice, { model: 'saarika:v2.5' })).has('mode')).toBe(false);
    expect((await sentForm(voice, { mode: 'codemix' })).get('mode')).toBe('codemix');
  });

  it('keeps the previous defaults when nothing is configured', async () => {
    const voice = new SarvamVoice({ listeningModel: { apiKey: 'test-key' } });

    const form = await sentForm(voice);

    expect(form.get('model')).toBe('saarika:v2.5');
    expect(form.get('language_code')).toBe('unknown');
    expect(form.has('mode')).toBe(false);
  });
});

describe('SarvamVoice API errors', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const audio = () => Readable.from([Buffer.from('RIFF')]);
  const stubResponse = (body: string, init: ResponseInit) =>
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(body, init)),
    );

  it('listen() rejects with Sarvam error.message on 403', async () => {
    stubResponse(JSON.stringify({ error: { message: 'Invalid API key', code: 'invalid_api_key_error' } }), {
      status: 403,
    });
    const voice = new SarvamVoice({ listeningModel: { name: 'saarika:v2.5', apiKey: 'k' } } as any);
    await expect(voice.listen(audio())).rejects.toThrow('Sarvam AI API Error: Invalid API key');
  });

  it('listen() rejects with status text on non-JSON error body', async () => {
    stubResponse('oops', { status: 500, statusText: 'Internal Server Error' });
    const voice = new SarvamVoice({ listeningModel: { name: 'saarika:v2.5', apiKey: 'k' } } as any);
    await expect(voice.listen(audio())).rejects.toThrow('Sarvam AI API Error: Internal Server Error');
  });

  it('listen() still returns the transcript on success', async () => {
    stubResponse(JSON.stringify({ transcript: 'hello' }), { status: 200 });
    const voice = new SarvamVoice({ listeningModel: { name: 'saarika:v2.5', apiKey: 'k' } } as any);
    await expect(voice.listen(audio())).resolves.toBe('hello');
  });

  it('speak() rejects with Sarvam error.message on 403', async () => {
    stubResponse(JSON.stringify({ error: { message: 'Invalid API key' } }), { status: 403 });
    const voice = new SarvamVoice({ speechModel: { name: 'bulbul:v2', apiKey: 'k' } } as any);
    await expect(voice.speak('hi')).rejects.toThrow('Sarvam AI API Error: Invalid API key');
  });

  it('speak() falls back to top-level message', async () => {
    stubResponse(JSON.stringify({ message: 'Legacy failure' }), { status: 400 });
    const voice = new SarvamVoice({ speechModel: { name: 'bulbul:v2', apiKey: 'k' } } as any);
    await expect(voice.speak('hi')).rejects.toThrow('Sarvam AI API Error: Legacy failure');
  });
});
