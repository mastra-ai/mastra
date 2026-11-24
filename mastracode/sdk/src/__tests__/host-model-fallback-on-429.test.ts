import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { LLMock } from '@copilotkit/aimock';
import { EventEmitterPubSub } from '@mastra/core/events';
import { RequestContext } from '@mastra/core/request-context';
import { LibSQLStore } from '@mastra/libsql';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveAuthenticatedCredentialTenant, setCredentialStoreProvider } from '../agents/credential-resolver.js';
import type { CredentialStore } from '../auth/types.js';
import { createMastraCode } from '../index.js';
import { MODEL_FALLBACK_PART_TYPE, MODEL_FALLBACK_STATE_KEY, parseModelFallbackPart } from '../model-fallback.js';

vi.setConfig({ testTimeout: 60_000 });

const OWNER = { workosId: 'user-a', organizationId: 'org-1' };
const PRIMARY = 'anthropic/claude-opus-5.5';
const FALLBACK = 'openai/gpt-5.6-sol';
const ANTHROPIC_RATE_LIMIT = {
  error: { message: 'Rate limited', type: 'rate_limit_error' },
  status: 429,
  retryAfter: 60,
};

const tenantStore = (keys: Record<string, string>): CredentialStore => ({
  allowEnvironmentFallback: false,
  reload: () => {},
  get: provider => (keys[provider] ? { type: 'api_key', key: keys[provider] } : undefined),
  getStoredApiKey: provider => keys[provider],
  getApiKey: async provider => keys[provider],
});

let directory: string;
let mock: LLMock;
let stops: Array<() => Promise<void> | void>;

beforeEach(async () => {
  directory = mkdtempSync(path.join(tmpdir(), 'mastracode-host-fallback-'));
  mock = new LLMock({ port: 0 });
  await mock.start();
  const baseUrl = `${mock.url.replace(/\/+$/, '')}/v1`;
  vi.stubEnv('ANTHROPIC_BASE_URL', baseUrl);
  vi.stubEnv('OPENAI_BASE_URL', baseUrl);
  vi.stubEnv('ANTHROPIC_API_KEY', 'process-env-key-must-not-be-used');
  vi.stubEnv('OPENAI_API_KEY', 'process-env-key-must-not-be-used');
  vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', 'process-env-key-must-not-be-used');
  vi.stubEnv('MASTRA_APP_DATA_DIR', path.join(directory, 'app-data'));
  vi.stubEnv('MASTRACODE_DISABLE_UNIX_SOCKET_PUBSUB', '1');
  vi.stubEnv('MASTRACODE_DISABLE_OBSERVATIONAL_MEMORY', '1');
  stops = [];
  setCredentialStoreProvider(
    () => tenantStore({ anthropic: 'tenant-anthropic-key', openai: 'tenant-openai-key' }),
    async requestContext => resolveAuthenticatedCredentialTenant(requestContext),
  );
});

afterEach(async () => {
  vi.useRealTimers();
  setCredentialStoreProvider(undefined);
  for (const stop of stops.splice(0).reverse()) await stop();
  await mock.stop();
  vi.unstubAllEnvs();
  rmSync(directory, { recursive: true, force: true });
});

async function startSession(initialFallbackModelIds?: readonly string[]) {
  let fallbackModelIds = initialFallbackModelIds ?? [];
  const settingsPath = path.join(directory, 'settings.json');
  writeFileSync(
    settingsPath,
    JSON.stringify({
      onboarding: { skippedAt: '2026-01-01T00:00:00.000Z', version: 1 },
      models: { activeModelPackId: null, modeDefaults: { build: PRIMARY, plan: PRIMARY } },
    }),
  );
  const code = await createMastraCode({
    cwd: directory,
    homeDir: directory,
    configDir: '.mastracode-test',
    settingsPath,
    storage: new LibSQLStore({ id: 'host-fallback', url: `file:${path.join(directory, 'mastra.db')}` }),
    storageBackend: 'libsql',
    pubsub: new EventEmitterPubSub(),
    disableMcp: true,
    disableHooks: true,
    disableEnvFile: true,
    disablePlugins: true,
    disableGithubSignals: true,
    createInitialThread: false,
    resolveModelFallbacks: initialFallbackModelIds ? () => fallbackModelIds : undefined,
  });
  stops.push(() => code.controller.shutdown?.());
  const session = await code.controller.createSession({
    id: 'session-a',
    resourceId: 'session-a',
    ownerId: OWNER.workosId,
    requestContext: new RequestContext([['user', { ...OWNER }]]),
  });
  const threadId = session.thread.getId();
  expect(threadId).toBeTruthy();
  const errors: string[] = [];
  const pendingFailures: unknown[] = [];
  session.subscribe(event => {
    if (event.type === 'error') errors.push(event.error.message);
    if (event.type === 'state_changed' && event.changedKeys.includes(MODEL_FALLBACK_STATE_KEY)) {
      pendingFailures.push((event.state[MODEL_FALLBACK_STATE_KEY] as { failure?: unknown } | null)?.failure);
    }
  });

  const send = async (content: string, requestEntries: Array<[string, unknown]> = []) => {
    await session.sendMessage({
      content,
      requestContext: new RequestContext([['user', { ...OWNER }], ...requestEntries]),
    });
    await vi.waitFor(() => expect(session.run.isRunning()).toBe(false), { timeout: 30_000 });
  };
  const savedMessages = () => session.thread.listMessages({ threadId: threadId! });
  const savedHops = async () =>
    (await savedMessages())
      .flatMap(message => message.content.parts)
      .filter(part => part.type === MODEL_FALLBACK_PART_TYPE)
      .map(part => parseModelFallbackPart((part as { data?: unknown }).data));
  const lastReply = async () => {
    const reply = (await savedMessages()).filter(message => message.role === 'assistant').at(-1);
    return reply?.content.parts.flatMap(part => (part.type === 'text' ? [part.text] : [])).join('');
  };
  const setFallbackModelIds = (next: readonly string[]) => {
    fallbackModelIds = next;
  };
  return { session, send, savedHops, lastReply, errors, pendingFailures, setFallbackModelIds };
}

describe('a Factory session whose model is rate-limited, with a host fallback configured', () => {
  it('keeps the next turns on the fallback until the provider retry time, then goes back to the session model', async () => {
    mock.on({ model: /claude/ }, ANTHROPIC_RATE_LIMIT);
    mock.on({ model: /gpt/ }, { content: 'Reviewed on the fallback' });
    const { send, savedHops, lastReply, errors, pendingFailures } = await startSession([FALLBACK]);

    const failedAt = Date.now();
    await send('Review the diff.');

    expect(errors).toEqual([]);
    expect(await lastReply()).toBe('Reviewed on the fallback');
    const [hop] = await savedHops();
    expect(hop).toMatchObject({
      from: { entryId: PRIMARY },
      to: { entryId: FALLBACK },
      failure: { kind: 'rate_limited' },
    });
    const retryAt = Date.parse(hop!.failure!.retryAt!);
    expect(retryAt).toBeGreaterThanOrEqual(failedAt + 60_000);
    expect(retryAt).toBeLessThan(Date.now() + 60_000);
    expect(pendingFailures).toEqual([hop!.failure]);

    await send('Again.');

    expect(errors).toEqual([]);
    expect(await lastReply()).toBe('Reviewed on the fallback');
    expect(await savedHops()).toHaveLength(1);

    vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true, now: retryAt + 1_000 });
    mock.clearFixtures();
    mock.clearRequests();
    mock.on({ model: /claude/ }, { content: 'Back on Opus' });
    await send('Once more.');

    expect(errors).toEqual([]);
    expect(await lastReply()).toBe('Back on Opus');
    expect(new Set(mock.getRequests().map(request => `${request.path} ${request.response.status}`))).toEqual(
      new Set(['/v1/messages 200']),
    );
  });

  it('tries the session model last when the fallback fails before the retry time', async () => {
    mock.on({ model: /claude/ }, ANTHROPIC_RATE_LIMIT);
    mock.on({ model: /gpt/ }, { content: 'Reviewed on the fallback' });
    const { send, savedHops, lastReply, errors } = await startSession([FALLBACK]);
    await send('Review the diff.');
    expect(await lastReply()).toBe('Reviewed on the fallback');

    mock.clearFixtures();
    mock.on(
      { model: /gpt/ },
      { error: { message: 'Rate limit reached', type: 'requests' }, status: 429, retryAfter: 1 },
    );
    mock.on({ model: /claude/ }, { content: 'Back on Opus' });
    await send('Again.');

    expect(errors).toEqual([]);
    expect(await lastReply()).toBe('Back on Opus');
    expect((await savedHops()).at(-1)).toMatchObject({ from: { entryId: FALLBACK }, to: { entryId: PRIMARY } });
  });

  it('starts the next turn on the session model once the fallbacks are removed', async () => {
    mock.on({ model: /claude/ }, ANTHROPIC_RATE_LIMIT);
    mock.on({ model: /gpt/ }, { content: 'Reviewed on the fallback' });
    const { send, lastReply, errors, setFallbackModelIds } = await startSession([FALLBACK]);
    await send('Review the diff.');
    expect(await lastReply()).toBe('Reviewed on the fallback');

    setFallbackModelIds([]);
    mock.clearFixtures();
    mock.clearRequests();
    mock.on({ model: /claude/ }, { content: 'Back on Opus' });
    await send('Again.');

    expect(errors).toEqual([]);
    expect(await lastReply()).toBe('Back on Opus');
    expect(new Set(mock.getRequests().map(request => `${request.path} ${request.response.status}`))).toEqual(
      new Set(['/v1/messages 200']),
    );
  });
});

describe('a Factory session whose Anthropic account is out of credit', () => {
  it('hands the turn to the fallback and records a quota failure', async () => {
    mock.on(
      { model: /claude/ },
      {
        error: {
          message: 'Your credit balance is too low to access the Anthropic API.',
          type: 'invalid_request_error',
        },
        status: 400,
      },
    );
    mock.on({ model: /gpt/ }, { content: 'Reviewed on the fallback' });
    const { send, savedHops, lastReply, errors } = await startSession([FALLBACK]);

    await send('Review the diff.');

    expect(errors).toEqual([]);
    expect(await lastReply()).toBe('Reviewed on the fallback');
    expect(await savedHops()).toMatchObject([{ to: { entryId: FALLBACK }, failure: { kind: 'quota' } }]);
  });
});

describe('a Factory session whose first fallback has no tenant credential', () => {
  it('skips that fallback and hands the turn to the next one', async () => {
    mock.on({ model: /claude/ }, ANTHROPIC_RATE_LIMIT);
    mock.on({ model: /gpt/ }, { content: 'Reviewed on the fallback' });
    const { send, savedHops, lastReply, errors } = await startSession(['google/gemini-3.8-flash', FALLBACK]);

    await send('Review the diff.');

    expect(errors).toEqual([]);
    expect(await lastReply()).toBe('Reviewed on the fallback');
    expect(await savedHops()).toMatchObject([{ from: { entryId: PRIMARY }, to: { entryId: FALLBACK } }]);
  });
});

describe('a Factory session whose model rejects the request', () => {
  it('ends the turn with the provider error without trying the fallback', async () => {
    mock.on(
      { model: /claude/ },
      {
        error: { message: 'prompt is too long: 250000 tokens > 200000 maximum', type: 'invalid_request_error' },
        status: 400,
      },
    );
    mock.on({ model: /gpt/ }, { content: 'Reviewed on the fallback' });
    const { send, savedHops, errors } = await startSession([FALLBACK]);

    await send('Review the diff.');

    expect(errors).toEqual(['prompt is too long: 250000 tokens > 200000 maximum']);
    expect(await savedHops()).toEqual([]);
    expect(new Set(mock.getRequests().map(request => `${request.path} ${request.response.status}`))).toEqual(
      new Set(['/v1/messages 400']),
    );
  });
});

describe('a Factory session whose every model is rate-limited', () => {
  it('ends the turn in error and keeps the rate-limited hop in history', async () => {
    mock.on({ model: /claude/ }, ANTHROPIC_RATE_LIMIT);
    mock.on(
      { model: /gpt/ },
      { error: { message: 'Rate limit reached', type: 'requests' }, status: 429, retryAfter: 1 },
    );
    const { send, savedHops, errors, pendingFailures } = await startSession([FALLBACK]);

    await send('Review the diff.');

    expect(errors).toEqual(['Rate limit reached']);
    expect(pendingFailures).toEqual([{ kind: 'rate_limited', retryAt: expect.any(String) }]);
    await vi.waitFor(async () =>
      expect(await savedHops()).toMatchObject([
        { from: { entryId: PRIMARY }, to: { entryId: FALLBACK }, failure: { kind: 'rate_limited' } },
      ]),
    );
  });
});

describe('a session whose host configures no fallbacks', () => {
  it('ignores a fallback route a client smuggled into the request context', async () => {
    mock.on({ model: /claude/ }, ANTHROPIC_RATE_LIMIT);
    mock.on({ model: /gpt/ }, { content: 'Answered on the smuggled model' });
    const { send, savedHops, lastReply, errors } = await startSession();

    await send('Review the diff.', [
      [
        'mastracodeHostModelRoute',
        [
          { id: PRIMARY, label: PRIMARY, modelId: PRIMARY },
          { id: FALLBACK, label: FALLBACK, modelId: FALLBACK },
        ],
      ],
    ]);

    expect(errors).toEqual(['Rate limited']);
    expect(await savedHops()).toEqual([]);
  });
});

describe('a Factory session that still holds a model pack pinned to another account', () => {
  it('answers with the tenant key when the host configures no fallbacks', async () => {
    mock.on({ model: /claude/ }, { content: 'Answered with the tenant key' });
    const { session, send, lastReply, errors } = await startSession([]);
    await session.state.set({
      modelRoute: { entries: [{ id: 'pinned', label: 'Pinned', modelId: PRIMARY, accountId: 'stale-account' }] },
    });

    await send('Review the diff.');

    expect(errors).toEqual([]);
    expect(await lastReply()).toBe('Answered with the tenant key');
  });
});
