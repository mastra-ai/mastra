import { Readable } from 'node:stream';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MINIMAX_AUDIO_FORMATS, MINIMAX_SPEECH_MODELS, MiniMaxVoice } from './index';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function response(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Bad Request',
    json: async () => payload,
  } as Response;
}

describe('MiniMaxVoice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MINIMAX_API_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.MINIMAX_API_KEY;
  });

  it('uses the current default model and complete model catalog', () => {
    const voice = new MiniMaxVoice({ speaker: 'test-voice' });

    expect(voice.serializeForSpan().speechModel).toEqual({ name: 'speech-2.8-hd' });
    expect(MINIMAX_SPEECH_MODELS).toEqual([
      'speech-2.8-hd',
      'speech-2.8-turbo',
      'speech-2.6-hd',
      'speech-2.6-turbo',
      'speech-02-hd',
      'speech-02-turbo',
      'speech-01-hd',
      'speech-01-turbo',
    ]);
    expect(MINIMAX_AUDIO_FORMATS).toEqual(['mp3', 'wav', 'flac', 'pcm']);
  });

  it('sends the supported request fields to the global endpoint', async () => {
    fetchMock.mockResolvedValueOnce(
      response({ data: { audio: '48656c6c6f', status: 2 }, base_resp: { status_code: 0, status_msg: 'success' } }),
    );
    const voice = new MiniMaxVoice({
      speechModel: {
        apiKey: 'test-key',
        properties: {
          stream: false,
          language_boost: 'auto',
          pronunciation_dict: { tone: ['hello/hei3 lou2'] },
          audio_setting: { format: 'flac', sample_rate: 32000 },
          voice_modify: { pitch: 1 },
          subtitle_enable: true,
        },
      },
      speaker: 'test-voice',
    });

    const audio = await voice.speak('Hello');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);

    expect(url).toBe('https://api.minimax.io/v1/t2a_v2');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ Authorization: 'Bearer test-key', 'Content-Type': 'application/json' });
    expect(body).toEqual({
      model: 'speech-2.8-hd',
      text: 'Hello',
      stream: false,
      language_boost: 'auto',
      output_format: 'hex',
      voice_setting: { voice_id: 'test-voice' },
      pronunciation_dict: { tone: ['hello/hei3 lou2'] },
      audio_setting: { format: 'flac', sample_rate: 32000 },
      voice_modify: { pitch: 1 },
      subtitle_enable: true,
    });
    await expect(streamToBuffer(audio)).resolves.toEqual(Buffer.from('Hello'));
  });

  it('uses the China endpoint and accepts stream input and per-call overrides', async () => {
    fetchMock.mockResolvedValueOnce(
      response({ data: { audio: '77617665', status: 2 }, base_resp: { status_code: 0 } }),
    );
    const voice = new MiniMaxVoice({
      speechModel: { apiKey: 'test-key', region: 'china' },
      speaker: 'default-voice',
    });

    await voice.speak(Readable.from(['Hello', ' world']), {
      model: 'speech-2.8-turbo',
      speaker: 'request-voice',
      properties: { stream: false, audio_setting: { format: 'wav' } },
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(url).toBe('https://api.minimaxi.com/v1/t2a_v2');
    expect(body).toMatchObject({
      model: 'speech-2.8-turbo',
      text: 'Hello world',
      voice_setting: { voice_id: 'request-voice' },
      audio_setting: { format: 'wav' },
    });
  });

  it('requires an API key and a speaker', async () => {
    delete process.env.MINIMAX_API_KEY;
    expect(() => new MiniMaxVoice({ speaker: 'test-voice' })).toThrow('MINIMAX_API_KEY is not set');

    const voice = new MiniMaxVoice({ speechModel: { apiKey: 'test-key' } });
    await expect(voice.speak('Hello')).rejects.toThrow('A MiniMax speaker voice ID is required');
  });

  it('reports API status errors', async () => {
    fetchMock.mockResolvedValueOnce(
      response({ data: { status: 1 }, base_resp: { status_code: 1004, status_msg: 'Invalid request' } }),
    );
    const voice = new MiniMaxVoice({ speaker: 'test-voice' });

    await expect(voice.speak('Hello')).rejects.toThrow('MiniMax TTS request failed: Invalid request');
  });

  it('rejects incomplete and malformed audio responses', async () => {
    fetchMock
      .mockResolvedValueOnce(response({ data: { audio: '4869', status: 1 }, base_resp: { status_code: 0 } }))
      .mockResolvedValueOnce(response({ data: { audio: 'not-hex', status: 2 }, base_resp: { status_code: 0 } }));
    const voice = new MiniMaxVoice({ speaker: 'test-voice' });

    await expect(voice.speak('Hello')).rejects.toThrow('unexpected audio status: 1');
    await expect(voice.speak('Hello')).rejects.toThrow('invalid hex audio data');
  });

  it('exposes only the configured speaker and does not support listening', async () => {
    const voice = new MiniMaxVoice({ speaker: 'test-voice' });

    await expect(voice.getSpeakers()).resolves.toEqual([{ voiceId: 'test-voice', name: 'test-voice' }]);
    await expect(voice.getListener()).resolves.toEqual({ enabled: false });
    await expect(voice.listen(Readable.from(['audio']))).rejects.toThrow('does not support speech recognition');
  });
});

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
