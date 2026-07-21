import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────
// Mock the SDK flow primitives at the module boundary; the routes' session
// bookkeeping, tenancy scoping, and rate limiting are what's under test.

const {
  startAnthropicLogin,
  completeAnthropicLogin,
  startCodexDeviceLogin,
  pollCodexDeviceLogin,
  startGitHubCopilotDeviceLogin,
  pollGitHubCopilotDeviceLogin,
} = vi.hoisted(() => ({
  startAnthropicLogin: vi.fn(),
  completeAnthropicLogin: vi.fn(),
  startCodexDeviceLogin: vi.fn(),
  pollCodexDeviceLogin: vi.fn(),
  startGitHubCopilotDeviceLogin: vi.fn(),
  pollGitHubCopilotDeviceLogin: vi.fn(),
}));
vi.mock('@mastra/code-sdk/auth/providers/anthropic', async importOriginal => ({
  ...(await importOriginal<object>()),
  startAnthropicLogin: (...args: unknown[]) => startAnthropicLogin(...args),
  completeAnthropicLogin: (...args: unknown[]) => completeAnthropicLogin(...args),
}));
vi.mock('@mastra/code-sdk/auth/providers/openai-codex', async importOriginal => ({
  ...(await importOriginal<object>()),
  startCodexDeviceLogin: (...args: unknown[]) => startCodexDeviceLogin(...args),
  pollCodexDeviceLogin: (...args: unknown[]) => pollCodexDeviceLogin(...args),
}));
vi.mock('@mastra/code-sdk/auth/providers/github-copilot', async importOriginal => ({
  ...(await importOriginal<object>()),
  startGitHubCopilotDeviceLogin: (...args: unknown[]) => startGitHubCopilotDeviceLogin(...args),
  pollGitHubCopilotDeviceLogin: (...args: unknown[]) => pollGitHubCopilotDeviceLogin(...args),
}));

import type { AuthStorage } from '@mastra/code-sdk/auth/storage';
import type { IMastraAuthProvider } from '@mastra/core/server';
import { buildOAuthRoutes } from './oauth-routes';
import { __resetRuntimeConfigForTests, seedRuntimeConfig } from './runtime-config';
import { seedFactoryStorageForTests } from './storage/test-utils';
import type { FactoryStorageTestSeed } from './storage/test-utils';
import { mountApiRoutes } from './test-utils';

// ── Test harness ─────────────────────────────────────────────────────────

function makeAuthStorage() {
  return {
    set: vi.fn(),
    remove: vi.fn(),
  } as unknown as AuthStorage & { set: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> };
}

let authStorage: ReturnType<typeof makeAuthStorage>;
let seed: FactoryStorageTestSeed;

function buildApp(user: { workosId: string; organizationId?: string } | null) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (user) c.set('webAuthUser' as never, user as never);
    await next();
  });
  mountApiRoutes(app as any, buildOAuthRoutes({ authStorage }));
  return app;
}

const userA = { workosId: 'user-a', organizationId: 'org1' };
const userB = { workosId: 'user-b', organizationId: 'org1' };
const TENANT_A = { orgId: 'org1', userId: 'user-a' };

const post = (app: Hono, path: string, body?: unknown) =>
  app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

const ANTHROPIC_CREDS = { refresh: 'r-1', access: 'a-1', expires: Date.now() + 3_600_000 };
const CODEX_CREDS = { refresh: 'r-2', access: 'a-2', expires: Date.now() + 3_600_000 };

beforeEach(async () => {
  seed = await seedFactoryStorageForTests();
  authStorage = makeAuthStorage();
  startAnthropicLogin.mockResolvedValue({ url: 'https://claude.ai/oauth/authorize?state=s', verifier: 'v-1' });
  completeAnthropicLogin.mockResolvedValue(ANTHROPIC_CREDS);
  startCodexDeviceLogin.mockResolvedValue({
    deviceAuthId: 'da-1',
    userCode: 'ABCD-1234',
    url: 'https://auth.openai.com/codex/device',
    instructions: 'Enter code: ABCD-1234',
    intervalMs: 5000,
    deadlineAt: Date.now() + 900_000,
  });
  pollCodexDeviceLogin.mockResolvedValue({ status: 'pending', nextPollMs: 5000 });
  startGitHubCopilotDeviceLogin.mockResolvedValue({
    domain: 'github.com',
    deviceCode: 'dc-1',
    userCode: 'WXYZ-5678',
    url: 'https://github.com/login/device',
    instructions: 'Enter code: WXYZ-5678',
    intervalMs: 5000,
    intervalMultiplier: 1,
    deadlineAt: Date.now() + 900_000,
  });
  pollGitHubCopilotDeviceLogin.mockResolvedValue({ status: 'pending', nextPollMs: 5000 });
});

afterEach(() => {
  __resetRuntimeConfigForTests();
  vi.clearAllMocks();
});

/** Force a device session to be immediately pollable. */
async function makePollable(sessionId: string) {
  await seed.credentials.touchLoginSession(sessionId, { nextPollAt: new Date(Date.now() - 1) });
}

// ── Paste-code flow (Anthropic) ──────────────────────────────────────────

describe('paste-code flow (anthropic)', () => {
  it('start returns session metadata without leaking the verifier', async () => {
    const res = await post(buildApp(userA), '/web/config/providers/anthropic/oauth/start');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.kind).toBe('paste-code');
    expect(json.sessionId).toBeTruthy();
    expect(json.url).toContain('https://claude.ai');
    expect(JSON.stringify(json)).not.toContain('v-1');
  });

  it('complete exchanges the code and stores a user-scoped credential', async () => {
    const app = buildApp(userA);
    const { sessionId } = await (await post(app, '/web/config/providers/anthropic/oauth/start')).json();

    const res = await post(app, '/web/config/providers/anthropic/oauth/complete', { sessionId, code: 'code#state' });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'complete' });
    expect(completeAnthropicLogin).toHaveBeenCalledWith('code#state', 'v-1');

    const cred = await seed.credentials.getCredential(TENANT_A, 'anthropic');
    expect(cred).toMatchObject({ type: 'oauth', access: 'a-1' });
    // Server-side only: never written to the local auth.json in tenant mode.
    expect(authStorage.set).not.toHaveBeenCalled();
  });

  it("keeps user A's credential invisible to user B", async () => {
    const app = buildApp(userA);
    const { sessionId } = await (await post(app, '/web/config/providers/anthropic/oauth/start')).json();
    await post(app, '/web/config/providers/anthropic/oauth/complete', { sessionId, code: 'c' });

    expect(await seed.credentials.listCredentials('org1', 'user-b')).toEqual([]);
    expect(await seed.credentials.resolveCredential('org1', 'user-b', 'anthropic')).toBeUndefined();
  });

  it('deletes the session after completion (replay returns 404)', async () => {
    const app = buildApp(userA);
    const { sessionId } = await (await post(app, '/web/config/providers/anthropic/oauth/start')).json();
    await post(app, '/web/config/providers/anthropic/oauth/complete', { sessionId, code: 'c' });

    const replay = await post(app, '/web/config/providers/anthropic/oauth/complete', { sessionId, code: 'c' });
    expect(replay.status).toBe(404);
  });

  it('400s when the exchange rejects the pasted code', async () => {
    completeAnthropicLogin.mockRejectedValue(new Error('Invalid authorization code'));
    const app = buildApp(userA);
    const { sessionId } = await (await post(app, '/web/config/providers/anthropic/oauth/start')).json();

    const res = await post(app, '/web/config/providers/anthropic/oauth/complete', { sessionId, code: 'bad' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('Invalid authorization code');
    // Session survives a bad paste so the user can retry.
    const retry = await post(app, '/web/config/providers/anthropic/oauth/complete', { sessionId, code: 'bad' });
    expect(retry.status).toBe(400);
  });
});

// ── Device-code flow (OpenAI Codex) ──────────────────────────────────────

describe('device-code flow (openai)', () => {
  it('start returns the user code and initial poll delay', async () => {
    const res = await post(buildApp(userA), '/web/config/providers/openai/oauth/start');
    const json = await res.json();
    expect(json).toMatchObject({ kind: 'device-code', userCode: 'ABCD-1234', nextPollMs: 5000 });
    expect(json.url).toContain('device');
  });

  it('rate-limits polls server-side without hitting the provider', async () => {
    const app = buildApp(userA);
    const { sessionId } = await (await post(app, '/web/config/providers/openai/oauth/start')).json();

    const res = await post(app, '/web/config/providers/openai/oauth/poll', { sessionId });
    const json = await res.json();
    expect(json.status).toBe('pending');
    expect(json.nextPollMs).toBeGreaterThan(0);
    expect(pollCodexDeviceLogin).not.toHaveBeenCalled();
  });

  it('performs one upstream poll when due and reschedules', async () => {
    const app = buildApp(userA);
    const { sessionId } = await (await post(app, '/web/config/providers/openai/oauth/start')).json();
    await makePollable(sessionId);

    const res = await post(app, '/web/config/providers/openai/oauth/poll', { sessionId });
    expect(await res.json()).toMatchObject({ status: 'pending', nextPollMs: 5000 });
    expect(pollCodexDeviceLogin).toHaveBeenCalledTimes(1);

    // Immediately polling again is rate-limited — still one upstream call.
    await post(app, '/web/config/providers/openai/oauth/poll', { sessionId });
    expect(pollCodexDeviceLogin).toHaveBeenCalledTimes(1);
  });

  it('stores the credential under the openai-codex auth id on completion', async () => {
    pollCodexDeviceLogin.mockResolvedValue({ status: 'complete', credentials: CODEX_CREDS });
    const app = buildApp(userA);
    const { sessionId } = await (await post(app, '/web/config/providers/openai/oauth/start')).json();
    await makePollable(sessionId);

    const res = await post(app, '/web/config/providers/openai/oauth/poll', { sessionId });
    expect(await res.json()).toMatchObject({ status: 'complete' });
    expect(await seed.credentials.getCredential(TENANT_A, 'openai-codex')).toMatchObject({
      type: 'oauth',
      access: 'a-2',
    });
    // Session is gone.
    expect((await post(app, '/web/config/providers/openai/oauth/poll', { sessionId })).status).toBe(404);
  });

  it('deletes the session and reports failure when the flow fails', async () => {
    pollCodexDeviceLogin.mockResolvedValue({ status: 'failed', error: 'Device flow timed out' });
    const app = buildApp(userA);
    const { sessionId } = await (await post(app, '/web/config/providers/openai/oauth/start')).json();
    await makePollable(sessionId);

    const res = await post(app, '/web/config/providers/openai/oauth/poll', { sessionId });
    expect(await res.json()).toMatchObject({ status: 'failed', error: 'Device flow timed out' });
    expect((await post(app, '/web/config/providers/openai/oauth/poll', { sessionId })).status).toBe(404);
  });

  it("404s when another user polls someone else's session", async () => {
    const { sessionId } = await (await post(buildApp(userA), '/web/config/providers/openai/oauth/start')).json();
    await makePollable(sessionId);

    const res = await post(buildApp(userB), '/web/config/providers/openai/oauth/poll', { sessionId });
    expect(res.status).toBe(404);
    expect(pollCodexDeviceLogin).not.toHaveBeenCalled();
  });
});

// ── Device-code flow (GitHub Copilot) ────────────────────────────────────

describe('device-code flow (github-copilot)', () => {
  it('polls github.com sessions normally', async () => {
    const app = buildApp(userA);
    const { sessionId } = await (await post(app, '/web/config/providers/github-copilot/oauth/start')).json();
    await makePollable(sessionId);

    const res = await post(app, '/web/config/providers/github-copilot/oauth/poll', { sessionId });
    expect(await res.json()).toMatchObject({ status: 'pending' });
    expect(pollGitHubCopilotDeviceLogin).toHaveBeenCalledTimes(1);
  });

  it('refuses to poll a session whose stored state points at a non-github.com host', async () => {
    const app = buildApp(userA);
    const { sessionId } = await (await post(app, '/web/config/providers/github-copilot/oauth/start')).json();
    const session = await seed.credentials.getLoginSession(sessionId);
    await seed.credentials.touchLoginSession(sessionId, {
      pending: { ...session!.pending, domain: 'evil.example.com' },
      nextPollAt: new Date(Date.now() - 1),
    });

    const res = await post(app, '/web/config/providers/github-copilot/oauth/poll', { sessionId });
    expect(await res.json()).toMatchObject({ status: 'failed', error: 'Unsupported GitHub host' });
    expect(pollGitHubCopilotDeviceLogin).not.toHaveBeenCalled();
  });

  it('refuses to poll a session whose stored state carries an enterprise domain', async () => {
    const app = buildApp(userA);
    const { sessionId } = await (await post(app, '/web/config/providers/github-copilot/oauth/start')).json();
    const session = await seed.credentials.getLoginSession(sessionId);
    await seed.credentials.touchLoginSession(sessionId, {
      pending: { ...session!.pending, enterpriseDomain: 'company.ghe.com' },
      nextPollAt: new Date(Date.now() - 1),
    });

    const res = await post(app, '/web/config/providers/github-copilot/oauth/poll', { sessionId });
    expect(await res.json()).toMatchObject({ status: 'failed', error: 'Unsupported GitHub host' });
    expect(pollGitHubCopilotDeviceLogin).not.toHaveBeenCalled();
  });
});

// ── Session cancel + sign-out ────────────────────────────────────────────

describe('session cancel and sign-out', () => {
  it('cancels a pending session', async () => {
    const app = buildApp(userA);
    const { sessionId } = await (await post(app, '/web/config/providers/openai/oauth/start')).json();

    const res = await app.request(`/web/config/providers/openai/oauth/session/${sessionId}`, { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect((await post(app, '/web/config/providers/openai/oauth/poll', { sessionId })).status).toBe(404);
  });

  it("sign-out removes only the caller's user-scoped credential", async () => {
    await seed.credentials.setCredential(TENANT_A, 'anthropic', { type: 'oauth', ...ANTHROPIC_CREDS });
    await seed.credentials.setCredential({ orgId: 'org1', userId: 'user-b' }, 'anthropic', {
      type: 'oauth',
      ...ANTHROPIC_CREDS,
    });
    await seed.credentials.setCredential({ orgId: 'org1' }, 'anthropic', { type: 'api_key', key: 'org-key' });

    const res = await buildApp(userA).request('/web/config/providers/anthropic/oauth', { method: 'DELETE' });
    expect(res.status).toBe(200);

    expect(await seed.credentials.getCredential(TENANT_A, 'anthropic')).toBeUndefined();
    expect(await seed.credentials.getCredential({ orgId: 'org1', userId: 'user-b' }, 'anthropic')).toBeDefined();
    expect(await seed.credentials.getCredential({ orgId: 'org1' }, 'anthropic')).toBeDefined();
    expect(authStorage.remove).not.toHaveBeenCalled();
  });
});

// ── Gating ───────────────────────────────────────────────────────────────

describe('gating', () => {
  it('404s for a provider without a web OAuth flow', async () => {
    const res = await post(buildApp(userA), '/web/config/providers/google/oauth/start');
    expect(res.status).toBe(404);
  });

  it('401s unauthenticated requests when an auth provider is active', async () => {
    seedRuntimeConfig({
      storage: seed.storage,
      authProvider: { name: 'test', authenticateToken: async () => null } as unknown as IMastraAuthProvider,
    });
    const res = await post(buildApp(null), '/web/config/providers/anthropic/oauth/start');
    expect(res.status).toBe(401);
  });

  it('503s tenant writes when the credentials domain is unavailable', async () => {
    // Auth provider active + user present, but no factory store at all.
    seedRuntimeConfig({
      authProvider: { name: 'test', authenticateToken: async () => null } as unknown as IMastraAuthProvider,
    });
    const res = await post(buildApp(userA), '/web/config/providers/anthropic/oauth/start');
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('credentials_unavailable');
  });
});

// ── Local mode (no auth adapter, no tenant) ──────────────────────────────

describe('local mode', () => {
  beforeEach(() => {
    // No adapter and no tenant user: requests fall back to AuthStorage.
    __resetRuntimeConfigForTests();
  });

  it('completes a paste-code flow into the file-backed AuthStorage', async () => {
    const app = buildApp(null);
    const { sessionId } = await (await post(app, '/web/config/providers/anthropic/oauth/start')).json();

    const res = await post(app, '/web/config/providers/anthropic/oauth/complete', { sessionId, code: 'c' });
    expect(res.status).toBe(200);
    expect(authStorage.set).toHaveBeenCalledWith('anthropic', expect.objectContaining({ type: 'oauth' }));
  });

  it('signs out via AuthStorage using the auth provider id', async () => {
    const res = await buildApp(null).request('/web/config/providers/openai/oauth', { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(authStorage.remove).toHaveBeenCalledWith('openai-codex');
  });
});
