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
import type { ModelFallback } from '../model-fallback.js';

vi.setConfig({ testTimeout: 60_000 });

const OWNER = { workosId: 'user-a', organizationId: 'org-1' };
const PRIMARY = 'anthropic/claude-opus-5.5';
const FALLBACK = 'openai/gpt-5.6-sol';
const ANTHROPIC_RATE_LIMIT = {
  error: { message: 'Rate limited', type: 'rate_limit_error' },
  status: 429,
  retryAfter: 1,
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
  setCredentialStoreProvider(undefined);
  for (const stop of stops.splice(0).reverse()) await stop();
  await mock.stop();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  rmSync(directory, { recursive: true, force: true });
});

async function startSession(initialRoute?: readonly ModelFallback[]) {
  let route = initialRoute ?? [];
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
    resolveModelRoute: initialRoute ? () => route : undefined,
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
  const pendingMarkers: unknown[] = [];
  const infos: string[] = [];
  session.subscribe(event => {
    if (event.type === 'error') errors.push(event.error.message);
    if (event.type === 'info') infos.push(event.message);
    if (event.type === 'state_changed' && event.changedKeys.includes(MODEL_FALLBACK_STATE_KEY)) {
      pendingMarkers.push(event.state[MODEL_FALLBACK_STATE_KEY]);
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
  const setRoute = (next: readonly ModelFallback[]) => {
    route = next;
  };
  return { session, send, savedHops, lastReply, errors, infos, pendingMarkers, setRoute };
}

describe('a Factory session whose model is rate-limited, with a host fallback configured', () => {
  it('finishes the turn on the fallback, records why, and starts the next turn on the route primary', async () => {
    mock.on({ model: /claude/ }, ANTHROPIC_RATE_LIMIT);
    mock.on({ model: /gpt/ }, { content: 'Reviewed on the fallback' });
    const { send, savedHops, lastReply, errors, infos, pendingMarkers } = await startSession([
      { modelId: PRIMARY },
      { modelId: FALLBACK },
    ]);

    await send('Review the diff.');

    expect(errors).toEqual([]);
    expect(await lastReply()).toBe('Reviewed on the fallback');
    expect(mock.getRequests().map(request => `${request.path} ${request.response.status}`)).toEqual([
      '/v1/messages 429',
      '/v1/responses 200',
    ]);
    expect(await savedHops()).toEqual([
      expect.objectContaining({
        from: { entryId: PRIMARY, label: PRIMARY },
        to: { entryId: FALLBACK, label: FALLBACK },
        failure: { kind: 'rate_limited' },
      }),
    ]);
    expect(pendingMarkers).toEqual([]);
    expect(infos).toEqual([]);

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

  it('runs the session model alone once the route is empty', async () => {
    mock.on({ model: /claude/ }, ANTHROPIC_RATE_LIMIT);
    mock.on({ model: /gpt/ }, { content: 'Reviewed on the fallback' });
    const { send, lastReply, errors, setRoute } = await startSession([{ modelId: PRIMARY }, { modelId: FALLBACK }]);
    await send('Review the diff.');
    expect(await lastReply()).toBe('Reviewed on the fallback');

    setRoute([]);
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

  it('retries a single-model route once after the provider asks to wait', async () => {
    mock.on({ model: /claude/ }, ANTHROPIC_RATE_LIMIT);
    const { send, errors } = await startSession([{ modelId: PRIMARY }]);

    await send('Review the diff.');

    expect(errors).toHaveLength(1);
    expect(mock.getRequests().map(request => `${request.path} ${request.response.status}`)).toEqual([
      '/v1/messages 429',
      '/v1/messages 429',
    ]);
  });

  it('retries the last model of the route once after the provider asks to wait', async () => {
    mock.on({ model: /claude/ }, ANTHROPIC_RATE_LIMIT);
    mock.on(
      { model: /gpt/, sequenceIndex: 0 },
      { error: { message: 'Rate limit reached', type: 'requests' }, status: 429, retryAfter: 1 },
    );
    mock.on({ model: /gpt/, sequenceIndex: 1 }, { content: 'Reviewed after the wait' });
    const { send, lastReply, errors, savedHops } = await startSession([{ modelId: PRIMARY }, { modelId: FALLBACK }]);

    await send('Review the diff.');

    expect(errors).toEqual([]);
    expect(await lastReply()).toBe('Reviewed after the wait');
    expect(mock.getRequests().map(request => `${request.path} ${request.response.status}`)).toEqual([
      '/v1/messages 429',
      '/v1/responses 429',
      '/v1/responses 200',
    ]);
    expect(await savedHops()).toMatchObject([
      { from: { entryId: PRIMARY }, to: { entryId: FALLBACK }, failure: { kind: 'rate_limited' } },
    ]);
  });

  it('streams the hop at the start of the reply, under the id the reply is saved with', async () => {
    mock.on({ model: /claude/ }, ANTHROPIC_RATE_LIMIT);
    mock.on({ model: /gpt/ }, { content: 'Reviewed on the fallback' });
    const { session, send } = await startSession([{ modelId: PRIMARY }, { modelId: FALLBACK }]);
    const liveReplies: Array<{ id: string; partTypes: string[] }> = [];
    session.subscribe(event => {
      if (event.type === 'message_start' && event.message.role === 'assistant') {
        liveReplies.push({ id: event.message.id, partTypes: event.message.content.parts.map(part => part.type) });
      }
    });

    await send('Review the diff.');

    const saved = (await session.thread.listMessages({ threadId: session.thread.getId()! })).filter(
      message => message.role === 'assistant',
    );
    expect(liveReplies).toEqual([{ id: saved[0]?.id, partTypes: [MODEL_FALLBACK_PART_TYPE] }]);
    expect(saved.map(message => message.content.parts.map(part => part.type))).toEqual([
      [MODEL_FALLBACK_PART_TYPE, 'text'],
    ]);
  });
});

function captureAnthropicEfforts(): unknown[] {
  const originalFetch = globalThis.fetch;
  const efforts: unknown[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    if (String(input).endsWith('/v1/messages') && typeof init?.body === 'string') {
      efforts.push(JSON.parse(init.body).output_config?.effort);
    }
    return originalFetch(input, init);
  });
  return efforts;
}

describe('a Factory session whose route starts on another model than the session model', () => {
  it("runs the route's first model at the route's thinking level", async () => {
    mock.on({ model: /claude/ }, { content: 'Reviewed on the route primary' });
    mock.on({ model: /gpt/ }, { content: 'Answered on the session model' });
    const anthropicEfforts = captureAnthropicEfforts();
    const { session, send, lastReply, errors, savedHops } = await startSession([
      { modelId: PRIMARY, thinkingLevel: 'high' },
      { modelId: FALLBACK },
    ]);
    await session.model.switch(FALLBACK);
    await session.state.set({ thinkingLevel: 'low' });

    await send('Review the diff.');

    expect(errors).toEqual([]);
    expect(await lastReply()).toBe('Reviewed on the route primary');
    expect(anthropicEfforts).toEqual(['high']);
    expect(await savedHops()).toEqual([]);
    expect(new Set(mock.getRequests().map(request => `${request.path} ${request.response.status}`))).toEqual(
      new Set(['/v1/messages 200']),
    );
  });
});

describe('a Factory session whose fallback sets its own thinking level', () => {
  it('sends the fallback request at that level, not the session level', async () => {
    mock.on({ model: /gpt/ }, { error: { message: 'Rate limit reached', type: 'requests' }, status: 429 });
    mock.on({ model: /claude/ }, { content: 'Reviewed on the fallback' });
    const anthropicEfforts = captureAnthropicEfforts();
    const { session, send, lastReply, errors } = await startSession([
      { modelId: FALLBACK },
      { modelId: PRIMARY, thinkingLevel: 'high' },
    ]);
    await session.state.set({ thinkingLevel: 'low' });

    await send('Review the diff.');

    expect(errors).toEqual([]);
    expect(await lastReply()).toBe('Reviewed on the fallback');
    expect(anthropicEfforts).toEqual(['high']);
  });
});

describe('a Factory session whose route primary the provider no longer serves', () => {
  it('hands the turn to the next model in the route', async () => {
    mock.on(
      { model: /claude/ },
      { error: { message: 'model_not_found: claude-opus-5.5 does not exist', type: 'not_found_error' }, status: 404 },
    );
    mock.on({ model: /gpt/ }, { content: 'Reviewed on the fallback' });
    const { send, savedHops, lastReply, errors } = await startSession([{ modelId: PRIMARY }, { modelId: FALLBACK }]);

    await send('Review the diff.');

    expect(errors).toEqual([]);
    expect(await lastReply()).toBe('Reviewed on the fallback');
    expect(await savedHops()).toEqual([
      expect.objectContaining({
        from: { entryId: PRIMARY, label: PRIMARY },
        to: { entryId: FALLBACK, label: FALLBACK },
      }),
    ]);
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
    const { send, savedHops, lastReply, errors } = await startSession([{ modelId: PRIMARY }, { modelId: FALLBACK }]);

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
    const { send, savedHops, lastReply, errors } = await startSession([
      { modelId: PRIMARY },
      { modelId: 'google/gemini-3.8-flash' },
      { modelId: FALLBACK },
    ]);

    await send('Review the diff.');

    expect(errors).toEqual([]);
    expect(await lastReply()).toBe('Reviewed on the fallback');
    expect(await savedHops()).toMatchObject([{ from: { entryId: PRIMARY }, to: { entryId: FALLBACK } }]);
  });
});

describe('a Factory session whose prompt is too long for its first model', () => {
  it('hands the turn to the fallback and records the context overflow', async () => {
    mock.on(
      { model: /claude/ },
      {
        error: { message: 'prompt is too long: 250000 tokens > 200000 maximum', type: 'invalid_request_error' },
        status: 400,
      },
    );
    mock.on({ model: /gpt/ }, { content: 'Reviewed on the fallback' });
    const { send, savedHops, lastReply, errors } = await startSession([{ modelId: PRIMARY }, { modelId: FALLBACK }]);

    await send('Review the diff.');

    expect(errors).toEqual([]);
    expect(await lastReply()).toBe('Reviewed on the fallback');
    expect(await savedHops()).toMatchObject([{ to: { entryId: FALLBACK }, failure: { kind: 'context_overflow' } }]);
  });
});

describe('a Factory session whose every model is rate-limited', () => {
  it('ends the turn in error and keeps the rate-limited hop in history', async () => {
    mock.on({ model: /claude/ }, ANTHROPIC_RATE_LIMIT);
    mock.on(
      { model: /gpt/ },
      { error: { message: 'Rate limit reached', type: 'requests' }, status: 429, retryAfter: 1 },
    );
    const { send, savedHops, errors } = await startSession([{ modelId: PRIMARY }, { modelId: FALLBACK }]);

    await send('Review the diff.');

    expect(errors).toEqual(['Rate limit reached']);
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
