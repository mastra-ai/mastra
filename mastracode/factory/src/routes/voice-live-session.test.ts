import type { Hono } from 'hono';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { VOICE_REQUESTS_PER_MINUTE } from '../voice/rate-limit.js';
import { localAuthStorage, mountVoiceRoutes } from './__tests__/voice-routes.js';
import { fakeRouteAuth } from './test-utils.js';

const CLIENT_SESSIONS_URL = 'https://api.mistral.ai/v1/client/sessions';
const REALTIME_MODEL = 'voxtral-mini-transcribe-realtime-3';
const EXPIRES_AT = '2026-11-05T10:15:00Z';

interface MintCall {
  authorization: string | null;
  body: unknown;
}

let mints: MintCall[] = [];

const server = setupServer(
  http.post(CLIENT_SESSIONS_URL, async ({ request }) => {
    mints.push({ authorization: request.headers.get('authorization'), body: await request.json() });
    return HttpResponse.json(
      {
        object: 'client.session',
        purpose: 'realtime',
        expires_at: EXPIRES_AT,
        client_secret: { value: 'rt_live_token', expires_at: EXPIRES_AT },
      },
      { status: 201 },
    );
  }),
  http.post('https://api.openai.com/v1/audio/transcriptions', () => HttpResponse.json({ text: 'hello' })),
);

const ENV_KEYS = ['OPENAI_API_KEY', 'MISTRAL_API_KEY', 'GROQ_API_KEY', 'DEEPGRAM_API_KEY'] as const;
const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string>> = {};

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
beforeEach(() => {
  mints = [];
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

function liveSession(app: Hono, factoryId?: string) {
  const query = factoryId ? `?factoryId=${factoryId}` : '';
  return app.request(`/web/voice/live-session${query}`, { method: 'POST' });
}

function transcribe(app: Hono) {
  return app.request('/web/voice/transcribe', {
    method: 'POST',
    headers: { 'content-type': 'audio/webm' },
    body: new Uint8Array(Buffer.from('fake opus bytes')),
  });
}

async function tenantWithPersonalMistralKey() {
  const seed = await createFactoryStorageForTests();
  await seed.credentials.setCredential({ orgId: 'org1' }, 'mistral', { type: 'api_key', key: 'org-mistral' });
  await seed.credentials.setCredential({ orgId: 'org1', userId: 'user-a' }, 'mistral', {
    type: 'api_key',
    key: 'personal-mistral',
  });
  return {
    seed,
    app: await mountVoiceRoutes({ auth: fakeRouteAuth(), modelCredentials: seed.credentials }, { org: 'org1' }),
  };
}

function refuseLiveSessions() {
  const batchKeys: (string | null)[] = [];
  server.use(
    http.post(CLIENT_SESSIONS_URL, () =>
      HttpResponse.json({ message: 'Missing permission: create_client_session', code: '1000' }, { status: 403 }),
    ),
    http.post('https://api.mistral.ai/v1/audio/transcriptions', ({ request }) => {
      batchKeys.push(request.headers.get('authorization'));
      return HttpResponse.json({ model: 'voxtral-mini-latest', text: 'recorded instead', language: 'en', usage: {} });
    }),
  );
  return batchKeys;
}

describe('POST /web/voice/live-session', () => {
  it("starts a live session with the member's own Mistral key, and the browser only ever sees the short-lived token", async () => {
    const { app } = await tenantWithPersonalMistralKey();

    const res = await liveSession(app);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      mode: 'live',
      url: `wss://api.mistral.ai/v1/audio/transcriptions/realtime?model=${REALTIME_MODEL}`,
      token: 'rt_live_token',
      expiresAt: EXPIRES_AT,
    });
    expect(JSON.stringify(body)).not.toContain('personal-mistral');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(mints).toEqual([
      { authorization: 'Bearer personal-mistral', body: { purpose: 'realtime', model: REALTIME_MODEL } },
    ]);
  });

  it('keeps the recorded clip flow when the chosen provider has no realtime model', async () => {
    const app = await mountVoiceRoutes({ authStorage: localAuthStorage({ openai: 'sk-openai' }) });

    const res = await liveSession(app);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ mode: 'batch' });
    expect(mints).toEqual([]);
  });

  it('refuses a signed-out caller before asking Mistral for a token', async () => {
    const seed = await createFactoryStorageForTests();
    await seed.credentials.setCredential({ orgId: 'org1', userId: 'user-a' }, 'mistral', {
      type: 'api_key',
      key: 'personal-mistral',
    });
    const app = await mountVoiceRoutes({ auth: fakeRouteAuth(), modelCredentials: seed.credentials });

    const res = await liveSession(app);

    expect(res.status).toBe(401);
    expect(mints).toEqual([]);
  });

  it('answers 404 for a Factory outside your organization before asking Mistral for a token', async () => {
    const { seed, app } = await tenantWithPersonalMistralKey();
    const otherOrgFactory = await seed.projects.create({ orgId: 'org2', userId: 'user-b', input: { name: 'Other' } });

    const res = await liveSession(app, otherOrgFactory.id);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'factory_project_not_found' });
    expect(mints).toEqual([]);
  });

  it('asks for a speech-to-text key exactly like transcription does when none is set up', async () => {
    const app = await mountVoiceRoutes({ authStorage: localAuthStorage({}) });

    const live = await liveSession(app);
    const recorded = await transcribe(app);

    expect(live.status).toBe(400);
    expect(recorded.status).toBe(400);
    expect(await live.json()).toEqual(await recorded.json());
    expect(mints).toEqual([]);
  });

  it("records the clip with the same key instead when Mistral won't start a live session", async () => {
    const batchKeys = refuseLiveSessions();
    const { app } = await tenantWithPersonalMistralKey();

    const live = await liveSession(app);
    const recorded = await transcribe(app);

    expect(live.status).toBe(200);
    expect(await live.json()).toEqual({ mode: 'batch' });
    expect(recorded.status).toBe(200);
    expect(await recorded.json()).toMatchObject({ text: 'recorded instead' });
    expect(batchKeys).toEqual(['Bearer personal-mistral']);
  });

  it.each([
    {
      name: 'a rejected key',
      reply: () =>
        HttpResponse.json({ message: 'Unauthorized: key personal-mistral is revoked', code: '1000' }, { status: 401 }),
      reason: 'the speech-to-text provider rejected the API key',
    },
    {
      name: 'an account out of credit',
      reply: () =>
        HttpResponse.json(
          { message: 'personal-mistral has no credit left', code: 'insufficient_quota' },
          { status: 402 },
        ),
      reason: 'the speech-to-text provider account is out of credit',
    },
  ])('explains $name before recording, without echoing what Mistral said', async ({ reply, reason }) => {
    server.use(http.post(CLIENT_SESSIONS_URL, reply));
    const { app } = await tenantWithPersonalMistralKey();

    const res = await liveSession(app);

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: `Transcription failed: ${reason}.` });
  });

  it('records the clip instead when the token response is malformed', async () => {
    server.use(http.post(CLIENT_SESSIONS_URL, () => HttpResponse.json({ client_secret: null }, { status: 201 })));
    const { app } = await tenantWithPersonalMistralKey();

    const res = await liveSession(app);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ mode: 'batch' });
  });
});

describe('voice request rate limit', () => {
  it.each([
    {
      name: 'a provider without live transcription',
      mount: () => mountVoiceRoutes({ authStorage: localAuthStorage({ openai: 'sk-openai' }) }),
    },
    {
      name: "Mistral when it won't start a live session",
      mount: async () => {
        refuseLiveSessions();
        return (await tenantWithPersonalMistralKey()).app;
      },
    },
  ])(
    'counts a recorded dictation once with $name, and refuses before recording once the minute is used up',
    async ({ mount }) => {
      const app = await mount();
      for (let i = 0; i < VOICE_REQUESTS_PER_MINUTE; i++) {
        expect(await (await liveSession(app)).json()).toEqual({ mode: 'batch' });
        expect((await transcribe(app)).status).toBe(200);
      }

      const live = await liveSession(app);
      const recorded = await transcribe(app);

      for (const res of [live, recorded]) {
        expect(res.status).toBe(429);
        expect(await res.json()).toEqual({ error: 'voice_rate_limited' });
        const retryAfter = Number(res.headers.get('retry-after'));
        expect(retryAfter).toBeGreaterThan(0);
        expect(retryAfter).toBeLessThanOrEqual(60);
      }
    },
  );

  it('counts each live session it starts', async () => {
    const { app } = await tenantWithPersonalMistralKey();
    for (let i = 0; i < VOICE_REQUESTS_PER_MINUTE; i++) expect((await liveSession(app)).status).toBe(200);

    const res = await liveSession(app);

    expect(res.status).toBe(429);
    expect(mints).toHaveLength(VOICE_REQUESTS_PER_MINUTE);
  });
});
