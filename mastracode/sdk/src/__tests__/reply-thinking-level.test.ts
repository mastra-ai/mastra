import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { LLMock } from '@copilotkit/aimock';
import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { EventEmitterPubSub } from '@mastra/core/events';
import { RequestContext } from '@mastra/core/request-context';
import { LibSQLStore } from '@mastra/libsql';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveAuthenticatedCredentialTenant, setCredentialStoreProvider } from '../agents/credential-resolver.js';
import { createMastraCode } from '../index.js';

vi.setConfig({ testTimeout: 60_000 });

const OWNER = { workosId: 'user-a', organizationId: 'org-1' };
const MODEL = 'openai/gpt-5.4-mini';
const ownerContext = () => new RequestContext([['user', { ...OWNER }]]);

let directory: string;
let mock: LLMock;
let stops: Array<() => Promise<void> | void>;

beforeEach(async () => {
  directory = mkdtempSync(path.join(tmpdir(), 'mastracode-reply-thinking-'));
  mock = new LLMock({ port: 0 });
  mock.onMessage(/.*/, { content: 'Shipped.' });
  await mock.start();
  vi.stubEnv('OPENAI_BASE_URL', `${mock.url.replace(/\/+$/, '')}/v1`);
  vi.stubEnv('OPENAI_API_KEY', 'sk-local');
  vi.stubEnv('MASTRA_APP_DATA_DIR', path.join(directory, 'app-data'));
  vi.stubEnv('MASTRACODE_DISABLE_UNIX_SOCKET_PUBSUB', '1');
  vi.stubEnv('MASTRACODE_DISABLE_OBSERVATIONAL_MEMORY', '1');
  stops = [];
});

afterEach(async () => {
  setCredentialStoreProvider(undefined);
  for (const stop of stops.splice(0).reverse()) await stop();
  await mock.stop();
  vi.unstubAllEnvs();
  rmSync(directory, { recursive: true, force: true });
});

function resolveCredentialsPerRequest() {
  setCredentialStoreProvider(
    () => ({
      allowEnvironmentFallback: false,
      reload: () => {},
      get: () => ({ type: 'api_key', key: 'sk-tenant' }),
      getStoredApiKey: () => 'sk-tenant',
      getApiKey: async () => 'sk-tenant',
    }),
    async requestContext => resolveAuthenticatedCredentialTenant(requestContext),
  );
}

async function sendOneMessage() {
  const settingsPath = path.join(directory, 'settings.json');
  writeFileSync(
    settingsPath,
    JSON.stringify({
      onboarding: { skippedAt: '2026-01-01T00:00:00.000Z', version: 1 },
      models: { activeModelPackId: null, modeDefaults: { build: MODEL, plan: MODEL } },
    }),
  );
  const storage = new LibSQLStore({ id: 'reply-thinking', url: `file:${path.join(directory, 'mastra.db')}` });
  const code = await createMastraCode({
    cwd: directory,
    homeDir: directory,
    configDir: '.mastracode-test',
    settingsPath,
    storage,
    storageBackend: 'libsql',
    pubsub: new EventEmitterPubSub(),
    disableMcp: true,
    disableHooks: true,
    disableEnvFile: true,
    disablePlugins: true,
    disableGithubSignals: true,
    createInitialThread: false,
  });
  stops.push(() => code.controller.getMastra()?.shutdown());
  const session = await code.controller.createSession({
    id: 'session-a',
    resourceId: 'session-a',
    ownerId: OWNER.workosId,
    requestContext: ownerContext(),
  });
  await session.state.set({ thinkingLevel: 'high' });
  const liveReplies: MastraDBMessage[] = [];
  session.subscribe(event => {
    if (event.type === 'message_start' && event.message.role === 'assistant') liveReplies.push(event.message);
  });

  await session.sendMessage({ content: 'Ship it.', requestContext: ownerContext() });
  await vi.waitFor(() => expect(session.run.isRunning()).toBe(false), { timeout: 20_000 });

  const memory = await storage.getStore('memory');
  const { messages } = await memory!.listMessages({ threadId: session.thread.getId()! });
  return { liveReply: liveReplies[0], savedReply: messages.find(message => message.role === 'assistant') };
}

describe.each([
  { host: 'a Factory host resolving credentials per request', setUp: resolveCredentialsPerRequest },
  { host: 'a local session', setUp: () => {} },
])('a finished reply on $host', ({ setUp }) => {
  it('records the thinking level it was sent with, live and once saved', async () => {
    setUp();

    const { liveReply, savedReply } = await sendOneMessage();

    expect(savedReply?.content.metadata).toMatchObject({ thinkingLevel: 'high' });
    expect(liveReply?.content.metadata).toMatchObject({ thinkingLevel: 'high' });
  });
});
