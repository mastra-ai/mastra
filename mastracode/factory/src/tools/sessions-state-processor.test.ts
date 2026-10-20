import { InMemoryNotificationsStorage } from '@mastra/core/notifications';
import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it } from 'vitest';

import { createBoardRegistry } from '../boards/index.js';
import { createSourceControlSessionLookup } from '../session/factory-session.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { FACTORY_SESSIONS_MAX_AGE_MS, FactorySessionsStateProcessor } from './sessions-state-processor.js';

const DAY = FACTORY_SESSIONS_MAX_AGE_MS;

async function setup() {
  const seed = await createFactoryStorageForTests();
  const sourceControl = seed.sourceControl.forIntegration('github');
  const project = await seed.projects.create({ orgId: 'org-1', userId: 'owner', input: { name: 'Mastra' } });
  const installation = await sourceControl.installations.upsert({
    orgId: 'org-1',
    connectedByUserId: 'owner',
    externalId: '1',
  });
  const repository = await sourceControl.repositories.upsert({
    orgId: 'org-1',
    input: { installationId: installation.id, externalId: '2', slug: 'mastra-ai/mastra', defaultBranch: 'main' },
  });
  const connection = await sourceControl.connections.create({
    orgId: 'org-1',
    factoryProjectId: project.id,
    installationId: installation.id,
    createdByUserId: 'owner',
  });
  const projectRepository = await sourceControl.projectRepositories.link({
    orgId: 'org-1',
    connectionId: connection.id,
    repositoryId: repository.id,
    createdByUserId: 'owner',
    sandboxProvider: 'local',
    sandboxWorkdir: '/sandbox/mastra',
  });
  const createSession = (
    sessionId: string,
    extra: { title?: string; origin?: { sessionId: string; threadId: string }; userId?: string } = {},
  ) =>
    sourceControl.sessions.create({
      sessionId,
      projectRepositoryId: projectRepository.id,
      factoryProjectId: project.id,
      orgId: 'org-1',
      userId: extra.userId ?? 'user-1',
      branch: `user/session-${sessionId}`,
      baseBranch: 'main',
      ...(extra.title ? { title: extra.title } : {}),
      ...(extra.origin ? { origin: extra.origin } : {}),
    });
  await createSession('parent');

  const notifications = new InMemoryNotificationsStorage();
  const running = new Set<string>();
  const threadMoved = new Map<string, number>();
  let now = Date.now();
  const processor = new FactorySessionsStateProcessor({
    authEnabled: true,
    sessions: createSourceControlSessionLookup([sourceControl]),
    projects: seed.projects,
    workItems: seed.workItems,
    boards: createBoardRegistry(),
    isRunning: async sessionId => running.has(sessionId),
    lastActivity: async threadId => (threadMoved.has(threadId) ? new Date(threadMoved.get(threadId)!) : null),
    notifications: async () => notifications,
    now: () => now,
  });

  const fileItem = async (number: number, stages = ['execute']) =>
    (
      await seed.workItems.upsert({
        orgId: 'org-1',
        userId: 'someone',
        factoryProjectId: project.id,
        input: { title: `Item ${number}`, stages, metadata: { number } },
      })
    ).item;
  const follow = (workItemId: string, sessionId = 'parent', threadId = 'parent-thread') =>
    seed.workItems.subscribeToWorkItem({
      orgId: 'org-1',
      factoryProjectId: project.id,
      workItemId,
      sessionId,
      threadId,
      resourceId: sessionId,
      userId: 'user-1',
      reason: 'subscribed',
    });
  const bind = (workItemId: string, sessionId: string) =>
    seed.workItems.prepareRunStart({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      workItem: { id: workItemId, input: { title: 'x', stages: ['execute'] } },
      role: 'work',
      session: { sessionId, branch: `factory/${sessionId}`, threadId: `${sessionId}-thread` },
      resourceId: sessionId,
      kickoffKey: `kickoff-${sessionId}`,
      kickoffMessage: null,
    });
  const reportFrom = (fromSession: string, kind: string, attributes: Record<string, string> = {}) =>
    notifications.createNotification({
      source: 'factory-session',
      kind,
      priority: 'high',
      summary: kind,
      threadId: 'parent-thread',
      resourceId: 'parent',
      sourceId: fromSession,
      attributes: { ...attributes, 'from-session': fromSession },
    });

  const context = (sessionId = 'parent', threadId = 'parent-thread') => {
    const requestContext = new RequestContext();
    requestContext.set('user', { workosId: 'user-1', organizationId: 'org-1' });
    requestContext.set('controller', { resourceId: sessionId, threadId });
    return requestContext;
  };
  type Signal = Awaited<ReturnType<FactorySessionsStateProcessor['computeStateSignal']>>;
  let last: Signal;
  /** One model step; `fresh` drops the prior snapshot, like a new context window. */
  const step = async (options: { sessionId?: string; threadId?: string; fresh?: boolean } = {}) => {
    const base = !options.fresh && last ? last : undefined;
    const signal = await processor.computeStateSignal({
      requestContext: context(options.sessionId, options.threadId),
      threadId: options.threadId ?? 'parent-thread',
      resourceId: options.sessionId ?? 'parent',
      activeStateSignals: [],
      contextWindow: { hasSnapshot: Boolean(base) },
      deltasSinceSnapshot: [],
      ...(base ? { lastSnapshot: { metadata: { state: { cacheKey: base.cacheKey } } } } : {}),
    } as never);
    if (signal) last = signal;
    return signal;
  };

  return {
    seed,
    sourceControl,
    project,
    createSession,
    fileItem,
    follow,
    bind,
    reportFrom,
    running,
    threadMoved,
    now: () => now,
    step,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe('FactorySessionsStateProcessor', () => {
  it('is silent with nothing to show', async () => {
    const env = await setup();
    await expect(env.step()).resolves.toBeUndefined();
  });

  it('shows side sessions and followed items with their stage, worker and last report', async () => {
    const env = await setup();
    await env.createSession('side-1', {
      title: 'Profile the build',
      origin: { sessionId: 'parent', threadId: 'parent-thread' },
    });
    env.running.add('side-1');
    const item = await env.fileItem(7);
    await env.follow(item.id);
    await env.bind(item.id, 'worker-7');
    await env.reportFrom('worker-7', 'progress', { 'work-item': '#7' });

    const signal = await env.step();

    expect(signal).toMatchObject({
      id: 'factory-sessions',
      mode: 'snapshot',
      tagName: 'factory-sessions',
      attributes: { sideSessions: 1, following: 1 },
    });
    expect(signal!.cacheKey).toMatch(/^sessions:/);
    expect(signal!.contents).toContain('- "Profile the build" (session side-1): running');
    expect(signal!.contents).toMatch(
      /- #7 "Item 7": execute; work session worker-7 idle; last report progress at \d{4}-/,
    );
  });

  it("shows whether a followed item's session is running, idle or waiting", async () => {
    const env = await setup();
    const item = await env.fileItem(7);
    await env.follow(item.id);
    await env.bind(item.id, 'worker-7');

    env.running.add('worker-7');
    expect((await env.step())!.contents).toContain('work session worker-7 running');
    env.running.delete('worker-7');
    expect((await env.step())!.contents).toContain('work session worker-7 idle');
    await env.reportFrom('worker-7', 'blocked', { 'work-item': '#7' });
    expect((await env.step())!.contents).toContain('work session worker-7 parked; last report blocked');
  });

  it('marks a running worker whose thread stopped moving as quiet, so stuck stands out from busy (#27742)', async () => {
    const env = await setup();
    const item = await env.fileItem(7);
    await env.follow(item.id);
    await env.bind(item.id, 'worker-7');
    env.running.add('worker-7');

    env.threadMoved.set('worker-7-thread', env.now() - 60_000);
    const busy = (await env.step())!.contents;
    expect(busy).toContain('work session worker-7 running');
    expect(busy).not.toContain('quiet since');

    const stoppedAt = env.now();
    env.threadMoved.set('worker-7-thread', stoppedAt);
    env.advance(35 * 60_000);
    expect((await env.step())!.contents).toContain(
      `work session worker-7 running but quiet since ${new Date(stoppedAt).toISOString()}`,
    );
    // Still quiet on the next step: the snapshot does not change, so nothing is re-sent.
    await expect(env.step()).resolves.toBeUndefined();
  });

  it('shows parked for a side session whose last report was blocked', async () => {
    const env = await setup();
    await env.createSession('side-1', { origin: { sessionId: 'parent', threadId: 'parent-thread' } });
    await env.reportFrom('side-1', 'blocked');
    expect((await env.step())!.contents).toContain('(session side-1): parked; last report blocked');
  });

  it('marks a side session muted until it is resubscribed, and re-emits on each change', async () => {
    const env = await setup();
    await env.createSession('side-1', { origin: { sessionId: 'parent', threadId: 'parent-thread' } });
    env.running.add('side-1');
    expect((await env.step())!.contents).toContain('(session side-1): running\n');

    await env.sourceControl.sessions.setOriginMuted({ sessionId: 'side-1', muted: true });
    expect((await env.step())!.contents).toContain('(session side-1): running (muted)');

    await env.sourceControl.sessions.setOriginMuted({ sessionId: 'side-1', muted: false });
    const unmuted = await env.step();
    expect(unmuted!.contents).toContain('(session side-1): running');
    expect(unmuted!.contents).not.toContain('(muted)');
  });

  it('skips while the state is unchanged and emits again when a report arrives or a stage changes', async () => {
    const env = await setup();
    const item = await env.fileItem(7);
    await env.follow(item.id);

    const first = await env.step();
    expect(first).toBeDefined();
    await expect(env.step()).resolves.toBeUndefined();

    await env.reportFrom('worker-7', 'done', { 'work-item': '#7' });
    const afterReport = await env.step();
    expect(afterReport!.cacheKey).not.toBe(first!.cacheKey);
    expect(afterReport!.contents).toContain('last report done');
    await expect(env.step()).resolves.toBeUndefined();

    await env.seed.workItems.update({ orgId: 'org-1', id: item.id, userId: 'user-1', patch: { stages: ['review'] } });
    const afterStage = await env.step();
    expect(afterStage!.contents).toContain('#7 "Item 7": review');
  });

  it('emits again in a fresh context window even when nothing changed', async () => {
    const env = await setup();
    const item = await env.fileItem(7);
    await env.follow(item.id);
    const first = await env.step();
    await expect(env.step({ fresh: true })).resolves.toMatchObject({ cacheKey: first!.cacheKey });
  });

  it('sends one final empty snapshot when the last entry goes, then stays silent', async () => {
    const env = await setup();
    const item = await env.fileItem(7);
    await env.follow(item.id);
    await env.step();
    await env.seed.workItems.unsubscribeFromWorkItem({
      orgId: 'org-1',
      factoryProjectId: env.project.id,
      workItemId: item.id,
      sessionId: 'parent',
    });

    await expect(env.step()).resolves.toMatchObject({
      cacheKey: 'empty',
      contents: 'No sub-sessions or followed work items.',
      attributes: { entries: 0 },
    });
    await expect(env.step()).resolves.toBeUndefined();
    await expect(env.step()).resolves.toBeUndefined();
  });

  it('caps the rows at 20, active first, with "+N more"', async () => {
    const env = await setup();
    for (let n = 1; n <= 22; n += 1) {
      const item = await env.fileItem(n);
      await env.follow(item.id);
    }
    await env.createSession('side-1', { origin: { sessionId: 'parent', threadId: 'parent-thread' } });
    env.running.add('side-1');

    const signal = await env.step();
    const rows = signal!.contents.split('\n').filter(line => line.startsWith('- '));
    expect(rows).toHaveLength(20);
    expect(rows[0]).toContain('(session side-1): running');
    expect(signal!.contents).toContain('+3 more');
  });

  it('drops a side session idle for over 24h and an item finished over 24h ago', async () => {
    const env = await setup();
    await env.createSession('side-1', { origin: { sessionId: 'parent', threadId: 'parent-thread' } });
    await env.createSession('side-2', { origin: { sessionId: 'parent', threadId: 'parent-thread' } });
    env.running.add('side-2');
    const done = await env.fileItem(1, ['done']);
    const open = await env.fileItem(2, ['execute']);
    await env.follow(done.id);
    await env.follow(open.id);

    const before = await env.step();
    expect(before!.contents).toContain('side-1');
    expect(before!.contents).toContain('#1');

    env.advance(DAY + 1000);
    const after = await env.step();
    expect(after!.contents).not.toContain('side-1');
    expect(after!.contents).toContain('(session side-2): running');
    expect(after!.contents).not.toContain('#1 ');
    expect(after!.contents).toContain('#2 "Item 2": execute');
  });

  it('does not show sessions the user only messaged', async () => {
    const env = await setup();
    await env.createSession('stranger');
    const item = await env.fileItem(9);
    await env.bind(item.id, 'stranger-worker');
    await env.reportFrom('stranger', 'reply');
    await env.reportFrom('stranger-worker', 'reply', { 'work-item': '#9' });

    await expect(env.step()).resolves.toBeUndefined();
  });

  it('tells a side session who started it', async () => {
    const env = await setup();
    await env.createSession('side-1', { origin: { sessionId: 'parent', threadId: 'parent-thread' } });
    const signal = await env.step({ sessionId: 'side-1', threadId: 'side-1' });
    expect(signal!.contents).toBe(
      'Started by session parent (thread parent-thread). Report back with factory_message_origin. On long work, send a progress report after each plan step.',
    );
    await expect(env.step({ sessionId: 'side-1', threadId: 'side-1' })).resolves.toBeUndefined();
  });

  it('shows a worker nothing when nobody follows its item', async () => {
    const env = await setup();
    await env.createSession('worker-7');
    const item = await env.fileItem(7);
    await env.bind(item.id, 'worker-7');
    await expect(env.step({ sessionId: 'worker-7', threadId: 'worker-7-thread' })).resolves.toBeUndefined();
  });

  it('tells an item worker which item and role it works on and who follows it', async () => {
    const env = await setup();
    await env.createSession('worker-7');
    const item = await env.fileItem(7);
    await env.bind(item.id, 'worker-7');
    await env.follow(item.id);
    await env.follow(item.id, 'other', 'other-thread');
    const signal = await env.step({ sessionId: 'worker-7', threadId: 'worker-7-thread' });
    expect(signal!.contents).toBe(
      'Working on #7 as work. Reports go to 2 following sessions. On long work, send a progress report after each plan step.',
    );
  });

  it('clears the worker line once when its last follower leaves', async () => {
    const env = await setup();
    await env.createSession('worker-7');
    const item = await env.fileItem(7);
    await env.bind(item.id, 'worker-7');
    await env.follow(item.id);
    const worker = { sessionId: 'worker-7', threadId: 'worker-7-thread' };
    expect((await env.step(worker))!.contents).toContain('Reports go to 1 following session.');
    await env.seed.workItems.unsubscribeFromWorkItem({
      orgId: 'org-1',
      factoryProjectId: env.project.id,
      workItemId: item.id,
      sessionId: 'parent',
    });
    await expect(env.step(worker)).resolves.toMatchObject({
      cacheKey: 'empty',
      contents: 'This session is not reporting on any work now.',
    });
    await expect(env.step(worker)).resolves.toBeUndefined();
  });
});
