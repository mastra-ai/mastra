import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { AuthStorage } from '../../auth/storage.js';
import { resolveSTTModel } from '../stt-registry.js';
import { createSTTTranscriber, resolveSTTApiKey } from '../transcribe.js';

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
  // OpenAIVoice and MistralVoice read their TTS key from OPENAI_API_KEY/MISTRAL_API_KEY and throw without it.
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

  it('reads the transcript out of the object Deepgram returns', async () => {
    vi.stubEnv('DEEPGRAM_API_KEY', '');

    const transcriber = await createSTTTranscriber(resolveSTTModel('deepgram'), 'dg-key');

    expect(await transcriber.transcribe(AUDIO, 'wav')).toBe('from deepgram');
    expect(requests).toEqual([expect.objectContaining({ authorization: 'Token dg-key', model: 'nova-3' })]);
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
});
