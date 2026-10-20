import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { LLMock } from '@copilotkit/aimock';
import { EventEmitterPubSub } from '@mastra/core/events';
import { dispatchDueNotifications } from '@mastra/core/notifications';
import { RequestContext } from '@mastra/core/request-context';
import { LibSQLStore } from '@mastra/libsql';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveAuthenticatedCredentialTenant, setCredentialStoreProvider } from '../agents/credential-resolver.js';
import type { CredentialTenant } from '../agents/credential-resolver.js';
import type { CredentialStore } from '../auth/types.js';
import { createMastraCode } from '../index.js';

vi.setConfig({ testTimeout: 60_000 });

const OWNER = { workosId: 'user-a', organizationId: 'org-1' };
const SENDER = { workosId: 'user-b', organizationId: 'org-1' };
const SESSION_ID = 'session-a';
const MODEL = 'gpt-5.4-mini';

const tenantStore = (apiKey: string): CredentialStore => ({
  allowEnvironmentFallback: false,
  reload: () => {},
  get: () => ({ type: 'api_key', key: apiKey }),
  getStoredApiKey: () => apiKey,
  getApiKey: async () => apiKey,
});

let directory: string;
let mock: LLMock;
let resolvedTenants: CredentialTenant[];
let storeTenants: string[];
let stops: Array<() => Promise<void> | void>;

beforeEach(async () => {
  directory = mkdtempSync(path.join(tmpdir(), 'mastracode-wake-owner-'));
  mock = new LLMock({ port: 0 });
  mock.onMessage(/.*/, { content: 'Woke as the owner.' });
  await mock.start();
  vi.stubEnv('OPENAI_BASE_URL', `${mock.url.replace(/\/+$/, '')}/v1`);
  vi.stubEnv('OPENAI_API_KEY', 'process-env-key-must-not-be-used');
  vi.stubEnv('MASTRA_APP_DATA_DIR', path.join(directory, 'app-data'));
  vi.stubEnv('MASTRACODE_DISABLE_UNIX_SOCKET_PUBSUB', '1');
  vi.stubEnv('MASTRACODE_DISABLE_OBSERVATIONAL_MEMORY', '1');
  resolvedTenants = [];
  storeTenants = [];
  stops = [];
  // A deployed host: the tenant comes from the run's authenticated principal only,
  // and each principal gets its own credential store.
  setCredentialStoreProvider(
    tenant => {
      storeTenants.push(tenant.userId);
      return tenantStore(`key-for-${tenant.userId}`);
    },
    async requestContext => {
      const tenant = resolveAuthenticatedCredentialTenant(requestContext);
      if (tenant) resolvedTenants.push(tenant);
      return tenant;
    },
  );
});

afterEach(async () => {
  setCredentialStoreProvider(undefined);
  for (const stop of stops.splice(0).reverse()) await stop();
  await mock.stop();
  vi.unstubAllEnvs();
  rmSync(directory, { recursive: true, force: true });
});

async function start({ resume, scheduleTools = false }: { resume: 'owner' | 'unresolvable'; scheduleTools?: boolean }) {
  const settingsPath = path.join(directory, 'settings.json');
  writeFileSync(
    settingsPath,
    JSON.stringify({
      onboarding: { skippedAt: '2026-01-01T00:00:00.000Z', version: 1 },
      models: { activeModelPackId: null, modeDefaults: { build: `openai/${MODEL}`, plan: `openai/${MODEL}` } },
    }),
  );
  const storage = new LibSQLStore({ id: 'wake-owner', url: `file:${path.join(directory, 'mastra.db')}` });
  // Mirrors how a Factory host runs wakes as the session's stored owner.
  const ownerContext = () => new RequestContext([['user', { ...OWNER }]]);
  let controller: Awaited<ReturnType<typeof createMastraCode>>['controller'] | undefined;
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
    scheduleTools,
    prepareWakeRequestContext: async ({ requestContext, resourceId }) => {
      if (resourceId === SESSION_ID) requestContext.set('user', { ...OWNER });
    },
    resumeWakeSession: async ({ resourceId, threadId }) => {
      // An unresolvable owner (no stored session row, no org) leaves the session offline.
      if (resume === 'unresolvable' || resourceId !== SESSION_ID) return;
      await controller!.createSession({
        id: resourceId,
        resourceId,
        ownerId: OWNER.workosId,
        threadId,
        requestContext: ownerContext(),
      });
    },
  });
  controller = code.controller;
  stops.push(() => code.controller.shutdown?.());
  return { code, storage, ownerContext };
}

/**
 * The session owned by user A has a notification pending on its thread, sent by
 * user B's session, which is still live here. This process no longer holds A's
 * session live: it was evicted, or the process restarted since. The core
 * dispatcher delivers the notification.
 */
async function dispatchToEvictedSession(resume: 'owner' | 'unresolvable', priority: 'high' | 'low' = 'high') {
  const { code, storage, ownerContext } = await start({ resume });
  const session = await code.controller.createSession({
    id: SESSION_ID,
    resourceId: SESSION_ID,
    ownerId: OWNER.workosId,
    requestContext: ownerContext(),
  });
  const threadId = session.thread.getId()!;
  expect(threadId).toBeTruthy();
  await code.controller.deleteSession({ resourceId: SESSION_ID });
  await code.controller.createSession({
    id: 'session-b',
    resourceId: 'session-b',
    ownerId: SENDER.workosId,
    requestContext: new RequestContext([['user', { ...SENDER }]]),
  });

  const notifications = (await storage.getStore('notifications'))!;
  await notifications.createNotification({
    agentId: code.codeAgent.id,
    resourceId: SESSION_ID,
    threadId,
    source: 'factory-session',
    kind: 'message',
    summary: 'session-b: please pick this back up',
    priority,
    // Low-priority notifications are summarized into the thread instead of waking it.
    ...(priority === 'low' ? { summaryAt: new Date(Date.now() - 1_000) } : { deliverAt: new Date(Date.now() - 1_000) }),
  });

  // Only what the wake itself resolves counts.
  resolvedTenants = [];
  storeTenants = [];
  const mastra = code.controller.getMastra()!;
  const result = await dispatchDueNotifications({ mastra, storage: notifications, resourceId: SESSION_ID });
  return { result, notifications, threadId };
}

describe('waking a Factory-style session that is not live in this process', () => {
  it('runs the wake as the session owner, with the owner credentials', async () => {
    const { result, notifications, threadId } = await dispatchToEvictedSession('owner');

    expect(result.failed.map(failure => failure.error)).toEqual([]);
    await vi.waitFor(() => expect(mock.getRequests().length).toBeGreaterThan(0), { timeout: 20_000 });
    expect(new Set(storeTenants)).toEqual(new Set([OWNER.workosId]));
    expect(resolvedTenants.length).toBeGreaterThan(0);
    expect(resolvedTenants.every(tenant => tenant.userId === OWNER.workosId)).toBe(true);
    const [record] = await notifications.listNotifications({ threadId, resourceId: SESSION_ID });
    expect(record!.status).toBe('delivered');
  });

  it('writes a low-priority summary as the session owner, with observational memory on', async () => {
    // Writing the summary resolves the agent's memory, and observational memory
    // resolves its model through the tenant credentials, so it needs the owner too.
    vi.stubEnv('MASTRACODE_DISABLE_OBSERVATIONAL_MEMORY', '');
    const { result, notifications, threadId } = await dispatchToEvictedSession('owner', 'low');

    expect(result.failed.map(failure => failure.error)).toEqual([]);
    expect(result.signals).toHaveLength(1);
    expect(resolvedTenants.length).toBeGreaterThan(0);
    expect(resolvedTenants.every(tenant => tenant.userId === OWNER.workosId)).toBe(true);
    const [record] = await notifications.listNotifications({ threadId, resourceId: SESSION_ID });
    expect(record).toMatchObject({ deliveryAttempts: 0, summarySignalId: result.signals[0]!.id });
    expect(mock.getRequests()).toEqual([]);
  });

  it('fails the delivery with a clear error, without an anonymous run, when the owner cannot be resolved', async () => {
    const { result, notifications, threadId } = await dispatchToEvictedSession('unresolvable');

    expect(result.signals).toEqual([]);
    expect(result.failed.map(failure => failure.error)).toEqual([
      `No session owns resource ${SESSION_ID} to run its wake on thread ${threadId}.`,
    ]);
    const [record] = await notifications.listNotifications({ threadId, resourceId: SESSION_ID });
    expect(record).toMatchObject({ status: 'pending', deliveryAttempts: 1 });
    expect(mock.getRequests()).toEqual([]);
    expect(resolvedTenants).toEqual([]);
    expect(storeTenants).toEqual([]);
  });

  it('keeps a notification sent while the owner cannot be resolved due for retry', async () => {
    const { code, storage, ownerContext } = await start({ resume: 'unresolvable' });
    const session = await code.controller.createSession({
      id: SESSION_ID,
      resourceId: SESSION_ID,
      ownerId: OWNER.workosId,
      requestContext: ownerContext(),
    });
    const threadId = session.thread.getId()!;
    await code.controller.deleteSession({ resourceId: SESSION_ID });

    // The delivery policy, and so resumeWakeSession, already runs when the
    // notification is sent, not only when the dispatcher delivers it.
    const sent = await code.codeAgent.sendNotificationSignal(
      { source: 'github', kind: 'pr-comment', summary: 'review landed', priority: 'high' },
      { resourceId: SESSION_ID, threadId },
    );

    const error = `No session owns resource ${SESSION_ID} to run its wake on thread ${threadId}.`;
    expect(sent.signal).toBeUndefined();
    expect(sent.record).toMatchObject({ status: 'pending', deliveryAttempts: 1, lastDeliveryError: error });
    expect(sent.record.deliverAt).toBeInstanceOf(Date);

    const notifications = (await storage.getStore('notifications'))!;
    const later = await dispatchDueNotifications({
      mastra: code.controller.getMastra()!,
      storage: notifications,
      resourceId: SESSION_ID,
      now: new Date(Date.now() + 60_000),
    });
    expect(later.failed.map(failure => failure.error)).toEqual([error]);
    const [record] = await notifications.listNotifications({ threadId, resourceId: SESSION_ID });
    expect(record).toMatchObject({ status: 'pending', deliveryAttempts: 2 });
    expect(mock.getRequests()).toEqual([]);
  });
});

/**
 * Session A has a schedule on its thread, and this process no longer holds A's
 * session live. The scheduler fires it (`run` fires now instead of waiting).
 */
async function fireScheduleIntoEvictedSession(resume: 'owner' | 'unresolvable') {
  const { code, ownerContext } = await start({ resume, scheduleTools: true });
  const session = await code.controller.createSession({
    id: SESSION_ID,
    resourceId: SESSION_ID,
    ownerId: OWNER.workosId,
    requestContext: ownerContext(),
  });
  const threadId = session.thread.getId()!;
  await code.controller.deleteSession({ resourceId: SESSION_ID });
  const schedule = code.threadScheduler.create(
    { prompt: 'check the build', trigger: { kind: 'every', interval: { ms: 60_000 } } },
    { resourceId: SESSION_ID, threadId },
  );
  resolvedTenants = [];
  storeTenants = [];
  const result = await code.threadScheduler.run(schedule.id);
  code.threadScheduler.delete(schedule.id);
  return { result, threadId };
}

describe('a schedule firing into a session that is not live in this process', () => {
  it('runs the scheduled prompt as the session owner, with the owner credentials', async () => {
    const { result } = await fireScheduleIntoEvictedSession('owner');

    expect(result).toMatchObject({ status: 'fired' });
    await vi.waitFor(() => expect(mock.getRequests().length).toBeGreaterThan(0), { timeout: 20_000 });
    expect(new Set(storeTenants)).toEqual(new Set([OWNER.workosId]));
    expect(resolvedTenants.every(tenant => tenant.userId === OWNER.workosId)).toBe(true);
  });

  it('fails the fire with a clear error, without an anonymous run, when the owner cannot be resolved', async () => {
    const { result, threadId } = await fireScheduleIntoEvictedSession('unresolvable');

    expect(result).toMatchObject({
      status: 'failed',
      error: { message: `No session owns resource ${SESSION_ID} to run its wake on thread ${threadId}.` },
    });
    expect(mock.getRequests()).toEqual([]);
    expect(resolvedTenants).toEqual([]);
    expect(storeTenants).toEqual([]);
  });
});
