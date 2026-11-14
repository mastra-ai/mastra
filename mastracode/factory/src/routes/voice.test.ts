import type { Hono } from 'hono';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { factoryVoiceSettingsKey, MAX_TRANSCRIBE_AUDIO_BYTES } from '../voice/transcription.js';
import { localAuthStorage, mountVoiceRoutes as mount } from './__tests__/voice-routes.js';
import { fakeRouteAuth } from './test-utils.js';

const OPENAI_URL = 'https://api.openai.com/v1/audio/transcriptions';
const MISTRAL_URL = 'https://api.mistral.ai/v1/audio/transcriptions';

interface ProviderCall {
  authorization: string | null;
  model: FormDataEntryValue | null;
  filename: string | undefined;
}

const calls: { openai: ProviderCall[]; mistral: ProviderCall[] } = { openai: [], mistral: [] };

async function record(request: Request): Promise<ProviderCall> {
  const form = await request.formData();
  const file = form.get('file');
  return {
    authorization: request.headers.get('authorization'),
    model: form.get('model'),
    filename: file instanceof File ? file.name : undefined,
  };
}

const server = setupServer(
  http.post(OPENAI_URL, async ({ request }) => {
    calls.openai.push(await record(request));
    return HttpResponse.json({ text: '  hello from whisper  ' });
  }),
  http.post(MISTRAL_URL, async ({ request }) => {
    calls.mistral.push(await record(request));
    return HttpResponse.json({ model: 'voxtral-mini-latest', text: 'hello from voxtral', language: 'en', usage: {} });
  }),
);

const ENV_KEYS = ['OPENAI_API_KEY', 'MISTRAL_API_KEY', 'GROQ_API_KEY', 'DEEPGRAM_API_KEY'] as const;
const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string>> = {};

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
beforeEach(() => {
  calls.openai = [];
  calls.mistral = [];
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});
afterEach(() => {
  server.resetHandlers();
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

const clip = Buffer.from('fake opus bytes');

function transcribe(
  app: Hono,
  { mimeType, factoryId, audio = clip }: { mimeType: string; factoryId?: string; audio?: Buffer },
) {
  const query = factoryId ? `?factoryId=${factoryId}` : '';
  return app.request(`/web/voice/transcribe${query}`, {
    method: 'POST',
    headers: { 'content-type': mimeType },
    body: new Uint8Array(audio),
  });
}

describe('POST /web/voice/transcribe (local mode)', () => {
  it('transcribes with the first provider that has a key and returns trimmed text', async () => {
    const app = await mount({ authStorage: localAuthStorage({ openai: 'sk-local' }) });

    const res = await transcribe(app, { mimeType: 'audio/webm;codecs=opus' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: 'hello from whisper', provider: 'openai', model: 'whisper-1' });
    expect(calls.openai).toEqual([{ authorization: 'Bearer sk-local', model: 'whisper-1', filename: 'audio.webm' }]);
  });

  it('prefers the provider env var over a stored key', async () => {
    process.env.MISTRAL_API_KEY = 'env-mistral';
    const app = await mount({ authStorage: localAuthStorage({ mistral: 'stored-mistral' }) });

    const res = await transcribe(app, { mimeType: 'audio/mp4' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: 'hello from voxtral', provider: 'mistral', model: 'voxtral-mini-latest' });
    expect(calls.mistral).toHaveLength(1);
    expect(calls.mistral[0]!.authorization).toBe('Bearer env-mistral');
    expect(calls.mistral[0]!.model).toBe('voxtral-mini-latest');
  });

  it('explains how to fix a missing key without calling any provider', async () => {
    const app = await mount({ authStorage: localAuthStorage({}) });

    const res = await transcribe(app, { mimeType: 'audio/webm' });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/speech-to-text API key/);
    expect(calls.openai).toHaveLength(0);
    expect(calls.mistral).toHaveLength(0);
  });

  it('rejects a body that is not an audio recording', async () => {
    const app = await mount({ authStorage: localAuthStorage({ openai: 'sk-local' }) });

    const res = await transcribe(app, { mimeType: 'application/json' });

    expect(res.status).toBe(415);
    expect(calls.openai).toHaveLength(0);
  });

  it('rejects an empty recording', async () => {
    const app = await mount({ authStorage: localAuthStorage({ openai: 'sk-local' }) });

    const res = await transcribe(app, { mimeType: 'audio/webm', audio: Buffer.alloc(0) });

    expect(res.status).toBe(400);
    expect(calls.openai).toHaveLength(0);
  });

  it('rejects a recording over the size cap', async () => {
    const app = await mount({ authStorage: localAuthStorage({ openai: 'sk-local' }) });

    const res = await transcribe(app, { mimeType: 'audio/webm', audio: Buffer.alloc(MAX_TRANSCRIBE_AUDIO_BYTES + 1) });

    expect(res.status).toBe(413);
    expect(calls.openai).toHaveLength(0);
  });

  it('surfaces provider failures as 502', async () => {
    server.use(http.post(OPENAI_URL, () => HttpResponse.json({ error: { message: 'bad key' } }, { status: 401 })));
    const app = await mount({ authStorage: localAuthStorage({ openai: 'sk-bad' }) });

    const res = await transcribe(app, { mimeType: 'audio/webm' });

    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/^Transcription failed:/);
  });
});

describe('POST /web/voice/transcribe (tenant mode)', () => {
  it("uses the caller's personal key, not the organization's", async () => {
    const seed = await createFactoryStorageForTests();
    await seed.credentials.setCredential({ orgId: 'org1' }, 'mistral', { type: 'api_key', key: 'org-mistral' });
    await seed.credentials.setCredential({ orgId: 'org1', userId: 'user-a' }, 'mistral', {
      type: 'api_key',
      key: 'personal-mistral',
    });
    const app = await mount({ auth: fakeRouteAuth(), modelCredentials: seed.credentials }, { org: 'org1' });

    const res = await transcribe(app, { mimeType: 'audio/mp4' });

    expect(res.status).toBe(200);
    expect(calls.mistral[0]!.authorization).toBe('Bearer personal-mistral');
  });

  it('never uses an organization key outside a factory-scoped Factory', async () => {
    const seed = await createFactoryStorageForTests();
    await seed.credentials.setCredential({ orgId: 'org1' }, 'openai-codex', { type: 'api_key', key: 'sk-org' });
    const app = await mount({ auth: fakeRouteAuth(), modelCredentials: seed.credentials }, { org: 'org1' });

    const res = await transcribe(app, { mimeType: 'audio/webm' });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/speech-to-text API key/);
    expect(calls.openai).toEqual([]);
  });

  it('ignores OAuth subscriptions and deployment env keys', async () => {
    process.env.OPENAI_API_KEY = 'deployment-key';
    const seed = await createFactoryStorageForTests();
    await seed.credentials.setCredential({ orgId: 'org1', userId: 'user-a' }, 'openai-codex', {
      type: 'oauth',
      refresh: 'refresh',
      access: 'access',
      expires: Date.now() + 60_000,
    });
    const app = await mount({ auth: fakeRouteAuth(), modelCredentials: seed.credentials }, { org: 'org1' });

    const res = await transcribe(app, { mimeType: 'audio/webm' });

    expect(res.status).toBe(400);
    expect(calls.openai).toHaveLength(0);
  });

  it('requires a signed-in user', async () => {
    const seed = await createFactoryStorageForTests();
    const app = await mount({ auth: fakeRouteAuth(), modelCredentials: seed.credentials });

    const res = await transcribe(app, { mimeType: 'audio/webm' });

    expect(res.status).toBe(401);
  });
});

function putSettings(app: Hono, body: Record<string, unknown>) {
  return app.request('/web/voice/settings', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/web/voice/settings', () => {
  it('remembers a Gateway transcription model in the existing voice setting', async () => {
    const app = await mount({ authStorage: localAuthStorage({}) });

    const updated = await putSettings(app, { provider: 'mastra-gateway', model: 'mistral/voxtral' });
    const readBack = await app.request('/web/voice/settings');

    expect(updated.status).toBe(200);
    expect(readBack.status).toBe(200);
    expect(await readBack.json()).toMatchObject({
      selected: { provider: 'mastra-gateway', model: 'mistral/voxtral' },
    });
  });

  it('lists every registry model, reports which providers have a key, and starts on auto', async () => {
    const seed = await createFactoryStorageForTests();
    const app = await mount({
      authStorage: localAuthStorage({ mistral: 'sk-mistral' }),
      voiceSettings: seed.voiceSettings,
    });

    const res = await app.request('/web/voice/settings');

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      scope: string;
      selected: unknown;
      effective: unknown;
      canEdit: boolean;
      models: Array<{ provider: string; model: string }>;
      keys: Array<{ provider: string; saved: boolean }>;
    };
    expect(body).toMatchObject({
      scope: 'user',
      selected: null,
      canEdit: true,
      effective: { provider: 'mistral', model: 'voxtral-mini-latest' },
    });
    expect(body.models.map(m => m.model)).toEqual(expect.arrayContaining(['voxtral-mini-latest', 'whisper-1']));
    expect(body.keys.find(k => k.provider === 'mistral')?.saved).toBe(true);
    expect(body.keys.find(k => k.provider === 'openai')?.saved).toBe(false);
  });

  it('flags env-backed keys in local mode so the UI does not offer to update or remove them', async () => {
    process.env.DEEPGRAM_API_KEY = 'dg-env';
    const app = await mount({ authStorage: localAuthStorage({ mistral: 'sk-mistral' }) });

    const body = (await (await app.request('/web/voice/settings')).json()) as {
      keys: Array<{ provider: string; saved: boolean; fromEnv: boolean }>;
    };

    expect(body.keys.find(k => k.provider === 'deepgram')).toMatchObject({ saved: true, fromEnv: true });
    expect(body.keys.find(k => k.provider === 'mistral')).toMatchObject({ saved: true, fromEnv: false });
  });

  it('does not flag a key saved from the UI as env-backed, even though saving copies it into process.env', async () => {
    // AuthStorage.setStoredApiKey writes the saved key into process.env so model resolution finds it.
    process.env.OPENAI_API_KEY = 'sk-saved';
    process.env.MISTRAL_API_KEY = 'sk-env';
    const app = await mount({ authStorage: localAuthStorage({ openai: 'sk-saved', mistral: 'sk-stored' }) });

    const body = (await (await app.request('/web/voice/settings')).json()) as {
      keys: Array<{ provider: string; saved: boolean; fromEnv: boolean }>;
    };

    expect(body.keys.find(k => k.provider === 'openai')).toMatchObject({ saved: true, fromEnv: false });
    expect(body.keys.find(k => k.provider === 'mistral')).toMatchObject({ saved: true, fromEnv: true });
  });

  it('returns a named 503 on every route when voice settings storage cannot start', async () => {
    const seed = await createFactoryStorageForTests();
    vi.spyOn(seed.voiceSettings, 'ensureReady').mockRejectedValue(new Error('db down'));
    const app = await mount({
      authStorage: localAuthStorage({ openai: 'sk-openai' }),
      voiceSettings: seed.voiceSettings,
    });

    const responses = [
      await app.request('/web/voice/settings'),
      await putSettings(app, { provider: 'openai', model: 'whisper-1' }),
      await transcribe(app, { mimeType: 'audio/webm' }),
    ];

    for (const res of responses) {
      expect(res.status).toBe(503);
      expect(await res.json()).toMatchObject({ error: 'voice_settings_unavailable' });
    }
    expect(calls.openai).toEqual([]);
  });

  it('transcribes with the saved model instead of the first provider with a key', async () => {
    const seed = await createFactoryStorageForTests();
    const app = await mount({
      authStorage: localAuthStorage({ openai: 'sk-openai', mistral: 'sk-mistral' }),
      voiceSettings: seed.voiceSettings,
    });

    const saved = await putSettings(app, { provider: 'mistral', model: 'voxtral-mini-latest' });
    expect(saved.status).toBe(200);
    expect(((await saved.json()) as { selected: unknown }).selected).toEqual({
      provider: 'mistral',
      model: 'voxtral-mini-latest',
    });

    const res = await transcribe(app, { mimeType: 'audio/mp4' });

    expect(await res.json()).toMatchObject({ provider: 'mistral', model: 'voxtral-mini-latest' });
    expect(calls.openai).toEqual([]);
    expect(calls.mistral[0]!.authorization).toBe('Bearer sk-mistral');
  });

  it('goes back to auto when the choice is cleared', async () => {
    const seed = await createFactoryStorageForTests();
    const app = await mount({
      authStorage: localAuthStorage({ openai: 'sk-openai', mistral: 'sk-mistral' }),
      voiceSettings: seed.voiceSettings,
    });
    await putSettings(app, { provider: 'mistral', model: 'voxtral-mini-latest' });

    const cleared = await putSettings(app, { provider: null });
    expect(((await cleared.json()) as { selected: unknown }).selected).toBeNull();

    const res = await transcribe(app, { mimeType: 'audio/webm' });
    expect(await res.json()).toMatchObject({ provider: 'openai', model: 'whisper-1' });
  });

  it('explains a saved model whose key was removed instead of switching providers silently', async () => {
    const seed = await createFactoryStorageForTests();
    await seed.voiceSettings.set({
      orgId: 'local',
      userId: 'local',
      provider: 'mistral',
      model: 'voxtral-mini-latest',
    });
    const app = await mount({
      authStorage: localAuthStorage({ openai: 'sk-openai' }),
      voiceSettings: seed.voiceSettings,
    });

    const res = await transcribe(app, { mimeType: 'audio/webm' });

    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toContain('mistral API key');
    expect(calls.openai).toEqual([]);
  });

  it('rejects a model outside the registry', async () => {
    const seed = await createFactoryStorageForTests();
    const app = await mount({ authStorage: localAuthStorage({}), voiceSettings: seed.voiceSettings });

    const res = await putSettings(app, { provider: 'mistral', model: 'whisper-1' });

    expect(res.status).toBe(400);
    expect(await seed.voiceSettings.get({ orgId: 'local', userId: 'local' })).toBeNull();
  });

  it('requires a model alongside a provider', async () => {
    const seed = await createFactoryStorageForTests();
    const app = await mount({ authStorage: localAuthStorage({}), voiceSettings: seed.voiceSettings });

    const res = await putSettings(app, { provider: 'mistral' });

    expect(res.status).toBe(400);
    expect(await seed.voiceSettings.get({ orgId: 'local', userId: 'local' })).toBeNull();
  });

  it("keeps each signed-in user's choice separate", async () => {
    const seed = await createFactoryStorageForTests();
    const app = await mount(
      { auth: fakeRouteAuth(), modelCredentials: seed.credentials, voiceSettings: seed.voiceSettings },
      { org: 'org1' },
    );

    await putSettings(app, { provider: 'mistral', model: 'voxtral-mini-latest' });

    expect(await seed.voiceSettings.get({ orgId: 'org1', userId: 'user-a' })).toMatchObject({
      provider: 'mistral',
      model: 'voxtral-mini-latest',
    });
    expect(await seed.voiceSettings.get({ orgId: 'org1', userId: 'user-b' })).toBeNull();
  });
});

describe('Factory voice model and model scope', () => {
  async function tenantFactory(modelScope: 'factory' | 'user' | 'hybrid', isAdmin = true) {
    const seed = await createFactoryStorageForTests();
    const project = await seed.projects.create({
      orgId: 'org1',
      userId: 'user-a',
      input: { name: 'Voice', modelScope },
    });
    const app = await mount(
      {
        auth: fakeRouteAuth({ isOrganizationAdmin: async () => isAdmin }),
        modelCredentials: seed.credentials,
        voiceSettings: seed.voiceSettings,
        factoryProjects: seed.projects,
      },
      { org: 'org1' },
    );
    return { seed, app, factoryId: project.id, factoryKey: factoryVoiceSettingsKey({ ...project, modelScope }) };
  }

  async function keys(seed: Awaited<ReturnType<typeof createFactoryStorageForTests>>) {
    await seed.credentials.setCredential({ orgId: 'org1' }, 'openai-codex', { type: 'api_key', key: 'org-openai' });
    await seed.credentials.setCredential({ orgId: 'org1', userId: 'user-a' }, 'mistral', {
      type: 'api_key',
      key: 'personal-mistral',
    });
  }

  it('factory scope uses the Factory model with the org key and ignores personal choices', async () => {
    const { seed, app, factoryId } = await tenantFactory('factory');
    await keys(seed);
    await putSettings(app, { provider: 'mistral', model: 'voxtral-mini-latest' });
    const saved = await putSettings(app, { factoryId, provider: 'openai', model: 'whisper-1' });
    expect(saved.status).toBe(200);

    const res = await transcribe(app, { mimeType: 'audio/webm', factoryId });

    expect(await res.json()).toMatchObject({ provider: 'openai', model: 'whisper-1' });
    expect(calls.openai[0]!.authorization).toBe('Bearer org-openai');
    expect(calls.mistral).toEqual([]);
  });

  it('factory scope never falls back to a personal key', async () => {
    const { seed, app, factoryId } = await tenantFactory('factory');
    await seed.credentials.setCredential({ orgId: 'org1', userId: 'user-a' }, 'mistral', {
      type: 'api_key',
      key: 'personal-mistral',
    });

    const res = await transcribe(app, { mimeType: 'audio/webm', factoryId });

    expect(res.status).toBe(400);
    expect(calls.mistral).toEqual([]);
  });

  it.each(['user', 'hybrid'] as const)(
    "%s scope uses the member's own choice and key, never the org key or Factory model",
    async modelScope => {
      const { seed, app, factoryId, factoryKey } = await tenantFactory(modelScope);
      await keys(seed);
      await seed.voiceSettings.set({ ...factoryKey, provider: 'openai', model: 'whisper-1' });

      const auto = await transcribe(app, { mimeType: 'audio/mp4', factoryId });
      expect(await auto.json()).toMatchObject({ provider: 'mistral', model: 'voxtral-mini-latest' });
      expect(calls.mistral[0]!.authorization).toBe('Bearer personal-mistral');
      expect(calls.openai).toEqual([]);

      await putSettings(app, { factoryId, provider: 'openai', model: 'whisper-1' });
      const chosen = await transcribe(app, { mimeType: 'audio/webm', factoryId });
      expect(chosen.status).toBe(400);
      expect(((await chosen.json()) as { error: string }).error).toContain('openai API key');
      expect(calls.openai).toEqual([]);
    },
  );

  it('hybrid scope with only an org key asks the member to add their own key', async () => {
    const { seed, app, factoryId, factoryKey } = await tenantFactory('hybrid');
    await seed.credentials.setCredential({ orgId: 'org1' }, 'openai-codex', { type: 'api_key', key: 'org-openai' });
    await seed.voiceSettings.set({ ...factoryKey, provider: 'openai', model: 'whisper-1' });

    const res = await transcribe(app, { mimeType: 'audio/webm', factoryId });

    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/speech-to-text API key/);
    expect(calls.openai).toEqual([]);
  });

  it('factory scope reports the Factory model and which organization keys exist', async () => {
    const { seed, app, factoryId } = await tenantFactory('factory');
    await keys(seed);
    await putSettings(app, { factoryId, provider: 'openai', model: 'whisper-1' });

    const res = await app.request(`/web/voice/settings?factoryId=${factoryId}`);

    const body = (await res.json()) as Record<string, unknown> & { keys: Array<Record<string, unknown>> };
    expect(body).toMatchObject({
      scope: 'factory',
      selected: { provider: 'openai', model: 'whisper-1' },
      effective: { provider: 'openai', model: 'whisper-1' },
      canEdit: true,
    });
    expect(body.keys.find(k => k.provider === 'openai')).toEqual({
      provider: 'openai',
      envVar: 'OPENAI_API_KEY',
      saved: true,
      fromEnv: false,
    });
    expect(body.keys.find(k => k.provider === 'mistral')).toMatchObject({ provider: 'mistral', saved: false });
  });

  it("hybrid scope reports the member's own choice and personal keys", async () => {
    const { seed, app, factoryId, factoryKey } = await tenantFactory('hybrid', false);
    await keys(seed);
    await seed.voiceSettings.set({ ...factoryKey, provider: 'openai', model: 'whisper-1' });

    const res = await app.request(`/web/voice/settings?factoryId=${factoryId}`);

    const body = (await res.json()) as Record<string, unknown> & { keys: Array<Record<string, unknown>> };
    expect(body).toMatchObject({
      scope: 'user',
      selected: null,
      effective: { provider: 'mistral', model: 'voxtral-mini-latest' },
      canEdit: true,
    });
    expect(body.keys.find(k => k.provider === 'mistral')).toMatchObject({ saved: true });
    expect(body.keys.find(k => k.provider === 'openai')).toMatchObject({ saved: false });
  });

  it('only lets org admins change the Factory voice model under factory scope', async () => {
    const { seed, app, factoryId, factoryKey } = await tenantFactory('factory', false);

    const res = await putSettings(app, { factoryId, provider: 'openai', model: 'whisper-1' });

    expect(res.status).toBe(403);
    expect(await seed.voiceSettings.get(factoryKey)).toBeNull();
    expect(await seed.voiceSettings.get({ orgId: 'org1', userId: 'user-a' })).toBeNull();
    const settings = await app.request(`/web/voice/settings?factoryId=${factoryId}`);
    expect(((await settings.json()) as { canEdit: boolean }).canEdit).toBe(false);
  });

  it('lets any member save their own voice model under user scope', async () => {
    const { seed, app, factoryId, factoryKey } = await tenantFactory('user', false);

    const res = await putSettings(app, { factoryId, provider: 'mistral', model: 'voxtral-mini-latest' });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      scope: 'user',
      canEdit: true,
      selected: { provider: 'mistral', model: 'voxtral-mini-latest' },
    });
    expect(await seed.voiceSettings.get({ orgId: 'org1', userId: 'user-a' })).toMatchObject({
      provider: 'mistral',
      model: 'voxtral-mini-latest',
    });
    expect(await seed.voiceSettings.get(factoryKey)).toBeNull();
  });

  it("does not reveal another org's Factory", async () => {
    const seed = await createFactoryStorageForTests();
    const other = await seed.projects.create({ orgId: 'org2', userId: 'user-z', input: { name: 'Other' } });
    const app = await mount(
      { auth: fakeRouteAuth(), modelCredentials: seed.credentials, factoryProjects: seed.projects },
      { org: 'org1' },
    );

    const res = await app.request(`/web/voice/settings?factoryId=${other.id}`);

    expect(res.status).toBe(404);
  });
});
