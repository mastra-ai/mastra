import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createMastraCode } from '@mastra/code-sdk';
import { EventEmitterPubSub } from '@mastra/core/events';
import { RequestContext } from '@mastra/core/request-context';
import { LibSQLStore } from '@mastra/libsql';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { FactoryDecisionDispatcher } from './dispatcher.js';
import { FactoryTransitionService } from './transition-service.js';

vi.setConfig({ testTimeout: 60_000 });

const PROJECT_ID = '11111111-2222-4333-8444-555555555555';
const USER = { workosId: 'user-1', organizationId: 'org-1' };
const server = setupServer();

let directory: string;
let stops: Array<() => Promise<void> | void>;

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterAll(() => server.close());

beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), 'factory-provider-limit-'));
  vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
  vi.stubEnv('OPENAI_API_KEY', 'sk-test');
  vi.stubEnv('ZHIPU_API_KEY', 'zai-test');
  vi.stubEnv('MASTRA_APP_DATA_DIR', path.join(directory, 'app-data'));
  vi.stubEnv('MASTRACODE_DISABLE_UNIX_SOCKET_PUBSUB', '1');
  vi.stubEnv('MASTRACODE_DISABLE_OBSERVATIONAL_MEMORY', '1');
  stops = [];
});

afterEach(async () => {
  for (const stop of stops.splice(0).reverse()) await stop();
  server.resetHandlers();
  vi.unstubAllEnvs();
  rmSync(directory, { recursive: true, force: true });
});

const PROVIDERS = {
  anthropic: { model: 'anthropic/claude-sonnet-4-5', endpoint: 'https://api.anthropic.com/v1/messages' },
  openai: { model: 'openai/gpt-5.4-mini', endpoint: 'https://api.openai.com/v1/*' },
  zai: { model: 'zai/glm-4.5', endpoint: 'https://api.z.ai/api/paas/v4/chat/completions' },
} as const;

async function startFactorySession(provider: keyof typeof PROVIDERS) {
  const { model } = PROVIDERS[provider];
  const settingsPath = path.join(directory, 'settings.json');
  writeFileSync(
    settingsPath,
    JSON.stringify({
      onboarding: { skippedAt: '2026-01-01T00:00:00.000Z', version: 1 },
      models: { activeModelPackId: null, modeDefaults: { build: model, plan: model } },
    }),
  );
  const code = await createMastraCode({
    cwd: directory,
    homeDir: directory,
    configDir: '.mastracode-test',
    settingsPath,
    storage: new LibSQLStore({ id: 'provider-limit', url: `file:${path.join(directory, 'mastra.db')}` }),
    storageBackend: 'libsql',
    pubsub: new EventEmitterPubSub(),
    disableMcp: true,
    disableHooks: true,
    disableEnvFile: true,
    disablePlugins: true,
    disableGithubSignals: true,
    createInitialThread: false,
  });
  stops.push(() => code.controller.shutdown?.());
  await code.controller.createSession({
    id: 'session-1',
    resourceId: 'session-1',
    ownerId: USER.workosId,
    threadId: 'thread-1',
    requestContext: new RequestContext([['user', { ...USER }]]),
  });

  const storage = (await createFactoryStorageForTests()).workItems;
  const { item } = await storage.upsert({
    orgId: USER.organizationId,
    userId: USER.workosId,
    factoryProjectId: PROJECT_ID,
    input: {
      externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:1' },
      title: 'Fix issue',
      stages: ['intake'],
      sessions: {},
      metadata: { authorTrusted: true },
    },
  });
  await storage.prepareRunStart({
    orgId: USER.organizationId,
    userId: USER.workosId,
    factoryProjectId: PROJECT_ID,
    workItem: {
      id: item.id,
      input: {
        externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:1' },
        title: 'Fix issue',
        stages: ['intake'],
        sessions: {},
        metadata: {},
      },
    },
    role: 'work',
    session: { sessionId: 'session-1', branch: 'factory/issue-1', threadId: 'thread-1' },
    resourceId: 'session-1',
    kickoffKey: 'kickoff-1',
    kickoffMessage: 'Investigate the issue.',
  });
  const dispatcher = new FactoryDecisionDispatcher({
    controller: code.controller,
    isAutoRunEnabled: async () => true,
    transitionService: new FactoryTransitionService({ storage, configVersion: 'rules-v1' }),
    storage,
    ownerId: 'worker-1',
  });
  return { storage, dispatcher };
}

describe('a Factory kickoff whose model provider refuses it on a limit (#28696)', () => {
  it.each([
    [
      'an Anthropic account rate limit',
      'anthropic',
      {
        type: 'error',
        error: {
          type: 'rate_limit_error',
          message: "This request would exceed your account's rate limit. Please try again later.",
        },
      },
    ],
    [
      'an exhausted OpenAI quota',
      'openai',
      {
        error: {
          message: 'You exceeded your current quota, please check your plan and billing details.',
          type: 'insufficient_quota',
          param: null,
          code: 'insufficient_quota',
        },
      },
    ],
  ] as const)('stops after one attempt on %s and waits for a person', async (_case, provider, body) => {
    let modelCalls = 0;
    server.use(
      http.post(PROVIDERS[provider].endpoint, () => {
        modelCalls += 1;
        return HttpResponse.json(body, { status: 429 });
      }),
    );
    const { storage, dispatcher } = await startFactorySession(provider);

    await dispatcher.runOnce(new Date());
    const callsInFirstAttempt = modelCalls;
    await dispatcher.runOnce(new Date(Date.now() + 2 * 60 * 60_000));

    expect(callsInFirstAttempt).toBeGreaterThan(0);
    expect(modelCalls).toBe(callsInFirstAttempt);
    expect((await storage.listPendingStarts(USER.organizationId, PROJECT_ID))[0]).toMatchObject({
      status: 'failed',
      attempts: 1,
      failureCode: 'run_provider_limited',
      lastError: expect.stringContaining(body.error.message),
    });
  });

  // A provider that already started answering reports a limit inside the 200 stream. Anthropic's and OpenAI's
  // SDKs infer a status for it; the OpenAI-compatible one passes the provider's error on with its codes alone,
  // which used to be replayed like any other failure.
  it.each([
    [
      'an Anthropic rate limit',
      'anthropic',
      [
        {
          type: 'message_start',
          message: {
            id: 'msg_1',
            type: 'message',
            role: 'assistant',
            model: 'claude-sonnet-4-5',
            content: [],
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: 10, output_tokens: 1 },
          },
        },
        { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Looking into it' } },
        {
          type: 'error',
          error: {
            type: 'rate_limit_error',
            message: 'Number of request tokens has exceeded your per-minute rate limit.',
          },
        },
      ],
    ],
    [
      'an OpenAI rate limit',
      'openai',
      [
        {
          type: 'response.created',
          sequence_number: 0,
          response: { id: 'resp_1', created_at: 1, model: 'gpt-5.4-mini', status: 'in_progress', output: [] },
        },
        {
          type: 'response.output_item.added',
          sequence_number: 1,
          output_index: 0,
          item: { type: 'message', id: 'msg_1', status: 'in_progress', role: 'assistant', content: [] },
        },
        {
          type: 'response.output_text.delta',
          sequence_number: 2,
          item_id: 'msg_1',
          output_index: 0,
          content_index: 0,
          delta: 'Looking into it',
        },
        {
          type: 'error',
          sequence_number: 3,
          code: 'rate_limit_exceeded',
          message: 'Rate limit reached for gpt-5.4-mini on tokens per min.',
          param: null,
        },
      ],
    ],
    [
      'an OpenAI-compatible provider rate limit',
      'zai',
      [
        {
          id: 'chunk-1',
          object: 'chat.completion.chunk',
          created: 1,
          model: 'glm-4.5',
          choices: [{ index: 0, delta: { role: 'assistant', content: 'Looking into it' }, finish_reason: null }],
        },
        { error: { message: 'Rate limit reached for requests.', type: 'requests', code: 'rate_limit_exceeded' } },
      ],
    ],
  ] as const)('stops after one attempt on %s reported mid-stream', async (_case, provider, events) => {
    let modelCalls = 0;
    server.use(
      http.post(PROVIDERS[provider].endpoint, () => {
        modelCalls += 1;
        const stream = events
          .map(event => `${'type' in event ? `event: ${event.type}\n` : ''}data: ${JSON.stringify(event)}\n\n`)
          .join('');
        return new HttpResponse(stream, { headers: { 'Content-Type': 'text/event-stream' } });
      }),
    );
    const { storage, dispatcher } = await startFactorySession(provider);

    await dispatcher.runOnce(new Date());
    const callsInFirstAttempt = modelCalls;
    await dispatcher.runOnce(new Date(Date.now() + 2 * 60 * 60_000));

    expect(callsInFirstAttempt).toBeGreaterThan(0);
    expect(modelCalls).toBe(callsInFirstAttempt);
    expect((await storage.listPendingStarts(USER.organizationId, PROJECT_ID))[0]).toMatchObject({
      status: 'failed',
      attempts: 1,
      failureCode: 'run_provider_limited',
    });
  });
});
