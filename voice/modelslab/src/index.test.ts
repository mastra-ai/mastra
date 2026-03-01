import { Readable } from 'node:stream';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { ModelsLabVoice, MODELSLAB_VOICES } from './index';

// --- fetch mock ---
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function makeJsonResponse(data: unknown, status = 200) {
  return { ok: status < 400, status, statusText: 'OK', json: async () => data } as Response;
}

describe('ModelsLabVoice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MODELSLAB_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    delete process.env.MODELSLAB_API_KEY;
  });

  describe('constructor', () => {
    it('throws if no API key is provided', () => {
      delete process.env.MODELSLAB_API_KEY;
      expect(() => new ModelsLabVoice()).toThrow('MODELSLAB_API_KEY is not set');
    });

    it('accepts apiKey via speechModel config', () => {
      expect(() => new ModelsLabVoice({ speechModel: { apiKey: 'explicit-key' } })).not.toThrow();
    });
  });

  describe('getSpeakers', () => {
    it('returns list of ModelsLab voices', async () => {
      const voice = new ModelsLabVoice();
      const speakers = await voice.getSpeakers();
      expect(speakers).toEqual(MODELSLAB_VOICES);
      expect(speakers.length).toBeGreaterThan(0);
      expect(speakers[0]).toHaveProperty('voiceId');
      expect(speakers[0]).toHaveProperty('name');
    });
  });

  describe('speak', () => {
    it('sends key in request body, not Authorization header', async () => {
      const audioBuffer = Buffer.from('fake-audio-bytes');
      fetchMock
        .mockResolvedValueOnce(
          makeJsonResponse({ status: 'success', output: 'https://cdn.modelslab.com/audio.mp3' }),
        )
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => audioBuffer.buffer,
        } as Response);

      const voice = new ModelsLabVoice({ speechModel: { apiKey: 'my-secret-key' } });
      await voice.speak('Hello world');

      const [ttsUrl, ttsInit] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(ttsInit.body as string);

      expect(body.key).toBe('my-secret-key');
      expect(body.prompt).toBe('Hello world');
      expect((ttsInit.headers as Record<string, string>)?.['Authorization']).toBeUndefined();
    });

    it('returns a Readable stream on success', async () => {
      const audioBuffer = Buffer.from('fake-audio-content');
      fetchMock
        .mockResolvedValueOnce(
          makeJsonResponse({ status: 'success', output: 'https://cdn.modelslab.com/audio.mp3' }),
        )
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => audioBuffer.buffer,
        } as Response);

      const voice = new ModelsLabVoice();
      const result = await voice.speak('Test text');
      expect(result).toBeInstanceOf(Readable);
    });

    it('maps OpenAI voice names to ModelsLab voice_id', async () => {
      const audioBuffer = Buffer.from('audio');
      fetchMock
        .mockResolvedValueOnce(makeJsonResponse({ status: 'success', output: 'https://cdn.modelslab.com/audio.mp3' }))
        .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => audioBuffer.buffer } as Response);

      const voice = new ModelsLabVoice();
      await voice.speak('Hello', { speaker: 'nova' }); // 'nova' → voice_id 5

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.voice_id).toBe(5);
    });

    it('polls when status is processing then returns audio', async () => {
      vi.useFakeTimers();
      const audioBuffer = Buffer.from('audio-bytes');

      fetchMock
        .mockResolvedValueOnce(
          makeJsonResponse({ status: 'processing', request_id: 'req_123', eta: 5 }),
        )
        .mockResolvedValueOnce(
          makeJsonResponse({ status: 'success', output: 'https://cdn.modelslab.com/audio.mp3' }),
        )
        .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => audioBuffer.buffer } as Response);

      const voice = new ModelsLabVoice();
      const speakPromise = voice.speak('Async text');

      // Advance time past poll interval
      await vi.advanceTimersByTimeAsync(6000);

      const result = await speakPromise;
      expect(result).toBeInstanceOf(Readable);
      // Verify poll request went to fetch URL
      expect(fetchMock.mock.calls[1][0]).toContain('/voice/fetch/req_123');

      vi.useRealTimers();
    });

    it('throws on error status', async () => {
      fetchMock.mockResolvedValueOnce(
        makeJsonResponse({ status: 'error', message: 'Invalid API key' }),
      );

      const voice = new ModelsLabVoice();
      await expect(voice.speak('test')).rejects.toThrow('Invalid API key');
    });
  });

  describe('listen', () => {
    it('throws NotImplemented', async () => {
      const voice = new ModelsLabVoice();
      const stream = Readable.from(['audio']);
      await expect(voice.listen(stream)).rejects.toThrow('does not support speech-to-text');
    });
  });
});
