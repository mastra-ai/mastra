/**
 * Mastra Code runs one process per project, and every process shares one
 * database, so one notification store. Any process's dispatcher can pick up
 * another project's notification. Before this fix each project coordinated
 * runs only inside its own socket directory, so that process saw the thread as
 * idle and started a second run on a thread that was already working in its
 * own project's process.
 *
 * These tests use the real Unix-socket pubsub with two different resources.
 */
import { mkdtempSync, rmSync } from 'node:fs';

import { Agent } from '@mastra/core/agent';
import type { Session } from '@mastra/core/agent-controller';
import { Mastra } from '@mastra/core/mastra';
import {
  defaultNotificationDeliveryDecision,
  dispatchDueNotifications,
  InMemoryNotificationsStorage,
} from '@mastra/core/notifications';
import { MastraCompositeStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { convertArrayToReadableStream, MockLanguageModelV3 } from 'ai/test';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createResourceNotificationDispatcher, shouldHoldNotificationDelivery } from '../notification-dispatch.js';
import { createSignalsPubSub, notificationDispatchLeaseKey } from '../signals-pubsub.js';
import { FOREIGN_THREAD, findWakeSession, sessionLeaseScopes, threadScopeKey } from '../wake-session.js';

const AGENT_ID = 'code-agent';
const USAGE = { inputTokens: { total: 1 }, outputTokens: { total: 1 } };
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

const cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

/** Records work on the thread across both processes, so a second run anywhere reads as two in flight. */
function createWorkLog() {
  let inFlight = 0;
  let maxInFlight = 0;
  const ran: string[] = [];
  return {
    enter(what: string) {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      ran.push(what);
      let left = false;
      return () => {
        if (left) return;
        left = true;
        inFlight -= 1;
      };
    },
    get inFlight() {
      return inFlight;
    },
    get maxInFlight() {
      return maxInFlight;
    },
    ran,
  };
}

type WorkLog = ReturnType<typeof createWorkLog>;

/** One Mastra Code project's process: its own resource, its own socket directory, the shared store. */
function createProject(
  name: string,
  {
    rootDir,
    resourceId,
    notifications,
    work,
    withDispatch = false,
    projectPath,
    threadProjects = {},
    openThreadId = null,
  }: {
    rootDir: string;
    resourceId: string;
    notifications: InMemoryNotificationsStorage;
    work: WorkLog;
    /** Give this process Mastra Code's own dispatch: a dispatch timer for its resource and the hold policy. */
    withDispatch?: boolean;
    /** The directory this process runs in: its session's thread scope. */
    projectPath?: string;
    /** The project each thread of the resource was created in (its `projectPath` tag), shared by every process. */
    threadProjects?: Record<string, string>;
    /** The thread this process's session has open, whatever project it was created in. */
    openThreadId?: string | null;
  },
) {
  // This process's one live session, as Mastra Code's delivery policy sees it.
  let sessionLive = true;
  const session = {
    identity: { getResourceId: () => resourceId },
    getThreadScope: () => (projectPath ? { projectPath } : {}),
    thread: {
      getId: () => openThreadId,
      getById: async ({ threadId }: { threadId: string }) =>
        threadProjects[threadId]
          ? { id: threadId, resourceId, metadata: { projectPath: threadProjects[threadId] } }
          : null,
    },
  } as unknown as Session<unknown>;
  const sessions = {
    getSession: async (id: string) => (sessionLive && id === resourceId ? session : undefined),
  };
  let toolRunning = 0;
  let calls = 0;
  const model = new MockLanguageModelV3({
    doStream: async ({ prompt }) => {
      const call = ++calls;
      const leave = work.enter(`${name}:model`);
      const needsTool = prompt[prompt.length - 1]?.role !== 'tool';
      leave();
      return {
        stream: convertArrayToReadableStream(
          needsTool
            ? [
                { type: 'stream-start', warnings: [] },
                { type: 'tool-call', toolCallId: `${name}-${call}`, toolName: 'slowTool', input: '{}' },
                { type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool-calls' }, usage: USAGE },
              ]
            : [
                { type: 'stream-start', warnings: [] },
                { type: 'text-start', id: 't' },
                { type: 'text-delta', id: 't', delta: 'done' },
                { type: 'text-end', id: 't' },
                { type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage: USAGE },
              ],
        ),
      } as any;
    },
  });
  const slowTool = createTool({
    id: 'slowTool',
    description: 'Takes a while, like a shell command',
    inputSchema: z.object({}),
    execute: async () => {
      toolRunning += 1;
      const leave = work.enter(`${name}:tool`);
      try {
        await sleep(200);
        return { ok: true };
      } finally {
        toolRunning -= 1;
        leave();
      }
    },
  });

  const pubsub = createSignalsPubSub(resourceId, { rootDir });
  const dispatcher = createResourceNotificationDispatcher({
    getMastra: () => mastra,
    getSessionScopes: async () =>
      sessionLive ? (await sessionLeaseScopes(session)).map(scope => ({ resourceId, scope })) : [],
    leases: pubsub.getLeaseProvider(),
    owner: name,
    // Ticked by hand.
    intervalMs: 3_600_000,
  });
  const agent = new Agent({
    id: AGENT_ID,
    name: AGENT_ID,
    instructions: 'Test',
    model,
    tools: { slowTool },
    ...(withDispatch
      ? {
          // Mastra Code's delivery policy (`notifications` in index.ts), without the stream options.
          notifications: {
            deliveryPolicy: {
              decide: async input => {
                const decision = defaultNotificationDeliveryDecision(input);
                const owner = await findWakeSession(
                  sessions,
                  [session],
                  { resourceId: input.record.resourceId!, threadId: input.record.threadId },
                  pubsub.getLeaseProvider(),
                );
                if (owner === FOREIGN_THREAD) return { ...decision, hold: true };
                const hold = shouldHoldNotificationDelivery({
                  resourceId: input.record.resourceId!,
                  scope: owner?.scope,
                  ownedHere: owner !== undefined,
                  dispatcher,
                });
                return hold ? { ...decision, hold: true } : undefined;
              },
            },
          },
        }
      : {}),
  });
  const mastra: Mastra = new Mastra({
    logger: false,
    agents: { [AGENT_ID]: agent },
    pubsub,
    storage: new MastraCompositeStore({ id: `${name}-storage`, domains: { notifications } }),
  });
  cleanups.push(async () => {
    await dispatcher.stop();
    await mastra.shutdown().catch(() => {});
    await pubsub.close().catch(() => {});
  });

  return {
    agent,
    resourceId,
    leases: pubsub.getLeaseProvider(),
    /** What this process does when it wins a fire of the dispatch schedule every process shares. */
    dispatchTick: () => dispatchDueNotifications({ mastra, storage: notifications }),
    /** This process's own dispatch of its resource. */
    dispatcher,
    /** Close this process's session, as when the user quits it; the process keeps running. */
    closeSession: () => {
      sessionLive = false;
    },
    get toolRunning() {
      return toolRunning;
    },
  };
}

async function waitFor(predicate: () => boolean, what: string, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await sleep(5);
  }
}

async function setUp({ withDispatch = false }: { withDispatch?: boolean } = {}) {
  // Short root: socket paths are capped at 104 bytes on macOS.
  const rootDir = mkdtempSync('/tmp/mct-');
  cleanups.push(() => rmSync(rootDir, { recursive: true, force: true }));
  // Unique per test, so nothing carries over between tests even where the
  // socket root is not honored (the code before this fix put every socket
  // under /tmp/mc).
  const suffix = Math.random().toString(36).slice(2, 8);
  const notifications = new InMemoryNotificationsStorage();
  const work = createWorkLog();
  const ours = createProject('ours', { rootDir, resourceId: `sentinel-${suffix}`, notifications, work, withDispatch });
  const other = createProject('other', { rootDir, resourceId: `mastra-${suffix}`, notifications, work, withDispatch });
  const target = { resourceId: ours.resourceId, threadId: 'sentinel-thread' };
  const memory = { resource: target.resourceId, thread: target.threadId };
  return { rootDir, notifications, work, ours, other, target, memory };
}

/** A notification already due, as the dispatcher finds it after a deferral or a summary schedule. */
function dueNotification(resourceId: string, threadId: string, extra: { id: string; priority?: 'urgent' | 'high' }) {
  return {
    agentId: AGENT_ID,
    resourceId,
    threadId,
    source: 'sentinel',
    kind: 'ping',
    priority: extra.priority ?? 'high',
    summary: 'ping',
    deliverAt: new Date(Date.now() - 1000),
    id: extra.id,
  } as const;
}

describe('notifications shared across Mastra Code projects', () => {
  for (const claimed of [false, true]) {
    it(`another project's process never runs our active thread (${claimed ? 'thread claimed' : 'no claim'})`, async () => {
      const { notifications, work, ours, other, target, memory } = await setUp();
      if (claimed) {
        // With cross-agent signals on, Mastra Code claims every thread it loads.
        const claim = await ours.agent.claimThreadOwnership({ ...target, streamOptions: { memory } });
        expect(claim.claimed).toBe(true);
        cleanups.push(() => claim.unsubscribe());
      }

      const stream = await ours.agent.stream('go', { memory });
      void stream.consumeStream().catch(() => {});
      await waitFor(() => ours.toolRunning > 0, 'our tool call');

      // Active run: a summary goes in now, the full notification waits in the shared store.
      await ours.agent.sendNotificationSignal(
        { source: 'sentinel', kind: 'ping', priority: 'high', summary: 'ping' },
        target,
      );
      const [record] = await notifications.listNotifications({ threadId: target.threadId });
      expect(record?.status).toBe('pending');

      // The other project's dispatcher ticks while our run is still working.
      await other.dispatchTick();
      await sleep(100);
      expect(
        work.ran.filter(entry => entry.startsWith('other:')),
        "the other project's process ran our thread",
      ).toEqual([]);
      expect(work.maxInFlight, 'two runs worked on the thread at once').toBe(1);

      await waitFor(
        () => work.inFlight === 0 && ours.agent.getActiveThreadRunId(target) === undefined,
        'our run to end',
        5000,
      );
      await ours.dispatchTick();
      await waitFor(
        () => work.inFlight === 0 && ours.agent.getActiveThreadRunId(target) === undefined,
        'the thread to settle',
        5000,
      );

      const final = await notifications.getNotification({ threadId: target.threadId, id: record!.id });
      expect(final?.status).toBe('delivered');
      expect(final?.lastDeliveryError ?? undefined, 'a delivery attempt failed').toBeUndefined();
      expect(work.ran.filter(entry => entry.startsWith('other:'))).toEqual([]);
      expect(work.maxInFlight).toBe(1);
    }, 30_000);
  }
});

describe("each Mastra Code process delivers its own resources' notifications", () => {
  it('the process that wins the shared dispatch schedule holds them, and the owner delivers them itself', async () => {
    const { notifications, work, ours, other, target } = await setUp({ withDispatch: true });
    ours.dispatcher.start();
    other.dispatcher.start();
    await Promise.all([ours.dispatcher.tick(), other.dispatcher.tick()]);
    await notifications.createNotification(dueNotification(target.resourceId, target.threadId, { id: 'n1' }));

    for (let fire = 0; fire < 3; fire++) {
      expect(await other.dispatchTick()).toEqual({ delivered: [], failed: [], signals: [] });
    }
    const held = await notifications.getNotification({ threadId: target.threadId, id: 'n1' });
    expect(held).toMatchObject({ status: 'pending' });
    expect(held?.deliveryAttempts ?? 0).toBe(0);
    expect(work.ran).toEqual([]);

    await ours.dispatcher.tick();
    await waitFor(() => work.ran.length > 0 && work.inFlight === 0, 'our run');
    expect((await notifications.getNotification({ threadId: target.threadId, id: 'n1' }))?.status).toBe('delivered');
    expect(work.ran.every(entry => entry.startsWith('ours:'))).toBe(true);
  }, 30_000);

  it("delivers our notification however many of a closed project's notifications are waiting ahead of it", async () => {
    const { notifications, work, ours, target } = await setUp({ withDispatch: true });
    ours.dispatcher.start();
    await ours.dispatcher.tick();
    for (let index = 0; index < 120; index++) {
      await notifications.createNotification(
        dueNotification('closed-project', 'closed-thread', { id: `old-${index}` }),
      );
    }
    await sleep(5);
    await notifications.createNotification(
      dueNotification(target.resourceId, target.threadId, { id: 'mine', priority: 'urgent' }),
    );

    await ours.dispatcher.tick();
    await waitFor(() => work.ran.length > 0 && work.inFlight === 0, 'our run');

    expect((await notifications.getNotification({ threadId: target.threadId, id: 'mine' }))?.status).toBe('delivered');
    const closed = await notifications.listNotifications({ threadId: 'closed-thread' });
    expect(closed.every(record => record.status === 'pending')).toBe(true);
  }, 30_000);

  it('lets exactly one process dispatch a resource that two processes serve', async () => {
    const { rootDir, notifications, work, ours } = await setUp({ withDispatch: true });
    const worktree = createProject('worktree', {
      rootDir,
      resourceId: ours.resourceId,
      notifications,
      work,
      withDispatch: true,
    });
    const key = notificationDispatchLeaseKey(ours.resourceId);
    ours.dispatcher.start();
    await ours.dispatcher.tick();
    worktree.dispatcher.start();
    await worktree.dispatcher.tick();
    expect(await worktree.leases.getLeaseOwner(key)).toBe('ours');

    await ours.dispatcher.stop();
    expect(await worktree.leases.getLeaseOwner(key)).toBeUndefined();
    await worktree.dispatcher.tick();
    expect(await worktree.leases.getLeaseOwner(key)).toBe('worktree');
  }, 30_000);
});

describe('processes in different directories that share one resource', () => {
  /** Two checkouts of one repository: one resource, two projects, two processes. */
  async function setUpCheckouts({ mainOpenThreadId = null }: { mainOpenThreadId?: string | null } = {}) {
    const { rootDir, notifications, work, ours } = await setUp();
    const threadProjects = {
      'main-thread': '/repo/main',
      'feature-thread': '/repo/feature',
      // A third checkout with no process running.
      'closed-thread': '/repo/closed',
      'feature-other': '/repo/feature',
    };
    const shared = { rootDir, resourceId: ours.resourceId, notifications, work, withDispatch: true, threadProjects };
    const main = createProject('main', { ...shared, projectPath: '/repo/main', openThreadId: mainOpenThreadId });
    const feature = createProject('feature', { ...shared, projectPath: '/repo/feature' });
    // `main` starts first, so it is the one holding the resource's dispatch lease.
    main.dispatcher.start();
    await main.dispatcher.tick();
    feature.dispatcher.start();
    await feature.dispatcher.tick();
    expect(await feature.leases.getLeaseOwner(notificationDispatchLeaseKey(ours.resourceId))).toBe('main');
    /** Both processes' own dispatch timers, and each winning a fire of the shared schedule. */
    const round = async () => {
      await Promise.all([main.dispatcher.tick(), feature.dispatcher.tick()]);
      await main.dispatchTick();
      await feature.dispatchTick();
    };
    return { rootDir, notifications, work, main, feature, round };
  }

  it("delivers a thread in its own project's process while another project's process holds the resource", async () => {
    const { notifications, work, main, round } = await setUpCheckouts();
    await notifications.createNotification(dueNotification(main.resourceId, 'feature-thread', { id: 'for-feature' }));

    for (let index = 0; index < 3 && work.ran.length === 0; index++) await round();
    await waitFor(() => work.inFlight === 0, 'runs to settle');

    const record = await notifications.getNotification({ threadId: 'feature-thread', id: 'for-feature' });
    expect(record?.status, "the feature project's notification was never delivered").toBe('delivered');
    expect(work.ran.length).toBeGreaterThan(0);
    expect(work.ran.every(entry => entry.startsWith('feature:'))).toBe(true);

    // The process holding the resource still delivers its own project's threads.
    const before = work.ran.length;
    await notifications.createNotification(dueNotification(main.resourceId, 'main-thread', { id: 'for-main' }));
    await round();
    await waitFor(() => work.ran.length > before && work.inFlight === 0, 'the main run');
    expect((await notifications.getNotification({ threadId: 'main-thread', id: 'for-main' }))?.status).toBe(
      'delivered',
    );
    expect(work.ran.slice(before).every(entry => entry.startsWith('main:'))).toBe(true);
  }, 30_000);

  it("delivers a thread once when one process has it open and its own project's process also runs", async () => {
    // The user opened the feature checkout's thread from the main checkout's process (`/threads`).
    const { notifications, work, main, round } = await setUpCheckouts({ mainOpenThreadId: 'feature-thread' });
    for (let index = 0; index < 3; index++) {
      await notifications.createNotification(
        dueNotification(main.resourceId, 'feature-thread', { id: `for-feature-${index}` }),
      );
      await round();
      await waitFor(() => work.inFlight === 0, 'runs to settle');
    }
    await round();
    await waitFor(() => work.inFlight === 0, 'runs to settle');

    for (let index = 0; index < 3; index++) {
      const record = await notifications.getNotification({ threadId: 'feature-thread', id: `for-feature-${index}` });
      expect(record?.status).toBe('delivered');
    }
    // Every run happened in one process: the two never both deliver the thread.
    expect(new Set(work.ran.map(entry => entry.split(':')[0])).size).toBe(1);
    expect(work.maxInFlight).toBe(1);
  }, 30_000);

  it("keeps delivering a project's other threads while another process has one of them open", async () => {
    const { notifications, work, main, round } = await setUpCheckouts({ mainOpenThreadId: 'feature-thread' });
    await notifications.createNotification(dueNotification(main.resourceId, 'feature-other', { id: 'other' }));
    await notifications.createNotification(dueNotification(main.resourceId, 'feature-thread', { id: 'open' }));

    for (let index = 0; index < 6; index++) {
      await round();
      await waitFor(() => work.inFlight === 0, 'runs to settle');
    }

    expect((await notifications.getNotification({ threadId: 'feature-other', id: 'other' }))?.status).toBe('delivered');
    expect((await notifications.getNotification({ threadId: 'feature-thread', id: 'open' }))?.status).toBe('delivered');
    // The open thread runs in the process that has it open; the project's other thread in its own project's process.
    expect(work.ran.filter(entry => entry.startsWith('main:')).length).toBeGreaterThan(0);
    expect(work.ran.filter(entry => entry.startsWith('feature:')).length).toBeGreaterThan(0);
  }, 30_000);

  it('delivers a thread with no project once, from the process holding the resource', async () => {
    const { notifications, work, main, round } = await setUpCheckouts();
    // A thread with no `projectPath` tag (created before scoping, say): every process's session claims it.
    await notifications.createNotification(dueNotification(main.resourceId, 'unscoped-thread', { id: 'unscoped' }));

    await round();
    await waitFor(() => work.ran.length > 0 && work.inFlight === 0, 'the run');
    await round();
    await waitFor(() => work.inFlight === 0, 'runs to settle');

    expect((await notifications.getNotification({ threadId: 'unscoped-thread', id: 'unscoped' }))?.status).toBe(
      'delivered',
    );
    expect(work.ran.every(entry => entry.startsWith('main:'))).toBe(true);
    expect(work.maxInFlight).toBe(1);
  }, 30_000);

  it("delivers a thread however many of a closed checkout's notifications are waiting ahead of it", async () => {
    const { notifications, work, main, round } = await setUpCheckouts();
    for (let index = 0; index < 120; index++) {
      await notifications.createNotification(dueNotification(main.resourceId, 'closed-thread', { id: `old-${index}` }));
    }
    await sleep(5);
    await notifications.createNotification(
      dueNotification(main.resourceId, 'feature-thread', { id: 'for-feature', priority: 'urgent' }),
    );

    await round();
    await waitFor(() => work.ran.length > 0 && work.inFlight === 0, 'the feature run');

    expect((await notifications.getNotification({ threadId: 'feature-thread', id: 'for-feature' }))?.status).toBe(
      'delivered',
    );
    expect(work.ran.every(entry => entry.startsWith('feature:'))).toBe(true);
    // No process runs in the closed checkout, so its notifications wait for one, without counting attempts.
    const closed = await notifications.listNotifications({ threadId: 'closed-thread' });
    expect(closed).toHaveLength(120);
    expect(closed.every(record => record.status === 'pending' && (record.deliveryAttempts ?? 0) === 0)).toBe(true);
  }, 30_000);

  it('lets one of two processes in the same project deliver its thread', async () => {
    const { rootDir, notifications, work, main, feature, round } = await setUpCheckouts();
    const featureAgain = createProject('feature-2', {
      rootDir,
      resourceId: main.resourceId,
      notifications,
      work,
      withDispatch: true,
      projectPath: '/repo/feature',
      threadProjects: { 'feature-thread': '/repo/feature' },
    });
    featureAgain.dispatcher.start();
    await notifications.createNotification(dueNotification(main.resourceId, 'feature-thread', { id: 'for-feature' }));

    await Promise.all([round(), featureAgain.dispatcher.tick()]);
    await waitFor(() => work.ran.length > 0 && work.inFlight === 0, 'the run');
    await Promise.all([round(), featureAgain.dispatcher.tick()]);
    await waitFor(() => work.inFlight === 0, 'runs to settle');

    expect((await notifications.getNotification({ threadId: 'feature-thread', id: 'for-feature' }))?.status).toBe(
      'delivered',
    );
    // One run (model, tool, model), in the process holding the project's dispatch lease.
    expect(work.ran).toEqual(['feature:model', 'feature:tool', 'feature:model']);
    expect(work.maxInFlight).toBe(1);
    // `feature` holds the project's dispatch lease: it claimed it before `feature-2` started.
    expect(
      await feature.leases.getLeaseOwner(
        notificationDispatchLeaseKey(main.resourceId, threadScopeKey({ projectPath: '/repo/feature' })),
      ),
    ).toBe('feature');
  }, 30_000);

  it('hands a dispatch lease to another process once no session here needs it', async () => {
    const { rootDir, notifications, work, main, feature } = await setUpCheckouts();
    const featureAgain = createProject('feature-2', {
      rootDir,
      resourceId: main.resourceId,
      notifications,
      work,
      withDispatch: true,
      projectPath: '/repo/feature',
    });
    featureAgain.dispatcher.start();
    await featureAgain.dispatcher.tick();
    const resourceKey = notificationDispatchLeaseKey(main.resourceId);
    const featureKey = notificationDispatchLeaseKey(main.resourceId, threadScopeKey({ projectPath: '/repo/feature' }));
    expect(await feature.leases.getLeaseOwner(featureKey)).toBe('feature');
    expect(await feature.leases.getLeaseOwner(resourceKey)).toBe('main');

    // The feature session closes; its process keeps running, and releases the project's lease on its next tick.
    feature.closeSession();
    await feature.dispatcher.tick();
    expect(await feature.leases.getLeaseOwner(featureKey)).toBeUndefined();
    await featureAgain.dispatcher.tick();
    expect(await feature.leases.getLeaseOwner(featureKey)).toBe('feature-2');

    // Likewise the resource's own lease, once the main session closes.
    main.closeSession();
    await main.dispatcher.tick();
    expect(await main.leases.getLeaseOwner(resourceKey)).toBeUndefined();
    await featureAgain.dispatcher.tick();
    expect(await main.leases.getLeaseOwner(resourceKey)).toBe('feature-2');
  }, 30_000);
});
