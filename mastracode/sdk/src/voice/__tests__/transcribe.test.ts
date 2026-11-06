import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { delay, http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { AuthStorage } from '../../auth/storage.js';
import { resolveSTTModel, sttProviders } from '../stt-registry.js';
import { createSTTTranscriber, resolveSTTApiKey, sttApiKeyEnvVar } from '../transcribe.js';

interface TranscriptionRequest {
  url: string;
  authorization: string | null;
  model: FormDataEntryValue | null;
  filename: string | undefined;
}

const requests: TranscriptionRequest[] = [];

async function recordForm(request: Request): Promise<void> {
  const form = await request.formData();
  const file = form.get('file');
  requests.push({
    url: request.url,
    authorization: request.headers.get('authorization'),
    model: form.get('model'),
    filename: file instanceof File ? file.name : undefined,
  });
}

const server = setupServer(
  http.post('https://api.openai.com/v1/audio/transcriptions', async ({ request }) => {
    await recordForm(request);
    return HttpResponse.json({ text: '  from openai  ' });
  }),
  http.post('https://api.groq.com/openai/v1/audio/transcriptions', async ({ request }) => {
    await recordForm(request);
    return HttpResponse.json({ text: '  from groq  ' });
  }),
  http.post('https://api.mistral.ai/v1/audio/transcriptions', async ({ request }) => {
    await recordForm(request);
    return HttpResponse.json({ model: 'voxtral-mini-latest', text: '  from voxtral  ', language: 'en', usage: {} });
  }),
  http.post('https://api.deepgram.com/v1/listen', ({ request }) => {
    requests.push({
      url: request.url,
      authorization: request.headers.get('authorization'),
      model: new URL(request.url).searchParams.get('model'),
      filename: undefined,
    });
    return HttpResponse.json({
      metadata: {},
      results: { channels: [{ alternatives: [{ transcript: '  from deepgram  ', words: [] }] }] },
    });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => {
  requests.length = 0;
  server.resetHandlers();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

const AUDIO = Buffer.from('fake-wav');

const tempDirs: string[] = [];
afterAll(() => tempDirs.forEach(dir => rmSync(dir, { recursive: true, force: true })));

function storedKeys(keys: Record<string, string>): AuthStorage {
  const dir = mkdtempSync(join(tmpdir(), 'stt-keys-'));
  tempDirs.push(dir);
  const storage = new AuthStorage(join(dir, 'auth.json'));
  for (const [provider, key] of Object.entries(keys)) storage.setStoredApiKey(provider, key);
  return storage;
}

describe('createSTTTranscriber', () => {
  it.each([
    { provider: 'openai', model: 'whisper-1', host: 'api.openai.com', text: 'from openai' },
    { provider: 'groq', model: 'whisper-large-v3-turbo', host: 'api.groq.com', text: 'from groq' },
    { provider: 'mistral', model: 'voxtral-mini-latest', host: 'api.mistral.ai', text: 'from voxtral' },
  ])('transcribes with $provider using only the key it is given', async ({ provider, model, host, text }) => {
    for (const envVar of ['OPENAI_API_KEY', 'GROQ_API_KEY', 'MISTRAL_API_KEY']) vi.stubEnv(envVar, '');

    const transcriber = await createSTTTranscriber(resolveSTTModel(provider, model), 'given-key');

    expect(await transcriber.transcribe(AUDIO, 'wav')).toBe(text);
    expect(requests).toEqual([
      { url: expect.stringContaining(host), authorization: 'Bearer given-key', model, filename: 'audio.wav' },
    ]);
  });

  it('asks Deepgram for the configured model only and reads the transcript out of its reply', async () => {
    vi.stubEnv('DEEPGRAM_API_KEY', '');

    const transcriber = await createSTTTranscriber(resolveSTTModel('deepgram'), 'dg-key');

    expect(await transcriber.transcribe(AUDIO, 'wav')).toBe('from deepgram');
    expect(requests).toEqual([expect.objectContaining({ authorization: 'Token dg-key', model: 'nova-3' })]);
    expect([...new URL(requests[0]?.url ?? '').searchParams.keys()]).toEqual(['model']);
  });

  it('gives up when the provider never answers', async () => {
    vi.stubEnv('DEEPGRAM_API_KEY', '');
    server.use(http.post('https://api.deepgram.com/v1/listen', () => delay('infinite')));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const transcriber = await createSTTTranscriber(resolveSTTModel('deepgram'), 'dg-key');

    const attempt = expect(transcriber.transcribe(AUDIO, 'wav')).rejects.toThrow(
      'Speech-to-text timed out after 1 minute.',
    );
    await vi.advanceTimersByTimeAsync(60_000);

    await attempt;
  });

  describe('OpenAI organization and project from the environment', () => {
    async function accountHeadersSent(provider: string, model: string, apiKey: string) {
      const sent: Array<{ organization: string | null; project: string | null }> = [];
      const record = ({ request }: { request: Request }) => {
        sent.push({
          organization: request.headers.get('openai-organization'),
          project: request.headers.get('openai-project'),
        });
        return HttpResponse.json({ text: 'ok' });
      };
      server.use(
        http.post('https://api.openai.com/v1/audio/transcriptions', record),
        http.post('https://api.groq.com/openai/v1/audio/transcriptions', record),
      );
      vi.stubEnv('OPENAI_API_KEY', 'server-key');
      vi.stubEnv('OPENAI_ORG_ID', 'org-server');
      vi.stubEnv('OPENAI_PROJECT_ID', 'proj-server');

      const transcriber = await createSTTTranscriber(resolveSTTModel(provider, model), apiKey);
      await transcriber.transcribe(AUDIO, 'wav');
      return sent;
    }

    it("are not sent with a tenant's own key", async () => {
      expect(await accountHeadersSent('openai', 'whisper-1', 'tenant-key')).toEqual([
        { organization: null, project: null },
      ]);
    });

    it('are still sent with the OPENAI_API_KEY they belong to', async () => {
      expect(await accountHeadersSent('openai', 'whisper-1', 'server-key')).toEqual([
        { organization: 'org-server', project: 'proj-server' },
      ]);
    });

    it('are not sent to an OpenAI-compatible provider', async () => {
      expect(await accountHeadersSent('groq', 'whisper-large-v3-turbo', 'groq-key')).toEqual([
        { organization: null, project: null },
      ]);
    });
  });
});

describe('resolveSTTApiKey', () => {
  it("prefers the provider's env var over the stored key", () => {
    vi.stubEnv('MISTRAL_API_KEY', 'env-key');
    expect(resolveSTTApiKey('mistral', storedKeys({ mistral: 'stored-key' }))).toBe('env-key');
  });

  it('falls back to the stored key when the env var is unset', () => {
    vi.stubEnv('MISTRAL_API_KEY', '');
    expect(resolveSTTApiKey('mistral', storedKeys({ mistral: 'stored-key' }))).toBe('stored-key');
  });

  it.each([
    { provider: 'nearai', envVar: 'NEARAI_API_KEY' },
    { provider: 'deepgram', envVar: 'DEEPGRAM_API_KEY' },
  ])('reads the $envVar env var for $provider', ({ provider, envVar }) => {
    vi.stubEnv(envVar, 'env-key');
    expect(resolveSTTApiKey(provider)).toBe('env-key');
  });

  it.each(sttProviders())('knows which env var holds the %s key', provider => {
    expect(sttApiKeyEnvVar(provider)).toMatch(/_API_KEY$/);
  });
});
