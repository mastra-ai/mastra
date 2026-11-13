import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  GET_GATEWAY_AUDIO_MODELS_ROUTE,
  POST_GATEWAY_AUDIO_SPEECH_ROUTE,
  POST_GATEWAY_AUDIO_TRANSCRIPTION_ROUTE,
} from './gateway-audio';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function enableDeployment() {
  vi.stubEnv('MASTRA_GATEWAY_VERSION', 'v2');
  vi.stubEnv('MASTRA_GATEWAY_API_KEY', 'msk-gateway-test');
  vi.stubEnv('MASTRA_SHARED_API_URL', 'https://platform.example/v1');
  vi.stubEnv('MASTRA_GATEWAY_URL', 'https://gateway.example');
}

function studioRequest() {
  return new Request('https://studio.example/api/system/gateway-audio/models', {
    headers: { cookie: '__Host-wos-session=session-data; unrelated=private' },
  });
}

describe('Gateway audio routes', () => {
  it('does not expose models without an injected V2 key', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await GET_GATEWAY_AUDIO_MODELS_ROUTE.handler({ request: studioRequest() } as Parameters<
      typeof GET_GATEWAY_AUDIO_MODELS_ROUTE.handler
    >[0]);

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('recognizes the legacy V2 key prefix used by Gateway dispatch', async () => {
    enableDeployment();
    vi.stubEnv('MASTRA_GATEWAY_API_KEY', 'mskv2_test');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ enabled: true }))
      .mockResolvedValueOnce(Response.json({ data: [] }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await GET_GATEWAY_AUDIO_MODELS_ROUTE.handler({ request: studioRequest() } as Parameters<
      typeof GET_GATEWAY_AUDIO_MODELS_ROUTE.handler
    >[0]);

    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toEqual({ authorization: 'Bearer mskv2_test' });
  });

  it('checks the signed-in user flag before listing key-scoped models', async () => {
    enableDeployment();
    const fetchMock = vi.fn(async () => Response.json({ enabled: false }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await GET_GATEWAY_AUDIO_MODELS_ROUTE.handler({ request: studioRequest() } as Parameters<
      typeof GET_GATEWAY_AUDIO_MODELS_ROUTE.handler
    >[0]);

    expect(response.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://platform.example/v1/gateway/audio/access');
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual({ cookie: '__Host-wos-session=session-data' });
  });

  it('offers transcription and reviewed MP3 speech models from the valid key', async () => {
    enableDeployment();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ enabled: true }))
      .mockResolvedValueOnce(
        Response.json({
          data: [
            { id: 'speak-mp3', endpoints: ['speech'], speech: { formats: ['mp3'], voices: ['george'] } },
            { id: 'speak-pcm', endpoints: ['speech'], speech: { formats: ['pcm'], voices: [] } },
            { id: 'listen', endpoints: ['transcription'] },
          ],
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const response = await GET_GATEWAY_AUDIO_MODELS_ROUTE.handler({ request: studioRequest() } as Parameters<
      typeof GET_GATEWAY_AUDIO_MODELS_ROUTE.handler
    >[0]);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      speech: [{ id: 'speak-mp3', voices: ['george'] }],
      transcription: [{ id: 'listen' }],
    });
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://gateway.example/v1/models');
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toEqual({ authorization: 'Bearer msk-gateway-test' });
  });

  it('rejects cross-site audio POSTs before using the deployment key', async () => {
    enableDeployment();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const request = new Request('https://studio.example/api/system/gateway-audio/speech', {
      method: 'POST',
      headers: {
        cookie: '__Host-wos-session=session-data',
        origin: 'https://other.example',
        'sec-fetch-site': 'cross-site',
      },
    });

    const speech = await POST_GATEWAY_AUDIO_SPEECH_ROUTE.handler({
      request,
      model: 'speak-mp3',
      input: 'Hello',
      voice: 'george',
    } as Parameters<typeof POST_GATEWAY_AUDIO_SPEECH_ROUTE.handler>[0]);
    const transcription = await POST_GATEWAY_AUDIO_TRANSCRIPTION_ROUTE.handler({ request } as Parameters<
      typeof POST_GATEWAY_AUDIO_TRANSCRIPTION_ROUTE.handler
    >[0]);

    expect(speech.status).toBe(403);
    expect(transcription.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forces MP3 output for speech requests', async () => {
    enableDeployment();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ enabled: true }))
      .mockResolvedValueOnce(new Response('audio', { headers: { 'content-type': 'audio/mpeg' } }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await POST_GATEWAY_AUDIO_SPEECH_ROUTE.handler({
      request: studioRequest(),
      model: 'speak-mp3',
      input: 'Hello',
      voice: 'george',
    } as Parameters<typeof POST_GATEWAY_AUDIO_SPEECH_ROUTE.handler>[0]);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('audio/mpeg');
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1]?.body)).toEqual({
      model: 'speak-mp3',
      input: 'Hello',
      voice: 'george',
      response_format: 'mp3',
    });
  });

  it('forwards recorded audio and returns the Gateway transcript', async () => {
    enableDeployment();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ enabled: true }))
      .mockImplementationOnce(async (_url: string, init: RequestInit) => {
        const form = init.body as FormData;
        expect(form.get('model')).toBe('openai/whisper');
        expect((form.get('file') as File).name).toBe('dictation.webm');
        expect(form.get('response_format')).toBe('json');
        return Response.json({ text: 'spoken words' });
      });
    vi.stubGlobal('fetch', fetchMock);
    const form = new FormData();
    form.set('model', 'openai/whisper');
    form.set('file', new File(['audio'], 'dictation.webm', { type: 'audio/webm' }));
    const request = new Request('https://studio.example/api/system/gateway-audio/transcriptions', {
      method: 'POST',
      headers: { cookie: '__Host-wos-session=session-data' },
      body: form,
    });
    const response = await POST_GATEWAY_AUDIO_TRANSCRIPTION_ROUTE.handler({ request } as Parameters<
      typeof POST_GATEWAY_AUDIO_TRANSCRIPTION_ROUTE.handler
    >[0]);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ text: 'spoken words' });
  });
});
