import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('elevenlabs', () => ({
  ElevenLabsClient: class {
    constructor(public options: { apiKey: string }) {}
    voices = { getAll: async () => ({ voices: [{ voice_id: this.options.apiKey, name: 'n', labels: {} }] }) };
    generate = async () => Readable.from([this.options.apiKey]);
    speechToText = { convert: async () => ({ text: `transcribed with ${this.options.apiKey}` }) };
  },
}));

import { ElevenLabsVoice } from './index';

const audio = () => Readable.from([Buffer.from('audio')]);
const readAll = async (s: NodeJS.ReadableStream) => {
  let out = '';
  for await (const c of s) out += c.toString();
  return out;
};

describe('ElevenLabsVoice per-model API keys', () => {
  let saved: string | undefined;
  beforeEach(() => {
    saved = process.env.ELEVENLABS_API_KEY;
    delete process.env.ELEVENLABS_API_KEY;
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.ELEVENLABS_API_KEY;
    else process.env.ELEVENLABS_API_KEY = saved;
  });

  it('can be constructed with only a listening model key', async () => {
    const voice = new ElevenLabsVoice({ listeningModel: { name: 'scribe_v1', apiKey: 'listen-key' } });
    expect(await voice.listen(audio())).toBe('transcribed with listen-key');
  });

  it('uses each model key for its own capability', async () => {
    const voice = new ElevenLabsVoice({
      speechModel: { name: 'eleven_multilingual_v2', apiKey: 'speech-key' },
      listeningModel: { name: 'scribe_v1', apiKey: 'listen-key' },
    });
    expect(await voice.listen(audio())).toBe('transcribed with listen-key');
    expect(await readAll(await voice.speak('hi'))).toBe('speech-key');
    expect((await voice.getSpeakers())[0]!.voiceId).toBe('speech-key');
  });

  it('throws when no key is available', () => {
    expect(() => new ElevenLabsVoice()).toThrow('ELEVENLABS_API_KEY is not set');
  });

  it('falls back to the env key for both models', async () => {
    process.env.ELEVENLABS_API_KEY = 'env-key';
    const voice = new ElevenLabsVoice();
    expect(await voice.listen(audio())).toBe('transcribed with env-key');
    expect(await readAll(await voice.speak('hi'))).toBe('env-key');
  });

  it('throws a clear error when speaking without a speech key', async () => {
    const voice = new ElevenLabsVoice({ listeningModel: { name: 'scribe_v1', apiKey: 'listen-key' } });
    await expect(voice.speak('hi')).rejects.toThrow('ElevenLabs speech API key is not set');
  });

  it('reports listening as disabled when no listening key is available', async () => {
    const voice = new ElevenLabsVoice({ speechModel: { name: 'eleven_multilingual_v2', apiKey: 'speech-key' } });
    expect(await voice.getListener()).toEqual({ enabled: false });
    await expect(voice.listen(audio())).rejects.toThrow('ElevenLabs listening API key is not set');
  });
});
