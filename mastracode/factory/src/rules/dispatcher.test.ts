import { describe, expect, it, vi } from 'vitest';

import { AutomationFailedAttentionProvider } from '../routes/attention-providers.js';
import { FactoryFeedReader } from '../storage/domains/comments/feed-context.js';
import { FACTORY_RULE_MATERIALIZATION_KEY, type WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { builtInFactoryRules, defaultFactoryRules } from './defaults.js';
import { FACTORY_DISPATCH_CONSTANTS, FactoryDecisionDispatcher } from './dispatcher.js';
import { FactoryStartCoordinator } from './start-coordinator.js';
import { FactoryTransitionService } from './transition-service.js';
import type { FactoryCommitDecision } from './types.js';

const PROJECT_ID = '11111111-2222-4333-8444-555555555555';

async function createItem(storage: WorkItemsStorage, sourceKey = 'github-issue:1') {
  return (
    await storage.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      input: {
        externalSource: { integrationId: 'github', type: 'issue', externalId: sourceKey },
        title: 'Fix issue',
        stages: ['intake'],
        sessions: {},
        metadata: { authorTrusted: true },
      },
    })
  ).item;
}

function createSession(
  accepted?: Promise<unknown>,
  options?: {
    signalAccepted?: Promise<{ accepted: true; action?: string }>;
    emitAgentEndDuringSignal?: boolean;
    agentEndReason?: 'complete' | 'aborted' | 'error' | 'suspended';
    /** Models a signal queued onto an in-flight run that ends before draining it. */
    dropDeliveredSignal?: boolean;
    /** The run that swallowed the dropped signal ends, freeing the session. */
    endRunAfterDroppedSignal?: boolean;
    /** Once the session is free, a redelivered signal wakes it and lands. */
    acceptRedeliveredSignal?: boolean;
    initialDeliveredSignalIds?: string[];
    /**
     * Per-call notification outcomes. `deliver` models a kickoff queued onto a
     * run already in flight; `endRun: true` ends that run afterwards, freeing
     * the session for a redelivery. Exhausted entries fall back to the default
     * wake response.
     */
    notificationResponses?: Array<{ action: 'deliver'; endRun?: boolean } | { action: 'wake' }>;
    /**
     * The kicked-off run suspends on `submit_plan`. Like core, the suspension
     * ends the run (`agent_end: 'suspended'`); answering it resumes a run that
     * then finishes.
     */
    suspendsOnPlan?: boolean;
    /** The kicked-off run suspends on this tool instead of a plan (e.g. `ask_user`). */
    suspendsOnTool?: string;
    /** The resumed run writes another plan, so an uncapped gate would never end. */
    replansAfterApproval?: boolean;
  },
) {
  let threadId = 'thread-1';
  const agentEndListeners = new Set<(event: { type: string; reason?: string }) => void>();
  const emitAgentEnd = (reason = options?.agentEndReason) => {
    for (const listener of agentEndListeners) {
      listener({ type: 'agent_end', reason });
    }
  };
  const emitSuspension = (toolName: string, toolCallId: string) => {
    for (const listener of agentEndListeners) {
      listener({ type: 'tool_suspended', toolName, toolCallId });
    }
    emitAgentEnd('suspended');
  };
  const emitPlanSuspension = () => emitSuspension('submit_plan', 'call-plan');
  const emitScriptedSuspension = () => {
    if (options?.suspendsOnTool) {
      emitSuspension(options.suspendsOnTool, 'call-tool');
      return true;
    }
    if (options?.suspendsOnPlan) {
      emitPlanSuspension();
      return true;
    }
    return false;
  };
  // A consumed wake stream means the woken run ran to its end, so the real
  // session emits agent_end by then; the dispatcher now waits to observe it.
  const consumeStream = vi.fn(async () => {
    if (emitScriptedSuspension()) return;
    emitAgentEnd(options?.agentEndReason ?? 'complete');
  });
  const notificationAccepted = accepted ?? Promise.resolve({ action: 'wake', output: { consumeStream } });
  let signalSends = 0;
  const deliveredKeys = new Set<string>();
  const deliveredSignals = new Set(options?.initialDeliveredSignalIds ?? []);
  const delivered: string[] = [];
  let notificationSends = 0;
  const sendNotificationSignal = vi.fn(
    async (input: { dedupeKey?: string }, _options?: { requestContext?: { get(key: string): unknown } }) => {
      if (input.dedupeKey && !deliveredKeys.has(input.dedupeKey)) {
        deliveredKeys.add(input.dedupeKey);
        delivered.push(input.dedupeKey);
      }
      const scripted = options?.notificationResponses?.[notificationSends];
      notificationSends += 1;
      if (scripted?.action === 'deliver') {
        if (scripted.endRun) {
          // The busy run finishes without acting on the queued kickoff, which
          // is the moment the session becomes free to take it again.
          queueMicrotask(() => emitAgentEnd('complete'));
        }
        return { persisted: Promise.resolve(), accepted: Promise.resolve({ action: 'deliver' }) };
      }
      if (scripted?.action === 'wake') {
        return {
          persisted: Promise.resolve(),
          accepted: Promise.resolve({ action: 'wake', output: { consumeStream } }),
        };
      }
      return { persisted: Promise.resolve(), accepted: notificationAccepted };
    },
  );
  const abort = vi.fn(() => {});
  const session = {
    thread: {
      list: vi.fn(async () => []),
      create: vi.fn(async () => ({ id: threadId })),
      switch: vi.fn(async ({ threadId: next }: { threadId: string }) => {
        threadId = next;
      }),
      setSetting: vi.fn(async () => {}),
      rename: vi.fn(async () => {}),
      requireId: vi.fn(() => threadId),
      listActiveMessages: vi.fn(async () => [...deliveredSignals].map(id => ({ id }))),
    },
    abort,
    getWorkspace: () => ({
      skills: {
        maybeRefresh: vi.fn(async () => {}),
        get: vi.fn(async (name: string) => ({ name, instructions: 'Follow the skill.' })),
      },
    }),
    state: { set: vi.fn(async () => {}) },
    permissions: { setForTool: vi.fn(async () => {}) },
    sendMessage: vi.fn(async () => {}),
    sendSignal: vi.fn((input: { id: string }, _options: { requestContext: { get(key: string): unknown } }) => {
      signalSends += 1;
      // The first send is the one queued onto the busy run; anything after it is
      // a redelivery into a session the dispatcher waited for.
      const redelivered = signalSends > 1 && options?.acceptRedeliveredSignal === true;
      if (!options?.dropDeliveredSignal || redelivered) deliveredSignals.add(input.id);
      if (options?.suspendsOnPlan || options?.suspendsOnTool) {
        queueMicrotask(() => void emitScriptedSuspension());
      } else if (options?.emitAgentEndDuringSignal || redelivered) {
        emitAgentEnd(redelivered ? 'complete' : undefined);
      } else if (options?.endRunAfterDroppedSignal) {
        // The busy run finishes without ever answering the queued prompt, which
        // is the moment the session becomes free to take it again.
        queueMicrotask(() => emitAgentEnd('complete'));
      } else if (!options?.signalAccepted && !options?.dropDeliveredSignal) {
        // Default landed-deliver path: the in-flight run drains the prompt and
        // finishes, which is what the dispatcher now waits to observe.
        queueMicrotask(() => emitAgentEnd(options?.agentEndReason ?? 'complete'));
      }
      if (redelivered) return { accepted: Promise.resolve({ accepted: true as const, action: 'wake' }) };
      return { accepted: options?.signalAccepted ?? Promise.resolve({ accepted: true, action: 'deliver' }) };
    }),
    subscribe: vi.fn((listener: (event: { type: string; reason?: string }) => void) => {
      agentEndListeners.add(listener);
      return () => agentEndListeners.delete(listener);
    }),
    respondToToolSuspension: vi.fn(async () => {
      // Answering a suspension resumes the run over the wire, so it settles well
      // after the suspension's own `agent_end` has already been dispatched.
      await new Promise(resolve => setTimeout(resolve, 0));
      if (options?.replansAfterApproval) {
        emitPlanSuspension();
        return;
      }
      emitAgentEnd('complete');
    }),
    sendNotificationSignal,
  };
  const controller = {
    createSession: vi.fn(async () => session),
    getSessionByResource: vi.fn(async (): Promise<typeof session | undefined> => session),
  };
  return {
    controller,
    session,
    delivered,
    sendNotificationSignal,
    consumeStream,
    emitAgentEnd,
    abort,
    getAgentEndListenerCount: () => agentEndListeners.size,
  };
}

async function queueDecision(
  storage: WorkItemsStorage,
  decision: FactoryCommitDecision,
  options?: { sourceKey?: string; ingress?: string },
) {
  const item = await createItem(storage, options?.sourceKey);
  const rules = defaultFactoryRules({
    version: 'rules-v1',
    overrides: { work: { execute: { issue: { onEnter: () => decision } } } },
  });
  const transitionService = new FactoryTransitionService({ storage, rules });
  const result = await transitionService.transition({
    orgId: 'org-1',
    factoryProjectId: PROJECT_ID,
    workItemId: item.id,
    board: 'work',
    stage: 'execute',
    expectedRevision: item.revision,
    actor: { type: 'system', id: 'factory-rule-dispatcher' },
    ingress: { type: 'rule', identity: options?.ingress ?? 'move-1' },
    cause: 'rule_decision',
  });
  expect(result.status).toBe('accepted');
  return { item, transitionService };
}

/** Give a card the live `work` session an `invokeSkill` effect kicks off into. */
async function bindWorkRun(storage: WorkItemsStorage, workItemId: string, options?: { preapprovePlans?: boolean }) {
  const prepared = await storage.prepareRunStart({
    preapprovePlans: options?.preapprovePlans,
    orgId: 'org-1',
    userId: 'user-1',
    factoryProjectId: PROJECT_ID,
    workItem: {
      id: workItemId,
      input: {
        externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:1' },
        title: 'Fix issue',
        stages: ['execute'],
        sessions: {},
        metadata: {},
      },
    },
    role: 'work',
    session: { sessionId: 'session-1', branch: 'factory/issue-1', threadId: 'thread-1' },
    resourceId: PROJECT_ID,
    kickoffKey: `kickoff-${workItemId}`,
    kickoffMessage: null,
  });
  await storage.markPendingStart(prepared.binding.id, 'sent');
}

/** A card whose run someone asked for: a pending start still waiting to be sent. */
async function queueRunKickoff(storage: WorkItemsStorage, options?: { preapprovePlans?: boolean }) {
  const item = await createItem(storage);
  await storage.prepareRunStart({
    preapprovePlans: options?.preapprovePlans,
    orgId: 'org-1',
    userId: 'user-1',
    factoryProjectId: PROJECT_ID,
    workItem: {
      id: item.id,
      input: {
        externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:1' },
        title: 'Fix issue',
        stages: ['execute'],
        sessions: {},
        metadata: {},
      },
    },
    role: 'work',
    session: { sessionId: 'session-1', branch: 'factory/issue-1', threadId: 'thread-1' },
    resourceId: PROJECT_ID,
    kickoffKey: `kickoff-${item.id}`,
    kickoffMessage: 'Start work on this issue.',
  });
  return {
    item,
    transitionService: new FactoryTransitionService({
      rules: defaultFactoryRules({ version: 'rules-v1' }),
      storage,
    }),
  };
}

describe('FactoryDecisionDispatcher', () => {
  it('reconciles persisted tool results before claiming each dispatch batch', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const reconcileToolResults = vi.fn(async () => {});
    const { controller } = createSession();
    const transitionService = new FactoryTransitionService({
      rules: defaultFactoryRules({ version: 'rules-v1' }),
      storage,
    });
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      isAutoRunEnabled: async () => true,
      transitionService,
      storage,
      reconcileToolResults,
    });

    await dispatcher.runOnce();

    expect(reconcileToolResults).toHaveBeenCalledTimes(1);
  });

  it('throttles the reconcile walk, coalesces overlapping runs, and never blocks claiming', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const claims = vi.spyOn(storage, 'claimPendingStarts');
    let release!: () => void;
    const reconcileToolResults = vi.fn(
      () =>
        new Promise<void>(resolve => {
          release = resolve;
        }),
    );
    const { controller } = createSession();
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      isAutoRunEnabled: async () => true,
      transitionService: new FactoryTransitionService({ rules: defaultFactoryRules({ version: 'rules-v1' }), storage }),
      storage,
      reconcileToolResults,
      reconcileIntervalMs: 30_000,
    });

    const t0 = new Date('2030-01-01T00:00:00Z');
    // The first tick fires the reconcile without awaiting it; claiming proceeds.
    await dispatcher.runOnce(t0);
    expect(reconcileToolResults).toHaveBeenCalledTimes(1);
    expect(claims).toHaveBeenCalledTimes(1);

    // Within the interval: no new reconcile. After the interval but with the
    // first run still in flight: coalesced, still no new reconcile.
    await dispatcher.runOnce(new Date(t0.getTime() + 1_000));
    await dispatcher.runOnce(new Date(t0.getTime() + 31_000));
    expect(reconcileToolResults).toHaveBeenCalledTimes(1);
    expect(claims).toHaveBeenCalledTimes(3);

    // Once the previous run resolves and the interval elapses, it runs again.
    release();
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    await dispatcher.runOnce(new Date(t0.getTime() + 62_000));
    expect(reconcileToolResults).toHaveBeenCalledTimes(2);
    release();
    await dispatcher.stop();
  });

  it('sweeps stale bindings on a slow cadence instead of every tick', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const sweep = vi.spyOn(storage, 'revokeStaleRunBindings');
    const { controller } = createSession();
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      isAutoRunEnabled: async () => true,
      transitionService: new FactoryTransitionService({ rules: defaultFactoryRules({ version: 'rules-v1' }), storage }),
      storage,
      staleBindingSweepIntervalMs: 10 * 60_000,
      staleBindingTtlMs: 24 * 60 * 60_000,
    });

    const t0 = new Date('2030-01-01T00:00:00Z');
    // The first tick only anchors the cadence; ticks within the interval never sweep.
    await dispatcher.runOnce(t0);
    await dispatcher.runOnce(new Date(t0.getTime() + 1_000));
    await dispatcher.runOnce(new Date(t0.getTime() + 9 * 60_000));
    expect(sweep).not.toHaveBeenCalled();

    // Once the cadence elapses, the sweep runs with the configured TTL cutoff.
    const t1 = new Date(t0.getTime() + 11 * 60_000);
    await dispatcher.runOnce(t1);
    expect(sweep).toHaveBeenCalledExactlyOnceWith({
      olderThan: new Date(t1.getTime() - 24 * 60 * 60_000),
      now: t1,
    });

    // And the cadence resets: the next sweep waits another full interval.
    await dispatcher.runOnce(new Date(t1.getTime() + 1_000));
    expect(sweep).toHaveBeenCalledTimes(1);
    await dispatcher.runOnce(new Date(t1.getTime() + 11 * 60_000));
    expect(sweep).toHaveBeenCalledTimes(2);
  });

  it('keeps claiming dispatches when the stale-binding sweep fails', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const sweep = vi.spyOn(storage, 'revokeStaleRunBindings').mockRejectedValue(new Error('sweep boom'));
    const reconcileToolResults = vi.fn(async () => {});
    const { controller } = createSession();
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      isAutoRunEnabled: async () => true,
      transitionService: new FactoryTransitionService({ rules: defaultFactoryRules({ version: 'rules-v1' }), storage }),
      storage,
      reconcileToolResults,
    });

    const t0 = new Date('2030-01-01T00:00:00Z');
    await dispatcher.runOnce(t0);
    await expect(dispatcher.runOnce(new Date(t0.getTime() + 11 * 60_000))).resolves.toBeUndefined();
    expect(sweep).toHaveBeenCalledTimes(1);
    expect(reconcileToolResults).toHaveBeenCalledTimes(2);
  });

  it('allows only one concurrent lease owner to claim a decision', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    await queueDecision(storage, {
      type: 'sendMessage',
      role: 'work',
      message: 'Review completion.',
      idempotencyKey: 'message-1',
    });
    const now = new Date('2030-01-01T00:00:00Z');

    const [left, right] = await Promise.all([
      storage.claimDeferredDecisions({
        ownerId: 'left',
        now,
        leaseExpiresAt: new Date(now.getTime() + 30_000),
        limit: 1,
      }),
      storage.claimDeferredDecisions({
        ownerId: 'right',
        now,
        leaseExpiresAt: new Date(now.getTime() + 30_000),
        limit: 1,
      }),
    ]);

    expect(left.length + right.length).toBe(1);
  });

  it('claims a pending decision even when many older terminal rows exist', async () => {
    const seed = await createFactoryStorageForTests();
    const storage = seed.workItems;
    // Terminal rows accumulate forever; they must be excluded from the bounded
    // candidate window instead of crowding out the claimable row.
    const base = new Date('2029-01-01T00:00:00Z');
    for (let i = 0; i < 60; i++) {
      await seed.storage.ops.insertOne('factory_deferred_decisions', {
        org_id: 'org-1',
        factory_project_id: PROJECT_ID,
        evaluation_id: `eval-${i}`,
        idempotency_key: `done-${i}`,
        effect_ordinal: 0,
        effect_hash: `hash-${i}`,
        causal_chain: [],
        decision: { type: 'sendMessage', role: 'work', message: 'done', idempotencyKey: `done-${i}` },
        status: 'succeeded',
        attempts: 1,
        available_at: base,
        completed_at: base,
        created_at: new Date(base.getTime() + i),
        updated_at: base,
      });
    }
    await queueDecision(storage, {
      type: 'sendMessage',
      role: 'work',
      message: 'Review completion.',
      idempotencyKey: 'message-1',
    });
    const now = new Date('2030-01-01T00:00:00Z');

    const claimed = await storage.claimDeferredDecisions({
      ownerId: 'owner',
      now,
      leaseExpiresAt: new Date(now.getTime() + 30_000),
      limit: 1,
    });

    expect(claimed).toHaveLength(1);
    expect(claimed[0]!.idempotencyKey).toBe('message-1');
  });

  it('recovers an expired lease and fences the stale owner', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    await queueDecision(storage, {
      type: 'sendMessage',
      role: 'work',
      message: 'Review completion.',
      idempotencyKey: 'message-1',
    });
    const firstNow = new Date('2030-01-01T00:00:00Z');
    const [first] = await storage.claimDeferredDecisions({
      ownerId: 'first',
      now: firstNow,
      leaseExpiresAt: new Date(firstNow.getTime() + 1_000),
      limit: 1,
    });
    const secondNow = new Date(firstNow.getTime() + 2_000);
    const [recovered] = await storage.claimDeferredDecisions({
      ownerId: 'second',
      now: secondNow,
      leaseExpiresAt: new Date(secondNow.getTime() + 1_000),
      limit: 1,
    });

    expect(recovered).toMatchObject({ id: first!.id, attempts: 2, leaseOwner: 'second' });
    await expect(
      storage.completeDeferredDecision(
        { id: first!.id, orgId: 'org-1', factoryProjectId: PROJECT_ID, ownerId: 'first' },
        secondNow,
      ),
    ).resolves.toBeNull();
  });

  it('advances the delivery generation when a deferred decision is retried', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    await queueDecision(storage, {
      type: 'sendMessage',
      role: 'work',
      message: 'Review completion.',
      idempotencyKey: 'message-1',
    });
    const firstNow = new Date('2030-01-01T00:00:00Z');
    const [first] = await storage.claimDeferredDecisions({
      ownerId: 'first',
      now: firstNow,
      leaseExpiresAt: new Date(firstNow.getTime() + 30_000),
      limit: 1,
    });
    expect(first).toMatchObject({ deliveryGeneration: 0 });

    await storage.failDeferredDecision(
      {
        id: first!.id,
        orgId: 'org-1',
        factoryProjectId: PROJECT_ID,
        ownerId: 'first',
        error: 'retry me',
        terminal: false,
        availableAt: firstNow,
      },
      firstNow,
    );
    const [retried] = await storage.claimDeferredDecisions({
      ownerId: 'second',
      now: firstNow,
      leaseExpiresAt: new Date(firstNow.getTime() + 30_000),
      limit: 1,
    });

    expect(retried).toMatchObject({ id: first!.id, deliveryGeneration: 1 });
  });

  it('advances the delivery generation when a failed deferred decision is manually retried', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    await queueDecision(storage, {
      type: 'sendMessage',
      role: 'work',
      message: 'Review completion.',
      idempotencyKey: 'message-1',
    });
    const now = new Date('2030-01-01T00:00:00Z');
    const [claimed] = await storage.claimDeferredDecisions({
      ownerId: 'first',
      now,
      leaseExpiresAt: new Date(now.getTime() + 30_000),
      limit: 1,
    });
    await storage.failDeferredDecision(
      {
        id: claimed!.id,
        orgId: 'org-1',
        factoryProjectId: PROJECT_ID,
        ownerId: 'first',
        error: 'failed',
        terminal: true,
        availableAt: now,
      },
      now,
    );

    const retried = await storage.retryDeferredDecision('org-1', PROJECT_ID, claimed!.id, now);

    expect(retried).toMatchObject({ status: 'retry', attempts: 0, deliveryGeneration: 1 });
  });

  it('dispatches a bound session message through notification dedupe and marks the effect succeeded', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { item, transitionService } = await queueDecision(storage, {
      type: 'sendMessage',
      role: 'work',
      message: 'Review completion.',
      idempotencyKey: 'message-1',
    });
    const { controller, delivered } = createSession();
    await storage.prepareRunStart({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      workItem: {
        id: item.id,
        input: {
          externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:1' },
          title: 'Fix issue',
          stages: ['execute'],
          sessions: {},
          metadata: {},
        },
      },
      role: 'work',
      session: { sessionId: 'session-1', branch: 'factory/issue-1', threadId: 'thread-1' },
      resourceId: PROJECT_ID,
      kickoffKey: 'kickoff-null',
      kickoffMessage: null,
    });
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      isAutoRunEnabled: async () => true,
      transitionService,
      storage,
      ownerId: 'worker-1',
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));
    await dispatcher.runOnce(new Date('2030-01-01T00:01:00Z'));

    expect(delivered).toEqual(['message-1']);
    expect((await storage.listDeferredDecisions('org-1', PROJECT_ID))[0]).toMatchObject({
      status: 'succeeded',
      attempts: 1,
    });
  });

  it('completes a session message quietly when no live session holds the role', async () => {
    // Parking a card queues a notice for whoever is live on it. A card resting
    // with its runs finished has nobody live — that is silence, not a failure
    // to retry into a red badge.
    const storage = (await createFactoryStorageForTests()).workItems;
    const { transitionService } = await queueDecision(storage, {
      type: 'sendMessage',
      role: 'review',
      message: 'This work was moved from the done stage to the intake stage.',
      idempotencyKey: 'park-notice-1',
    });
    const { controller, sendNotificationSignal } = createSession();
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      isAutoRunEnabled: async () => true,
      transitionService,
      storage,
      ownerId: 'worker-1',
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    expect(sendNotificationSignal).not.toHaveBeenCalled();
    expect((await storage.listDeferredDecisions('org-1', PROJECT_ID))[0]).toMatchObject({
      status: 'succeeded',
      attempts: 1,
    });
  });

  it('delivers a seatless park notice to whichever session is live on the card', async () => {
    // Parking names no seat: the person parked the card, not a role. The
    // notice must land on the session actually running — here the plan seat.
    const storage = (await createFactoryStorageForTests()).workItems;
    const { item, transitionService } = await queueDecision(storage, {
      type: 'sendMessage',
      message: 'This work was moved from the planning stage to the intake stage.',
      idempotencyKey: 'park-notice-2',
    });
    const { controller, delivered } = createSession();
    await storage.prepareRunStart({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      workItem: {
        id: item.id,
        input: {
          externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:1' },
          title: 'Fix issue',
          stages: ['planning'],
          sessions: {},
          metadata: {},
        },
      },
      role: 'plan',
      session: { sessionId: 'session-1', branch: 'factory/issue-1', threadId: 'thread-1' },
      resourceId: PROJECT_ID,
      kickoffKey: 'kickoff-plan',
      kickoffMessage: null,
    });
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      isAutoRunEnabled: async () => true,
      transitionService,
      storage,
      ownerId: 'worker-1',
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));
    await dispatcher.runOnce(new Date('2030-01-01T00:01:00Z'));

    expect(delivered).toEqual(['park-notice-2']);
    expect((await storage.listDeferredDecisions('org-1', PROJECT_ID))[0]).toMatchObject({
      status: 'succeeded',
      attempts: 1,
    });
  });

  it('delivers the built-in build prompt into the work session when a card enters Building', async () => {
    // Building is the one leg of the loop that has never run for real, and it
    // carries a prompt rather than a skill. Drive the shipped rules through the
    // dispatcher so the prompt an agent would actually receive is asserted.
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage);
    await bindWorkRun(storage, item.id);
    const bound = await storage.get({ orgId: 'org-1', id: item.id });
    const transitionService = new FactoryTransitionService({ storage, rules: builtInFactoryRules() });
    const transitioned = await transitionService.transition({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      workItemId: item.id,
      board: 'work',
      stage: 'execute',
      expectedRevision: bound!.revision,
      actor: { type: 'human', id: 'user-1' },
      ingress: { type: 'human', identity: 'move-build-1' },
      cause: 'board_drag',
    });
    expect(transitioned.status).toBe('accepted');
    const { controller, session } = createSession(undefined, {
      emitAgentEndDuringSignal: true,
      agentEndReason: 'complete',
    });
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      isAutoRunEnabled: async () => true,
      transitionService,
      storage,
      ownerId: 'worker-1',
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    expect(session.sendSignal).toHaveBeenCalledTimes(1);
    expect(session.sendSignal.mock.calls[0]?.[0]).toMatchObject({
      contents: expect.stringContaining('Open a pull request when the work is ready for review.'),
    });
    const buildDecisions = (await storage.listDeferredDecisions('org-1', PROJECT_ID)).filter(
      decision => decision.decision.type === 'invokeSkill',
    );
    expect(buildDecisions.map(decision => decision.status)).toEqual(['succeeded']);
  });

  it('prepares a binding, delivers to active sessions, and consumes idle wake streams for an urgent stage transition', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { item, transitionService } = await queueDecision(storage, {
      type: 'sendMessage',
      role: 'plan',
      message: 'This work was moved from the triage stage to the planning stage.',
      priority: 'urgent',
      idleBehavior: 'wake',
      prepareBinding: true,
      idempotencyKey: 'stage-transition-1',
    });
    const { controller, sendNotificationSignal, consumeStream } = createSession();
    const prepareBinding = vi.fn(async () => {
      await storage.prepareRunStart({
        orgId: 'org-1',
        userId: 'user-1',
        factoryProjectId: PROJECT_ID,
        workItem: {
          id: item.id,
          input: {
            externalSource: item.externalSource,
            title: item.title,
            stages: ['execute'],
            sessions: {},
            metadata: item.metadata,
          },
        },
        role: 'plan',
        session: { sessionId: 'session-1', branch: 'factory/issue-1', threadId: 'thread-1' },
        resourceId: PROJECT_ID,
        kickoffKey: 'stage-transition-1',
        kickoffMessage: null,
      });
    });
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      isAutoRunEnabled: async () => true,
      transitionService,
      storage,
      ownerId: 'worker-1',
      prepareBinding,
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    expect(prepareBinding).toHaveBeenCalledWith(
      expect.objectContaining({ item: expect.objectContaining({ id: item.id }), role: 'plan' }),
    );
    expect(sendNotificationSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'rule-message',
        priority: 'urgent',
        summary: 'This work was moved from the triage stage to the planning stage.',
      }),
      {
        ifActive: { behavior: 'deliver' },
        ifIdle: { behavior: 'wake' },
        requestContext: expect.anything(),
      },
    );
    const requestContext = sendNotificationSignal.mock.calls[0]?.[1]?.requestContext;
    expect(requestContext?.get('user')).toEqual({ workosId: 'user-1', organizationId: 'org-1' });
    expect(consumeStream).toHaveBeenCalledOnce();
  });

  it('renews the lease while an external delivery remains in flight', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));
    try {
      const storage = (await createFactoryStorageForTests()).workItems;
      const { item, transitionService } = await queueDecision(storage, {
        type: 'sendMessage',
        role: 'work',
        message: 'Review completion.',
        idempotencyKey: 'message-1',
      });
      let accept!: (value: unknown) => void;
      const accepted = new Promise<unknown>(resolve => {
        accept = resolve;
      });
      const { controller } = createSession(accepted);
      await storage.prepareRunStart({
        orgId: 'org-1',
        userId: 'user-1',
        factoryProjectId: PROJECT_ID,
        workItem: {
          id: item.id,
          input: {
            externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:1' },
            title: 'Fix issue',
            stages: ['execute'],
            sessions: {},
            metadata: {},
          },
        },
        role: 'work',
        session: { sessionId: 'session-1', branch: 'factory/issue-1', threadId: 'thread-1' },
        resourceId: PROJECT_ID,
        kickoffKey: 'kickoff-null',
        kickoffMessage: null,
      });
      const renew = vi.spyOn(storage, 'renewDeferredDecisionLease');
      const dispatcher = new FactoryDecisionDispatcher({
        controller: controller as never,
        isAutoRunEnabled: async () => true,
        transitionService,
        storage,
        ownerId: 'worker-1',
      });

      const dispatch = dispatcher.runOnce();
      await vi.advanceTimersByTimeAsync(10_001);
      expect(renew).toHaveBeenCalledOnce();
      expect((await storage.listDeferredDecisions('org-1', PROJECT_ID))[0]?.leaseExpiresAt?.toISOString()).toBe(
        '2030-01-01T00:00:40.000Z',
      );
      accept({ action: 'wake', output: { consumeStream: vi.fn(async () => {}) } });
      await dispatch;
      expect((await storage.listDeferredDecisions('org-1', PROJECT_ID))[0]?.status).toBe('succeeded');
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps claiming newer decisions while a slow dispatch is still in flight', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));
    try {
      const storage = (await createFactoryStorageForTests()).workItems;
      // Decision A: delivery hangs until we release it (models a kickoff that
      // consumes a long agent run).
      const { item, transitionService } = await queueDecision(storage, {
        type: 'sendMessage',
        role: 'work',
        message: 'Review completion.',
        idempotencyKey: 'slow-1',
      });
      let accept!: (value: unknown) => void;
      const accepted = new Promise<unknown>(resolve => {
        accept = resolve;
      });
      const { controller } = createSession(accepted);
      await storage.prepareRunStart({
        orgId: 'org-1',
        userId: 'user-1',
        factoryProjectId: PROJECT_ID,
        workItem: {
          id: item.id,
          input: {
            externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:1' },
            title: 'Fix issue',
            stages: ['execute'],
            sessions: {},
            metadata: {},
          },
        },
        role: 'work',
        session: { sessionId: 'session-1', branch: 'factory/issue-1', threadId: 'thread-1' },
        resourceId: PROJECT_ID,
        kickoffKey: 'kickoff-null',
        kickoffMessage: null,
      });
      const dispatcher = new FactoryDecisionDispatcher({
        controller: controller as never,
        isAutoRunEnabled: async () => true,
        transitionService,
        storage,
        ownerId: 'worker-1',
      });

      dispatcher.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(
        (await storage.listDeferredDecisions('org-1', PROJECT_ID)).find(d => d.idempotencyKey === 'slow-1'),
      ).toMatchObject({ status: 'leased' });

      // Decision B arrives while A is still hanging. The poll loop must claim
      // and complete it instead of waiting for A.
      await queueDecision(
        storage,
        {
          type: 'upsertLinkedWorkItem',
          idempotencyKey: 'fast-1',
          board: 'work',
          source: 'github-issue',
          sourceKey: 'github-issue:99',
          title: 'Linked issue',
          url: null,
          stage: 'intake',
        },
        { sourceKey: 'github-issue:2', ingress: 'move-2' },
      );
      await vi.advanceTimersByTimeAsync(2_000);

      const decisions = await storage.listDeferredDecisions('org-1', PROJECT_ID);
      expect(decisions.find(d => d.idempotencyKey === 'fast-1')).toMatchObject({ status: 'succeeded' });
      expect(decisions.find(d => d.idempotencyKey === 'slow-1')).toMatchObject({ status: 'leased' });

      accept({ action: 'wake', output: { consumeStream: vi.fn(async () => {}) } });
      await dispatcher.stop();
      expect(
        (await storage.listDeferredDecisions('org-1', PROJECT_ID)).find(d => d.idempotencyKey === 'slow-1'),
      ).toMatchObject({ status: 'succeeded' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops claiming once the in-flight cap is reached and resumes when capacity frees up', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));
    try {
      const storage = (await createFactoryStorageForTests()).workItems;
      const { item, transitionService } = await queueDecision(storage, {
        type: 'sendMessage',
        role: 'work',
        message: 'Review completion.',
        idempotencyKey: 'slow-1',
      });
      let accept!: (value: unknown) => void;
      const accepted = new Promise<unknown>(resolve => {
        accept = resolve;
      });
      const { controller } = createSession(accepted);
      await storage.prepareRunStart({
        orgId: 'org-1',
        userId: 'user-1',
        factoryProjectId: PROJECT_ID,
        workItem: {
          id: item.id,
          input: {
            externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:1' },
            title: 'Fix issue',
            stages: ['execute'],
            sessions: {},
            metadata: {},
          },
        },
        role: 'work',
        session: { sessionId: 'session-1', branch: 'factory/issue-1', threadId: 'thread-1' },
        resourceId: PROJECT_ID,
        kickoffKey: 'kickoff-null',
        kickoffMessage: null,
      });
      const dispatcher = new FactoryDecisionDispatcher({
        controller: controller as never,
        isAutoRunEnabled: async () => true,
        transitionService,
        storage,
        ownerId: 'worker-1',
        maxInFlight: 1,
      });

      dispatcher.start();
      await vi.advanceTimersByTimeAsync(0);
      await queueDecision(
        storage,
        {
          type: 'upsertLinkedWorkItem',
          idempotencyKey: 'fast-1',
          board: 'work',
          source: 'github-issue',
          sourceKey: 'github-issue:99',
          title: 'Linked issue',
          url: null,
          stage: 'intake',
        },
        { sourceKey: 'github-issue:2', ingress: 'move-2' },
      );
      await vi.advanceTimersByTimeAsync(3_000);

      // Capacity is exhausted by the hanging dispatch, so the newer decision
      // must remain unclaimed.
      expect(
        (await storage.listDeferredDecisions('org-1', PROJECT_ID)).find(d => d.idempotencyKey === 'fast-1'),
      ).toMatchObject({ status: 'pending' });

      accept({ action: 'wake', output: { consumeStream: vi.fn(async () => {}) } });
      await vi.advanceTimersByTimeAsync(2_000);
      expect(
        (await storage.listDeferredDecisions('org-1', PROJECT_ID)).find(d => d.idempotencyKey === 'fast-1'),
      ).toMatchObject({ status: 'succeeded' });
      await dispatcher.stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it('sends the resolved skill activation as the bound session kickoff prompt', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { item, transitionService } = await queueDecision(storage, {
      type: 'invokeSkill',
      role: 'work',
      skillName: 'understand-issue',
      arguments: 'Issue 42',
      idempotencyKey: 'skill-1',
      precedingMessage: 'This work was moved from the planning stage to the execute stage.',
    });
    const { controller, session, sendNotificationSignal, getAgentEndListenerCount } = createSession();
    await storage.prepareRunStart({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      workItem: {
        id: item.id,
        input: {
          externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:1' },
          title: 'Fix issue',
          stages: ['execute'],
          sessions: {},
          metadata: {},
        },
      },
      role: 'work',
      session: { sessionId: 'session-1', branch: 'factory/issue-1', threadId: 'thread-1' },
      resourceId: PROJECT_ID,
      kickoffKey: 'kickoff-null',
      kickoffMessage: null,
    });
    const primeCredentials = vi.fn(async () => {});
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      isAutoRunEnabled: async () => true,
      transitionService,
      storage,
      ownerId: 'worker-1',
      primeCredentials,
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    expect(primeCredentials).toHaveBeenCalledWith({ orgId: 'org-1', userId: 'user-1' });
    expect(sendNotificationSignal).toHaveBeenCalledWith(
      {
        source: 'factory',
        kind: 'stage-transition',
        summary: 'This work was moved from the planning stage to the execute stage.',
        priority: 'medium',
        payload: { message: 'This work was moved from the planning stage to the execute stage.' },
        sourceId: expect.stringMatching(/:stage-transition$/),
        dedupeKey: 'skill-1:stage-transition',
      },
      {
        ifActive: { behavior: 'deliver' },
        ifIdle: { behavior: 'persist' },
        requestContext: expect.anything(),
      },
    );
    expect(sendNotificationSignal.mock.invocationCallOrder[0]).toBeLessThan(
      session.sendSignal.mock.invocationCallOrder[0]!,
    );
    expect(session.sendSignal).toHaveBeenCalledWith(
      {
        id: expect.any(String),
        type: 'user',
        tagName: 'user',
        contents: expect.stringMatching(/<skill name="understand-issue">[\s\S]*ARGUMENTS: Issue 42[\s\S]*<\/skill>/),
      },
      { requestContext: expect.anything(), requireDelivery: true },
    );
    const requestContext = session.sendSignal.mock.calls[0]?.[1]?.requestContext;
    expect(requestContext?.get('user')).toEqual({ workosId: 'user-1', organizationId: 'org-1' });
    expect(session.subscribe).toHaveBeenCalledTimes(1);
    expect(getAgentEndListenerCount()).toBe(0);
  });

  it('appends the work item feed to the invokeSkill kickoff', async () => {
    const seed = await createFactoryStorageForTests();
    const storage = seed.workItems;
    const { item, transitionService } = await queueDecision(storage, {
      type: 'invokeSkill',
      role: 'work',
      skillName: 'understand-issue',
      idempotencyKey: 'skill-feed',
    });
    await seed.comments.create({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      workItemId: item.id,
      author: { kind: 'user', id: 'user-2', displayName: 'Bob' },
      body: 'ship it behind the flag',
    });
    await bindWorkRun(storage, item.id);
    const { controller, session } = createSession();
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      isAutoRunEnabled: async () => true,
      transitionService,
      storage,
      ownerId: 'worker-1',
      feedReader: new FactoryFeedReader(seed.comments),
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    expect(session.sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        contents: expect.stringMatching(
          /<\/skill>\n\n<work-item-feed>\n[\s\S]*\[Bob · [\s\S]*ship it behind the flag[\s\S]*<\/work-item-feed>$/,
        ),
      }),
      expect.anything(),
    );
    expect((await storage.listDeferredDecisions('org-1', PROJECT_ID))[0]?.status).toBe('succeeded');
  });

  it('still honors the delivery-id replay guard with a feed reader wired', async () => {
    const seed = await createFactoryStorageForTests();
    const storage = seed.workItems;
    const { item, transitionService } = await queueDecision(storage, {
      type: 'invokeSkill',
      role: 'work',
      skillName: 'understand-issue',
      idempotencyKey: 'skill-feed-replay',
    });
    await seed.comments.create({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      workItemId: item.id,
      author: { kind: 'user', id: 'user-2', displayName: 'Bob' },
      body: 'comment landed after the first delivery',
    });
    await bindWorkRun(storage, item.id);
    const [decision] = await storage.listDeferredDecisions('org-1', PROJECT_ID);
    const { controller, session } = createSession(undefined, { initialDeliveredSignalIds: [decision!.id] });
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      isAutoRunEnabled: async () => true,
      transitionService,
      storage,
      ownerId: 'worker-1',
      feedReader: new FactoryFeedReader(seed.comments),
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    expect(session.sendSignal).not.toHaveBeenCalled();
    expect((await storage.listDeferredDecisions('org-1', PROJECT_ID))[0]?.status).toBe('succeeded');
  });

  it('aborts the current run before kickoff when the invokeSkill decision sets cancelInFlight', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { item, transitionService } = await queueDecision(storage, {
      type: 'invokeSkill',
      role: 'work',
      skillName: 'factory-review',
      arguments: 'PR 42',
      idempotencyKey: 'skill-cancel-1',
      cancelInFlight: true,
    });
    const { controller, session, abort } = createSession();
    await storage.prepareRunStart({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      workItem: {
        id: item.id,
        input: {
          externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:1' },
          title: 'Fix issue',
          stages: ['execute'],
          sessions: {},
          metadata: {},
        },
      },
      role: 'work',
      session: { sessionId: 'session-1', branch: 'factory/issue-1', threadId: 'thread-1' },
      resourceId: PROJECT_ID,
      kickoffKey: 'kickoff-cancel',
      kickoffMessage: null,
    });
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      isAutoRunEnabled: async () => true,
      transitionService,
      storage,
      ownerId: 'worker-1',
      primeCredentials: vi.fn(async () => {}),
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    expect(abort).toHaveBeenCalledTimes(1);
    expect(abort.mock.invocationCallOrder[0]!).toBeLessThan(session.sendSignal.mock.invocationCallOrder[0]!);
    expect(session.sendSignal).toHaveBeenCalledTimes(1);
  });

  it('does not abort the current run when the invokeSkill decision omits cancelInFlight', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { item, transitionService } = await queueDecision(storage, {
      type: 'invokeSkill',
      role: 'work',
      skillName: 'factory-review',
      arguments: 'PR 42',
      idempotencyKey: 'skill-no-cancel-1',
    });
    const { controller, abort } = createSession();
    await storage.prepareRunStart({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      workItem: {
        id: item.id,
        input: {
          externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:1' },
          title: 'Fix issue',
          stages: ['execute'],
          sessions: {},
          metadata: {},
        },
      },
      role: 'work',
      session: { sessionId: 'session-1', branch: 'factory/issue-1', threadId: 'thread-1' },
      resourceId: PROJECT_ID,
      kickoffKey: 'kickoff-no-cancel',
      kickoffMessage: null,
    });
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      isAutoRunEnabled: async () => true,
      transitionService,
      storage,
      ownerId: 'worker-1',
      primeCredentials: vi.fn(async () => {}),
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    expect(abort).not.toHaveBeenCalled();
  });

  it('holds a wake dispatch slot until agent end before claiming another decision', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { item, transitionService } = await queueDecision(storage, {
      type: 'invokeSkill',
      role: 'work',
      skillName: 'understand-issue',
      idempotencyKey: 'wake-holds-capacity',
    });
    const prepared = await storage.prepareRunStart({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      workItem: {
        id: item.id,
        input: {
          externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:1' },
          title: 'Fix issue',
          stages: ['execute'],
          sessions: {},
          metadata: {},
        },
      },
      role: 'work',
      session: { sessionId: 'session-1', branch: 'factory/issue-1', threadId: 'thread-1' },
      resourceId: PROJECT_ID,
      kickoffKey: 'kickoff-null',
      kickoffMessage: null,
    });
    // The coordinator marks null-kickoff starts sent at prepare time; leaving
    // the row pending would let it win the single in-flight slot under
    // starts-first claiming and stall the wake decision this test exercises.
    await storage.markPendingStart(prepared.binding.id, 'sent');
    const { controller, session, emitAgentEnd, getAgentEndListenerCount } = createSession(undefined, {
      signalAccepted: Promise.resolve({ accepted: true, action: 'wake' }),
    });
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      isAutoRunEnabled: async () => true,
      transitionService,
      storage,
      ownerId: 'worker-1',
      maxInFlight: 1,
    });

    const first = dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));
    await vi.waitFor(() => expect(session.sendSignal).toHaveBeenCalledTimes(1));
    await queueDecision(
      storage,
      {
        type: 'upsertLinkedWorkItem',
        idempotencyKey: 'blocked-by-wake',
        board: 'work',
        source: 'github-issue',
        sourceKey: 'github-issue:99',
        title: 'Linked issue',
        url: null,
        stage: 'intake',
      },
      { sourceKey: 'github-issue:2', ingress: 'move-2' },
    );

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));
    expect(
      (await storage.listDeferredDecisions('org-1', PROJECT_ID)).find(d => d.idempotencyKey === 'blocked-by-wake'),
    ).toMatchObject({ status: 'pending' });

    emitAgentEnd();
    await first;
    expect(getAgentEndListenerCount()).toBe(0);

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));
    expect(
      (await storage.listDeferredDecisions('org-1', PROJECT_ID)).find(d => d.idempotencyKey === 'blocked-by-wake'),
    ).toMatchObject({ status: 'succeeded' });
  });

  it('fails a wake dispatch for retry when the terminal event is not observed before the deadline', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));
    try {
      const storage = (await createFactoryStorageForTests()).workItems;
      const { item, transitionService } = await queueDecision(storage, {
        type: 'invokeSkill',
        role: 'work',
        skillName: 'understand-issue',
        idempotencyKey: 'wake-observation-timeout',
      });
      await storage.prepareRunStart({
        orgId: 'org-1',
        userId: 'user-1',
        factoryProjectId: PROJECT_ID,
        workItem: {
          id: item.id,
          input: {
            externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:1' },
            title: 'Fix issue',
            stages: ['execute'],
            sessions: {},
            metadata: {},
          },
        },
        role: 'work',
        session: { sessionId: 'session-1', branch: 'factory/issue-1', threadId: 'thread-1' },
        resourceId: PROJECT_ID,
        kickoffKey: 'kickoff-null',
        kickoffMessage: null,
      });
      const { controller, session, getAgentEndListenerCount } = createSession(undefined, {
        signalAccepted: Promise.resolve({ accepted: true, action: 'wake' }),
      });
      const dispatcher = new FactoryDecisionDispatcher({
        controller: controller as never,
        isAutoRunEnabled: async () => true,
        transitionService,
        storage,
        ownerId: 'worker-1',
      });

      const dispatch = dispatcher.runOnce();
      await vi.advanceTimersByTimeAsync(0);
      expect(session.sendSignal).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(FACTORY_DISPATCH_CONSTANTS.skillCompletionObservationTimeoutMs);
      await dispatch;

      // An unobserved run end is the silent-stall failure mode: the decision
      // must fail for redelivery instead of completing on nothing.
      expect((await storage.listDeferredDecisions('org-1', PROJECT_ID))[0]).toMatchObject({
        status: 'retry',
        attempts: 1,
        lastError: expect.stringContaining('terminal event was not observed'),
      });
      expect(getAgentEndListenerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not miss agent end emitted synchronously during the wake signal', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { item, transitionService } = await queueDecision(storage, {
      type: 'invokeSkill',
      role: 'work',
      skillName: 'understand-issue',
      idempotencyKey: 'synchronous-agent-end',
    });
    await storage.prepareRunStart({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      workItem: {
        id: item.id,
        input: {
          externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:1' },
          title: 'Fix issue',
          stages: ['execute'],
          sessions: {},
          metadata: {},
        },
      },
      role: 'work',
      session: { sessionId: 'session-1', branch: 'factory/issue-1', threadId: 'thread-1' },
      resourceId: PROJECT_ID,
      kickoffKey: 'kickoff-null',
      kickoffMessage: null,
    });
    const { controller, getAgentEndListenerCount } = createSession(undefined, {
      signalAccepted: Promise.resolve({ accepted: true, action: 'wake' }),
      emitAgentEndDuringSignal: true,
    });
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      isAutoRunEnabled: async () => true,
      transitionService,
      storage,
      ownerId: 'worker-1',
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    expect((await storage.listDeferredDecisions('org-1', PROJECT_ID))[0]).toMatchObject({ status: 'succeeded' });
    expect(getAgentEndListenerCount()).toBe(0);
  });

  it.each([
    { reason: 'error' as const, key: 'skill-run-error', message: 'ended in error' },
    // An abort reads as deliberate, but the stream never says who aborted, and
    // the usual cause is the process going away underneath the run. Ending the
    // card at attempt 1 with no button leaves a human to nudge it by hand.
    { reason: 'aborted' as const, key: 'skill-run-aborted', message: 'was aborted' },
  ])('retries a run that ended $reason instead of reporting success', async ({ reason, key, message }) => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { item, transitionService } = await queueDecision(storage, {
      type: 'invokeSkill',
      role: 'work',
      skillName: 'understand-issue',
      arguments: 'Issue 42',
      idempotencyKey: key,
    });
    await storage.prepareRunStart({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      workItem: {
        id: item.id,
        input: {
          externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:1' },
          title: 'Fix issue',
          stages: ['execute'],
          sessions: {},
          metadata: {},
        },
      },
      role: 'work',
      session: { sessionId: 'session-1', branch: 'factory/issue-1', threadId: 'thread-1' },
      resourceId: PROJECT_ID,
      kickoffKey: 'kickoff-null',
      kickoffMessage: null,
    });
    const { controller, session, getAgentEndListenerCount } = createSession(undefined, {
      signalAccepted: Promise.resolve({ accepted: true, action: 'wake' }),
      emitAgentEndDuringSignal: true,
      agentEndReason: reason,
    });
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      isAutoRunEnabled: async () => true,
      transitionService,
      storage,
      ownerId: 'worker-1',
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    const [decision] = await storage.listDeferredDecisions('org-1', PROJECT_ID);
    expect(decision?.status).toBe('retry');
    expect(decision?.lastError).toContain(message);
    // `retry` only helps if the row can actually be picked up again.
    expect(decision?.availableAt).toBeTruthy();
    expect(decision?.deliveryGeneration).toBe(1);
    expect(getAgentEndListenerCount()).toBe(0);

    await dispatcher.runOnce(new Date('2030-01-01T00:01:00Z'));

    expect(session.sendSignal).toHaveBeenCalledTimes(2);
    expect(session.sendSignal.mock.calls.map(call => call[0].id)).toEqual([decision!.id, `${decision!.id}:retry:1`]);
    expect((await storage.listDeferredDecisions('org-1', PROJECT_ID))[0]).toMatchObject({
      status: 'retry',
      deliveryGeneration: 2,
    });
    expect(getAgentEndListenerCount()).toBe(0);
  });

  it('retries a kickoff that was queued onto an ending run instead of reporting success', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { item, transitionService } = await queueDecision(storage, {
      type: 'invokeSkill',
      role: 'work',
      skillName: 'understand-issue',
      arguments: 'Issue 42',
      idempotencyKey: 'skill-delivered-onto-dying-run',
    });
    await storage.prepareRunStart({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      workItem: {
        id: item.id,
        input: {
          externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:1' },
          title: 'Fix issue',
          stages: ['execute'],
          sessions: {},
          metadata: {},
        },
      },
      role: 'work',
      session: { sessionId: 'session-1', branch: 'factory/issue-1', threadId: 'thread-1' },
      resourceId: PROJECT_ID,
      kickoffKey: 'kickoff-null',
      kickoffMessage: null,
    });
    // The session is mid-turn, so the signal is delivered onto the in-flight
    // run; that run then ends without ever persisting or answering the prompt,
    // and the redelivery is swallowed the same way. Nothing here can be waited
    // out, so the decision has to go back on the queue.
    const { controller, getAgentEndListenerCount } = createSession(undefined, {
      signalAccepted: Promise.resolve({ accepted: true, action: 'deliver' }),
      dropDeliveredSignal: true,
      endRunAfterDroppedSignal: true,
    });
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      isAutoRunEnabled: async () => true,
      transitionService,
      storage,
      ownerId: 'worker-1',
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    const [decision] = await storage.listDeferredDecisions('org-1', PROJECT_ID);
    expect(decision?.status).toBe('retry');
    expect(decision?.lastError).toContain('never reached the agent');
    expect(getAgentEndListenerCount()).toBe(0);
  });

  it('redelivers a kickoff dropped onto an ending run once that run finishes', async () => {
    // The condition that frees the session is the in-flight run ending, which
    // takes as long as a turn takes. Retrying on the generic backoff spends all
    // five attempts inside half a minute, so every one lands on the same busy
    // run and the card dies of impatience rather than of anything being wrong.
    const storage = (await createFactoryStorageForTests()).workItems;
    const { item, transitionService } = await queueDecision(storage, {
      type: 'invokeSkill',
      role: 'work',
      skillName: 'understand-issue',
      arguments: 'Issue 42',
      idempotencyKey: 'skill-redelivered-after-run-ends',
    });
    await storage.prepareRunStart({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      workItem: {
        id: item.id,
        input: {
          externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:1' },
          title: 'Fix issue',
          stages: ['execute'],
          sessions: {},
          metadata: {},
        },
      },
      role: 'work',
      session: { sessionId: 'session-1', branch: 'factory/issue-1', threadId: 'thread-1' },
      resourceId: PROJECT_ID,
      kickoffKey: 'kickoff-null',
      kickoffMessage: null,
    });
    const { controller, session, getAgentEndListenerCount } = createSession(undefined, {
      signalAccepted: Promise.resolve({ accepted: true, action: 'deliver' }),
      dropDeliveredSignal: true,
      endRunAfterDroppedSignal: true,
      acceptRedeliveredSignal: true,
    });
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      isAutoRunEnabled: async () => true,
      transitionService,
      storage,
      ownerId: 'worker-1',
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    const [decision] = await storage.listDeferredDecisions('org-1', PROJECT_ID);
    expect(decision?.status).toBe('succeeded');
    // Settled inside the one lease, without spending the card's retry budget.
    expect(decision?.attempts).toBe(1);
    expect(session.sendSignal).toHaveBeenCalledTimes(2);
    expect(getAgentEndListenerCount()).toBe(0);
  });

  it('retries the skill kickoff when the wake signal is rejected instead of marking it succeeded', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { item, transitionService } = await queueDecision(storage, {
      type: 'invokeSkill',
      role: 'work',
      skillName: 'understand-issue',
      arguments: 'Issue 42',
      idempotencyKey: 'skill-wake-fail',
    });
    const { controller, session, getAgentEndListenerCount } = createSession();
    await storage.prepareRunStart({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      workItem: {
        id: item.id,
        input: {
          externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:1' },
          title: 'Fix issue',
          stages: ['execute'],
          sessions: {},
          metadata: {},
        },
      },
      role: 'work',
      session: { sessionId: 'session-1', branch: 'factory/issue-1', threadId: 'thread-1' },
      resourceId: PROJECT_ID,
      kickoffKey: 'kickoff-null',
      kickoffMessage: null,
    });
    // First attempt: the wake never reaches the agent (e.g. dead platform
    // sandbox) — the real acceptance promise rejects.
    session.sendSignal.mockImplementationOnce(() => ({
      accepted: Promise.reject(new Error('Platform proxy request failed with 500: internal_error')),
    }));
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      isAutoRunEnabled: async () => true,
      transitionService,
      storage,
      ownerId: 'worker-1',
    });

    const first = new Date('2030-01-01T00:00:00Z');
    await dispatcher.runOnce(first);

    const [afterFailure] = await storage.listDeferredDecisions('org-1', PROJECT_ID);
    expect(afterFailure?.status).toBe('retry');
    expect(afterFailure?.lastError).toContain('Platform proxy request failed');
    expect(getAgentEndListenerCount()).toBe(0);

    await dispatcher.runOnce(new Date(first.getTime() + 5_000));

    expect(session.sendSignal).toHaveBeenCalledTimes(2);
    expect((await storage.listDeferredDecisions('org-1', PROJECT_ID))[0]?.status).toBe('succeeded');
  });

  it('parks a rule-started run for approval when the project does not allow automatic runs', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { item, transitionService } = await queueDecision(storage, {
      type: 'invokeSkill',
      role: 'work',
      skillName: 'understand-issue',
      idempotencyKey: 'skill-needs-approval',
    });
    await bindWorkRun(storage, item.id);
    const { controller, session } = createSession();
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      transitionService,
      storage,
      ownerId: 'worker-1',
      isAutoRunEnabled: async () => false,
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    const [parked] = await storage.listDeferredDecisions('org-1', PROJECT_ID);
    expect(parked).toMatchObject({ status: 'proposed', attempts: 0 });
    expect(session.sendSignal).not.toHaveBeenCalled();

    // A proposed effect stays out of every later claim until someone approves it.
    await dispatcher.runOnce(new Date('2030-01-01T00:01:00Z'));
    expect((await storage.listDeferredDecisions('org-1', PROJECT_ID))[0]?.status).toBe('proposed');

    await storage.approveDeferredDecision('org-1', PROJECT_ID, parked!.id, new Date('2030-01-01T00:02:00Z'));
    await dispatcher.runOnce(new Date('2030-01-01T00:03:00Z'));

    // Approval outlives the switch: the run starts even though it is still off.
    expect(session.sendSignal).toHaveBeenCalledTimes(1);
    expect((await storage.listDeferredDecisions('org-1', PROJECT_ID))[0]?.status).toBe('succeeded');
  });

  it('runs without approval on an item a person already started, even with automatic runs off', async () => {
    // Withholding automatic runs decides what the Factory picks up on its own.
    // Once a person hands it an item, the runs that carry that item to review
    // are the same request continuing, not new work to consent to.
    const storage = (await createFactoryStorageForTests()).workItems;
    const { item, transitionService } = await queueDecision(storage, {
      type: 'invokeSkill',
      role: 'work',
      skillName: 'understand-issue',
      idempotencyKey: 'skill-on-armed-item',
    });
    await bindWorkRun(storage, item.id);
    await storage.armAutonomy({ orgId: 'org-1', id: item.id, now: new Date('2030-01-01T00:00:00Z') });
    const { controller, session } = createSession();
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      transitionService,
      storage,
      ownerId: 'worker-1',
      isAutoRunEnabled: async () => false,
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:01:00Z'));

    expect(session.sendSignal).toHaveBeenCalledTimes(1);
    expect((await storage.listDeferredDecisions('org-1', PROJECT_ID))[0]?.status).toBe('succeeded');
  });

  async function createPullRequestItem(storage: WorkItemsStorage) {
    return (
      await storage.upsert({
        orgId: 'org-1',
        userId: 'user-1',
        factoryProjectId: PROJECT_ID,
        input: {
          externalSource: { integrationId: 'github', type: 'pull-request', externalId: 'github-pr:7' },
          title: 'Fix change',
          stages: ['intake'],
          sessions: {},
          metadata: { authorTrusted: true },
        },
      })
    ).item;
  }

  it('parks an external push that would pull a rested card back into a working lane', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createPullRequestItem(storage);
    const transitionService = new FactoryTransitionService({
      rules: defaultFactoryRules({ version: 'rules-v1' }),
      storage,
    });
    await storage.commitRuleEvaluation({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      workItemId: item.id,
      ingress: { identity: 'push-1', triggerType: 'github' },
      ruleSetVersion: 'rules-v1',
      expectedRevision: item.revision,
      actor: { type: 'github', login: 'author', trusted: true, factoryAuthored: false },
      outcome: { status: 'accepted' },
      decisions: [{ type: 'transition', board: 'review', stage: 'review', idempotencyKey: 're-review-1' }],
      causalChain: [],
      now: new Date('2030-01-01T00:00:00Z'),
    });
    const { controller, session } = createSession();
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      transitionService,
      storage,
      ownerId: 'worker-1',
      isAutoRunEnabled: async () => false,
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:01:00Z'));

    const [parked] = await storage.listDeferredDecisions('org-1', PROJECT_ID);
    expect(parked).toMatchObject({ status: 'proposed' });
    expect(session.sendSignal).not.toHaveBeenCalled();
    expect((await storage.get({ orgId: 'org-1', id: item.id }))?.stages).toEqual(['intake']);
  });

  it('lets an external push move a card a person already handed over', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createPullRequestItem(storage);
    await storage.armAutonomy({ orgId: 'org-1', id: item.id, now: new Date('2030-01-01T00:00:00Z') });
    const armed = await storage.get({ orgId: 'org-1', id: item.id });
    const transitionService = new FactoryTransitionService({
      rules: defaultFactoryRules({ version: 'rules-v1' }),
      storage,
    });
    await storage.commitRuleEvaluation({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      workItemId: item.id,
      ingress: { identity: 'push-2', triggerType: 'github' },
      ruleSetVersion: 'rules-v1',
      expectedRevision: armed?.revision ?? item.revision,
      actor: { type: 'github', login: 'author', trusted: true, factoryAuthored: false },
      outcome: { status: 'accepted' },
      decisions: [{ type: 'transition', board: 'review', stage: 'review', idempotencyKey: 're-review-2' }],
      causalChain: [],
      now: new Date('2030-01-01T00:00:30Z'),
    });
    const { controller } = createSession();
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      transitionService,
      storage,
      ownerId: 'worker-1',
      isAutoRunEnabled: async () => false,
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:01:00Z'));

    const rows = await storage.listDeferredDecisions('org-1', PROJECT_ID);
    expect(rows.find(row => row.idempotencyKey === 're-review-2')?.status).toBe('succeeded');
    expect((await storage.get({ orgId: 'org-1', id: item.id }))?.stages).toEqual(['review']);
  });

  it('still mirrors an external close onto a resting lane without asking', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage);
    const transitionService = new FactoryTransitionService({
      rules: defaultFactoryRules({ version: 'rules-v1' }),
      storage,
    });
    await storage.commitRuleEvaluation({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      workItemId: item.id,
      ingress: { identity: 'closed-1', triggerType: 'github' },
      ruleSetVersion: 'rules-v1',
      expectedRevision: item.revision,
      actor: { type: 'github', login: 'author', trusted: true, factoryAuthored: false },
      outcome: { status: 'accepted' },
      decisions: [{ type: 'transition', board: 'work', stage: 'canceled', idempotencyKey: 'closed-1' }],
      causalChain: [],
      now: new Date('2030-01-01T00:00:00Z'),
    });
    const { controller } = createSession();
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      transitionService,
      storage,
      ownerId: 'worker-1',
      isAutoRunEnabled: async () => false,
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:01:00Z'));

    expect((await storage.listDeferredDecisions('org-1', PROJECT_ID))[0]?.status).toBe('succeeded');
    expect((await storage.get({ orgId: 'org-1', id: item.id }))?.stages).toEqual(['canceled']);
  });

  it('keeps an externally authored card from self-starting, even armed with auto-run on', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = (
      await storage.upsert({
        orgId: 'org-1',
        userId: 'user-1',
        factoryProjectId: PROJECT_ID,
        input: {
          externalSource: { integrationId: 'github', type: 'pull-request', externalId: 'github-pr:7' },
          title: 'External change',
          stages: ['intake'],
          sessions: {},
          metadata: { authorTrusted: false },
        },
      })
    ).item;
    await storage.armAutonomy({ orgId: 'org-1', id: item.id, now: new Date('2030-01-01T00:00:00Z') });
    const armed = await storage.get({ orgId: 'org-1', id: item.id });
    const transitionService = new FactoryTransitionService({
      rules: defaultFactoryRules({ version: 'rules-v1' }),
      storage,
    });
    await storage.commitRuleEvaluation({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      workItemId: item.id,
      ingress: { identity: 'external-run-1', triggerType: 'github' },
      ruleSetVersion: 'rules-v1',
      expectedRevision: armed?.revision ?? item.revision,
      actor: { type: 'github', login: 'stranger', trusted: false, factoryAuthored: false },
      outcome: { status: 'accepted' },
      decisions: [
        { type: 'invokeSkill', role: 'review', skillName: 'factory-review', idempotencyKey: 'external-run-1' },
      ],
      causalChain: [],
      now: new Date('2030-01-01T00:00:00Z'),
    });
    const { controller, session } = createSession();
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      transitionService,
      storage,
      ownerId: 'worker-1',
      isAutoRunEnabled: async () => true,
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:01:00Z'));

    expect((await storage.listDeferredDecisions('org-1', PROJECT_ID))[0]?.status).toBe('proposed');
    expect(session.sendSignal).not.toHaveBeenCalled();
  });

  it("runs the plan an agent's move queues on an externally authored card a person started", async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = (
      await storage.upsert({
        orgId: 'org-1',
        userId: 'user-1',
        factoryProjectId: PROJECT_ID,
        input: {
          externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:9' },
          title: 'Outside report',
          stages: ['triage'],
          sessions: {},
          metadata: { authorTrusted: false },
        },
      })
    ).item;
    await storage.armAutonomy({ orgId: 'org-1', id: item.id, now: new Date('2030-01-01T00:00:00Z') });
    await bindWorkRun(storage, item.id);
    const bound = await storage.get({ orgId: 'org-1', id: item.id });
    const transitionService = new FactoryTransitionService({
      storage,
      rules: defaultFactoryRules({
        version: 'rules-v1',
        overrides: {
          work: {
            planning: {
              issue: {
                onEnter: () => ({
                  type: 'invokeSkill',
                  role: 'work',
                  skillName: 'factory-plan',
                  idempotencyKey: 'plan-1',
                }),
              },
            },
          },
        },
      }),
    });
    const planned = await transitionService.transition({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      workItemId: item.id,
      board: 'work',
      stage: 'planning',
      expectedRevision: bound?.revision ?? item.revision,
      actor: { type: 'agent', bindingId: 'binding-1', role: 'triage' },
      ingress: { type: 'agent', identity: 'triage-verdict-1' },
      cause: 'triage verdict',
      triageType: 'bug',
    });
    expect(planned.status).toBe('accepted');
    const { controller, session } = createSession();
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      transitionService,
      storage,
      ownerId: 'worker-1',
      isAutoRunEnabled: async () => false,
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:01:00Z'));

    expect((await storage.listDeferredDecisions('org-1', PROJECT_ID))[0]?.status).toBe('succeeded');
    expect(session.sendSignal).toHaveBeenCalledTimes(1);
  });

  it('fails closed on a GitHub card missing its trust stamp, even armed with auto-run on', async () => {
    // Cards created before arrival stamps existed carry no `authorTrusted`;
    // absence must not read as trust, or a pre-stamp external PR slips the gate.
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = (
      await storage.upsert({
        orgId: 'org-1',
        userId: 'user-1',
        factoryProjectId: PROJECT_ID,
        input: {
          externalSource: { integrationId: 'github', type: 'pull-request', externalId: 'github-pr:8' },
          title: 'Pre-stamp change',
          stages: ['intake'],
          sessions: {},
          metadata: {},
        },
      })
    ).item;
    await storage.armAutonomy({ orgId: 'org-1', id: item.id, now: new Date('2030-01-01T00:00:00Z') });
    const armed = await storage.get({ orgId: 'org-1', id: item.id });
    const transitionService = new FactoryTransitionService({
      rules: defaultFactoryRules({ version: 'rules-v1' }),
      storage,
    });
    await storage.commitRuleEvaluation({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      workItemId: item.id,
      ingress: { identity: 'legacy-run-1', triggerType: 'github' },
      ruleSetVersion: 'rules-v1',
      expectedRevision: armed?.revision ?? item.revision,
      actor: { type: 'github', login: 'stranger', trusted: false, factoryAuthored: false },
      outcome: { status: 'accepted' },
      decisions: [{ type: 'invokeSkill', role: 'review', skillName: 'factory-review', idempotencyKey: 'legacy-run-1' }],
      causalChain: [],
      now: new Date('2030-01-01T00:00:00Z'),
    });
    const { controller, session } = createSession();
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      transitionService,
      storage,
      ownerId: 'worker-1',
      isAutoRunEnabled: async () => true,
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:01:00Z'));

    expect((await storage.listDeferredDecisions('org-1', PROJECT_ID))[0]?.status).toBe('proposed');
    expect(session.sendSignal).not.toHaveBeenCalled();
  });

  it("lets the Factory's own pull request run under auto-run despite its untrusted bot author", async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = (
      await storage.upsert({
        orgId: 'org-1',
        userId: 'user-1',
        factoryProjectId: PROJECT_ID,
        input: {
          externalSource: { integrationId: 'github', type: 'pull-request', externalId: 'github-pr:9' },
          title: 'Factory change',
          stages: ['intake'],
          sessions: {},
          metadata: { authorTrusted: false, factoryAuthored: true },
        },
      })
    ).item;
    const transitionService = new FactoryTransitionService({
      rules: defaultFactoryRules({ version: 'rules-v1' }),
      storage,
    });
    await storage.commitRuleEvaluation({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      workItemId: item.id,
      ingress: { identity: 'factory-run-1', triggerType: 'github' },
      ruleSetVersion: 'rules-v1',
      expectedRevision: item.revision,
      actor: { type: 'github', login: 'factory[bot]', trusted: false, factoryAuthored: true },
      outcome: { status: 'accepted' },
      decisions: [
        { type: 'invokeSkill', role: 'review', skillName: 'factory-review', idempotencyKey: 'factory-run-1' },
      ],
      causalChain: [],
      now: new Date('2030-01-01T00:00:00Z'),
    });
    const { controller } = createSession();
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      transitionService,
      storage,
      ownerId: 'worker-1',
      isAutoRunEnabled: async () => true,
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:01:00Z'));

    const [record] = await storage.listDeferredDecisions('org-1', PROJECT_ID);
    expect(record?.status).not.toBe('proposed');
  });

  it('still runs the close-out a resting verdict queued, while the disarm parks later events', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const rules = defaultFactoryRules({
      version: 'rules-v1',
      overrides: {
        work: {
          done: {
            issue: {
              onEnter: () => ({
                type: 'invokeSkill',
                role: 'work',
                skillName: 'factory-complete-issue',
                idempotencyKey: 'close-out-1',
              }),
            },
          },
        },
      },
    });
    const transitionService = new FactoryTransitionService({ storage, rules });
    const item = await createItem(storage);
    await storage.armAutonomy({ orgId: 'org-1', id: item.id, now: new Date('2030-01-01T00:00:00Z') });
    await bindWorkRun(storage, item.id);
    const bound = await storage.get({ orgId: 'org-1', id: item.id });
    const rested = await transitionService.transition({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      workItemId: item.id,
      board: 'work',
      stage: 'done',
      expectedRevision: bound?.revision ?? item.revision,
      actor: { type: 'agent', bindingId: 'binding-1', role: 'review' },
      ingress: { type: 'agent', identity: 'verdict-1' },
      cause: 'review verdict',
    });
    expect(rested.status).toBe('accepted');
    expect((await storage.get({ orgId: 'org-1', id: item.id }))?.autonomyArmedAt).toBeNull();
    const [queued] = await storage.listDeferredDecisions('org-1', PROJECT_ID);
    expect(queued?.decision).toMatchObject({ type: 'invokeSkill' });
    expect(queued?.approvedAt).not.toBeNull();

    const { controller, session } = createSession();
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      transitionService,
      storage,
      ownerId: 'worker-1',
      isAutoRunEnabled: async () => false,
    });
    await dispatcher.runOnce(new Date('2030-01-01T00:01:00Z'));

    expect((await storage.listDeferredDecisions('org-1', PROJECT_ID))[0]?.status).toBe('succeeded');
    expect(session.sendSignal).toHaveBeenCalledTimes(1);
  });

  it('leaves the close-out an external close queued unapproved', async () => {
    // A GitHub event is data, not an authorized execution context: the rest it
    // causes never pre-approves the run it queues — that run asks like any other.
    const storage = (await createFactoryStorageForTests()).workItems;
    const rules = defaultFactoryRules({
      version: 'rules-v1',
      overrides: {
        work: {
          done: {
            issue: {
              onEnter: () => ({
                type: 'invokeSkill',
                role: 'work',
                skillName: 'factory-complete-issue',
                idempotencyKey: 'close-out-2',
              }),
            },
          },
        },
      },
    });
    const transitionService = new FactoryTransitionService({ storage, rules });
    const item = await createItem(storage);
    await bindWorkRun(storage, item.id);
    const bound = await storage.get({ orgId: 'org-1', id: item.id });
    const rested = await transitionService.transition({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      workItemId: item.id,
      board: 'work',
      stage: 'done',
      expectedRevision: bound?.revision ?? item.revision,
      actor: { type: 'github', login: 'stranger', trusted: false, factoryAuthored: false },
      ingress: { type: 'github', identity: 'external-close-1' },
      cause: 'issue closed',
    });
    expect(rested.status).toBe('accepted');
    const [queued] = await storage.listDeferredDecisions('org-1', PROJECT_ID);
    expect(queued?.decision).toMatchObject({ type: 'invokeSkill' });
    expect(queued?.approvedAt).toBeNull();

    const { controller, session } = createSession();
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      transitionService,
      storage,
      ownerId: 'worker-1',
      isAutoRunEnabled: async () => false,
    });
    await dispatcher.runOnce(new Date('2030-01-01T00:01:00Z'));

    expect((await storage.listDeferredDecisions('org-1', PROJECT_ID))[0]?.status).toBe('proposed');
    expect(session.sendSignal).not.toHaveBeenCalled();
  });

  it("approves a plan on the project's behalf when plan review is off", async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { item, transitionService } = await queueDecision(storage, {
      type: 'invokeSkill',
      role: 'work',
      skillName: 'understand-issue',
      idempotencyKey: 'skill-plan-auto-approved',
    });
    await bindWorkRun(storage, item.id);
    const { controller, session } = createSession(undefined, { suspendsOnPlan: true });
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      transitionService,
      storage,
      ownerId: 'worker-1',
      isAutoRunEnabled: async () => true,
      autoApprovePlans: async () => true,
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    expect(session.respondToToolSuspension).toHaveBeenCalledWith({
      resumeData: { action: 'approved' },
      toolCallId: 'call-plan',
    });
    expect((await storage.listDeferredDecisions('org-1', PROJECT_ID))[0]?.status).toBe('succeeded');
  });

  it('fails the run loudly when plan review is on and nobody answers the plan', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { item, transitionService } = await queueDecision(storage, {
      type: 'invokeSkill',
      role: 'work',
      skillName: 'understand-issue',
      idempotencyKey: 'skill-plan-parked',
    });
    await bindWorkRun(storage, item.id);
    const { controller, session } = createSession(undefined, { suspendsOnPlan: true });
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      transitionService,
      storage,
      ownerId: 'worker-1',
      isAutoRunEnabled: async () => true,
      autoApprovePlans: async () => false,
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    // The pause is a designed checkpoint, not a crash — but it must be visible:
    // the decision lands in Needs attention with its reason attached.
    expect(session.respondToToolSuspension).not.toHaveBeenCalled();
    const [record] = await storage.listDeferredDecisions('org-1', PROJECT_ID);
    expect(record).toMatchObject({ status: 'failed', failureCode: 'plan_awaiting_approval' });

    // Not just the row: the surface a person actually reads.
    const provider = new AutomationFailedAttentionProvider({ workItems: storage });
    const scope = { orgId: 'org-1', factoryProjectId: PROJECT_ID };
    expect(await provider.counts(scope)).toMatchObject({ open: 1, unread: 1 });
    const page = await provider.page(scope, { view: 'open', search: undefined, before: undefined, limit: 10 });
    expect(page.entries[0]?.item).toMatchObject({
      kind: 'automation-failed',
      failureCode: 'plan_awaiting_approval',
      workItemId: record?.workItemId,
    });
  });

  it('escalates a run parked on a question nobody is there to answer', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { item, transitionService } = await queueDecision(storage, {
      type: 'invokeSkill',
      role: 'work',
      skillName: 'understand-issue',
      idempotencyKey: 'skill-ask-user-parked',
    });
    await bindWorkRun(storage, item.id);
    const { controller, session } = createSession(undefined, { suspendsOnTool: 'ask_user' });
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      transitionService,
      storage,
      ownerId: 'worker-1',
      isAutoRunEnabled: async () => true,
      autoApprovePlans: async () => false,
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    expect(session.respondToToolSuspension).not.toHaveBeenCalled();
    const [record] = await storage.listDeferredDecisions('org-1', PROJECT_ID);
    expect(record).toMatchObject({ status: 'failed', failureCode: 'run_awaiting_input' });
  });

  it('auto-approve answers plans, never questions', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { item, transitionService } = await queueDecision(storage, {
      type: 'invokeSkill',
      role: 'work',
      skillName: 'understand-issue',
      idempotencyKey: 'skill-ask-user-auto',
    });
    await bindWorkRun(storage, item.id);
    const { controller, session } = createSession(undefined, { suspendsOnTool: 'ask_user' });
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      transitionService,
      storage,
      ownerId: 'worker-1',
      isAutoRunEnabled: async () => true,
      autoApprovePlans: async () => true,
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    // A plan has an approvable default; a question does not. Answering one on
    // the project's behalf would be inventing the answer.
    expect(session.respondToToolSuspension).not.toHaveBeenCalled();
    const [record] = await storage.listDeferredDecisions('org-1', PROJECT_ID);
    expect(record).toMatchObject({ status: 'failed', failureCode: 'run_awaiting_input' });

    // And never into failing a person's pause: a person-started run parked on
    // ask_user is that person's question to answer, not a stall.
    const personStorage = (await createFactoryStorageForTests()).workItems;
    const person = await queueRunKickoff(personStorage);
    const personSession = createSession(undefined, { suspendsOnTool: 'ask_user' });
    await new FactoryDecisionDispatcher({
      controller: personSession.controller as never,
      transitionService: person.transitionService,
      storage: personStorage,
      ownerId: 'worker-1',
      isAutoRunEnabled: async () => true,
      autoApprovePlans: async () => true,
    }).runOnce(new Date('2030-01-01T00:00:00Z'));

    expect(personSession.session.respondToToolSuspension).not.toHaveBeenCalled();
    expect((await personStorage.listPendingStarts('org-1', PROJECT_ID))[0]).toMatchObject({ status: 'sent' });
  });

  it("leaves a person-started run's plan to the person reading it", async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { transitionService } = await queueRunKickoff(storage);
    const { controller, session } = createSession(undefined, { suspendsOnPlan: true });
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      transitionService,
      storage,
      ownerId: 'worker-1',
      isAutoRunEnabled: async () => false,
      autoApprovePlans: async () => false,
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    expect(session.respondToToolSuspension).not.toHaveBeenCalled();
    expect((await storage.listPendingStarts('org-1', PROJECT_ID))[0]).toMatchObject({ status: 'sent' });
  });

  it("approves a person-started run's plan too when plan review is off", async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { transitionService } = await queueRunKickoff(storage);
    const { controller, session } = createSession(undefined, { suspendsOnPlan: true });
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      transitionService,
      storage,
      ownerId: 'worker-1',
      isAutoRunEnabled: async () => false,
      autoApprovePlans: async () => true,
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    expect(session.respondToToolSuspension).toHaveBeenCalledWith({
      resumeData: { action: 'approved' },
      toolCallId: 'call-plan',
    });
    expect((await storage.listPendingStarts('org-1', PROJECT_ID))[0]?.status).toBe('sent');
  });

  it("approves a hands-off item's plan while the project switch stays off", async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { item, transitionService } = await queueRunKickoff(storage, { preapprovePlans: true });
    const { controller, session } = createSession(undefined, { suspendsOnPlan: true });
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      transitionService,
      storage,
      ownerId: 'worker-1',
      isAutoRunEnabled: async () => false,
      autoApprovePlans: async () => false,
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    expect((await storage.get({ orgId: 'org-1', id: item.id }))?.plansPreapprovedAt).toBeInstanceOf(Date);
    expect(session.respondToToolSuspension).toHaveBeenCalledWith({
      resumeData: { action: 'approved' },
      toolCallId: 'call-plan',
    });
    expect((await storage.listPendingStarts('org-1', PROJECT_ID))[0]?.status).toBe('sent');
  });

  it("approves a hands-off item's plan on rule-started follow-up runs too", async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { item, transitionService } = await queueDecision(storage, {
      type: 'invokeSkill',
      role: 'work',
      skillName: 'understand-issue',
      idempotencyKey: 'skill-plan-hands-off',
    });
    await bindWorkRun(storage, item.id, { preapprovePlans: true });
    const { controller, session } = createSession(undefined, { suspendsOnPlan: true });
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      transitionService,
      storage,
      ownerId: 'worker-1',
      isAutoRunEnabled: async () => true,
      autoApprovePlans: async () => false,
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    expect(session.respondToToolSuspension).toHaveBeenCalledWith({
      resumeData: { action: 'approved' },
      toolCallId: 'call-plan',
    });
    expect((await storage.listDeferredDecisions('org-1', PROJECT_ID))[0]?.status).toBe('succeeded');
  });

  it('caps the plans it approves, so a run that keeps re-planning reaches a person', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { item, transitionService } = await queueDecision(storage, {
      type: 'invokeSkill',
      role: 'work',
      skillName: 'understand-issue',
      idempotencyKey: 'skill-plan-loop',
    });
    await bindWorkRun(storage, item.id);
    const { controller, session } = createSession(undefined, { suspendsOnPlan: true, replansAfterApproval: true });
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      transitionService,
      storage,
      ownerId: 'worker-1',
      isAutoRunEnabled: async () => true,
      autoApprovePlans: async () => true,
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    expect(session.respondToToolSuspension).toHaveBeenCalledTimes(3);
    const [record] = await storage.listDeferredDecisions('org-1', PROJECT_ID);
    expect(record).toMatchObject({ status: 'failed', failureCode: 'plan_awaiting_approval' });
  });

  it('arms an item once, so the first commitment is the one that counts', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { item } = await queueDecision(storage, {
      type: 'invokeSkill',
      role: 'work',
      skillName: 'understand-issue',
      idempotencyKey: 'skill-arm-once',
    });
    const armed = new Date('2030-01-01T00:00:00Z');
    await storage.armAutonomy({ orgId: 'org-1', id: item.id, now: armed });
    await storage.armAutonomy({ orgId: 'org-1', id: item.id, now: new Date('2030-06-01T00:00:00Z') });

    expect(await storage.get({ orgId: 'org-1', id: item.id })).toMatchObject({ autonomyArmedAt: armed });
  });

  it('never runs a dismissed proposal', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { transitionService } = await queueDecision(storage, {
      type: 'invokeSkill',
      role: 'work',
      skillName: 'understand-issue',
      idempotencyKey: 'skill-dismissed',
    });
    const { controller, session } = createSession();
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      transitionService,
      storage,
      ownerId: 'worker-1',
      isAutoRunEnabled: async () => false,
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));
    const [parked] = await storage.listDeferredDecisions('org-1', PROJECT_ID);
    const dismissed = await storage.dismissDeferredDecision(
      'org-1',
      PROJECT_ID,
      parked!.id,
      new Date('2030-01-01T00:01:00Z'),
    );
    expect(dismissed?.status).toBe('dismissed');

    await dispatcher.runOnce(new Date('2030-01-01T00:02:00Z'));

    expect(session.sendSignal).not.toHaveBeenCalled();
    expect((await storage.listDeferredDecisions('org-1', PROJECT_ID))[0]?.status).toBe('dismissed');
    // A settled proposal cannot be approved back into the queue.
    expect(
      await storage.approveDeferredDecision('org-1', PROJECT_ID, parked!.id, new Date('2030-01-01T00:03:00Z')),
    ).toBeNull();
  });

  it('retires a parked proposal once the run it asked for is starting anyway', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    // First drag, before the item is armed: the run parks as a question.
    const { item } = await queueDecision(storage, {
      type: 'invokeSkill',
      role: 'work',
      skillName: 'understand-issue',
      idempotencyKey: 'skill-parked',
    });
    const { controller, session, emitAgentEnd } = createSession();
    const transitionService = new FactoryTransitionService({
      storage,
      rules: defaultFactoryRules({
        version: 'rules-v1',
        overrides: {
          work: {
            execute: {
              issue: {
                onEnter: () => ({
                  type: 'invokeSkill',
                  role: 'work',
                  skillName: 'understand-issue',
                  idempotencyKey: 'skill-approved',
                }),
              },
            },
          },
        },
      }),
    });
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      transitionService,
      storage,
      ownerId: 'worker-1',
      isAutoRunEnabled: async () => false,
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));
    const [parked] = await storage.listDeferredDecisions('org-1', PROJECT_ID);
    expect(parked).toMatchObject({ status: 'proposed' });
    const beforeManualRun = await storage.get({ orgId: 'org-1', id: item.id });
    if (!beforeManualRun) throw new Error('Expected the work item');
    await storage.commitRuleEvaluation({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      workItemId: item.id,
      ingress: { identity: 'failed-before-manual-run', triggerType: 'test' },
      ruleSetVersion: 'rules-v1',
      expectedRevision: beforeManualRun.revision,
      actor: { type: 'system', id: 'rules' },
      outcome: { status: 'accepted' },
      decisions: [
        {
          type: 'invokeSkill',
          role: 'work',
          skillName: 'understand-issue',
          idempotencyKey: 'skill-failed-before-manual-run',
        },
      ],
      causalChain: [],
      now: new Date('2030-01-01T00:00:30Z'),
    });
    const [failedClaim] = await storage.claimDeferredDecisions({
      ownerId: 'failure-worker',
      now: new Date('2030-01-01T00:00:30Z'),
      leaseExpiresAt: new Date('2030-01-01T00:01:00Z'),
      limit: 1,
    });
    if (!failedClaim) throw new Error('Expected the failed run');
    await storage.failDeferredDecision({
      id: failedClaim.id,
      orgId: failedClaim.orgId,
      factoryProjectId: failedClaim.factoryProjectId,
      ownerId: 'failure-worker',
      now: new Date('2030-01-01T00:00:30Z'),
      availableAt: new Date('2030-01-01T00:00:30Z'),
      lastError: 'Session unavailable.',
      failureCode: 'session_unavailable',
      terminal: true,
    });

    // The person answers by taking the item on, which arms it and emits a
    // second copy of the same run. The parked question is now moot.
    await storage.armAutonomy({ orgId: 'org-1', id: item.id, now: new Date('2030-01-01T00:01:00Z') });
    await bindWorkRun(storage, item.id);
    const current = await storage.get({ orgId: 'org-1', id: item.id });
    await transitionService.transition({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      workItemId: item.id,
      board: 'work',
      stage: 'execute',
      expectedRevision: current!.revision,
      actor: { type: 'human', id: 'user-1' },
      ingress: { type: 'human', identity: 'move-2' },
      cause: 'test',
      reenter: true,
    });

    const dispatched = dispatcher.runOnce(new Date('2030-01-01T00:02:00Z'));
    await vi.waitFor(() => expect(session.sendSignal).toHaveBeenCalled());
    emitAgentEnd();
    await dispatched;

    const decisions = await storage.listDeferredDecisions('org-1', PROJECT_ID);
    expect(decisions.find(entry => entry.id === parked!.id)?.status).toBe('superseded');
    expect(decisions.find(entry => entry.idempotencyKey === 'skill-failed-before-manual-run')?.status).toBe(
      'superseded',
    );
    expect(decisions.find(entry => entry.idempotencyKey === 'skill-approved')?.status).toBe('succeeded');
  });

  it('still moves cards for external facts while automatic runs are off', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { item, transitionService } = await queueDecision(storage, {
      type: 'transition',
      board: 'work',
      stage: 'done',
      idempotencyKey: 'merged-while-manual',
    });
    const { controller } = createSession();
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      transitionService,
      storage,
      ownerId: 'worker-1',
      isAutoRunEnabled: async () => false,
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    expect((await storage.listDeferredDecisions('org-1', PROJECT_ID))[0]?.status).toBe('succeeded');
    expect((await storage.get({ orgId: 'org-1', id: item.id }))?.stages).toEqual(['done']);
  });

  it('completes a transition with a message silently when the item has no active binding', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { item, transitionService } = await queueDecision(storage, {
      type: 'transition',
      board: 'work',
      stage: 'done',
      idempotencyKey: 'merged-no-binding',
      message: { text: 'Pull request merged; card moved to Done.' },
    });
    const { controller, sendNotificationSignal } = createSession();
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      isAutoRunEnabled: async () => true,
      transitionService,
      storage,
      ownerId: 'worker-1',
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    const [record] = await storage.listDeferredDecisions('org-1', PROJECT_ID);
    expect(record?.status).toBe('succeeded');
    expect(sendNotificationSignal).not.toHaveBeenCalled();
    expect((await storage.get({ orgId: 'org-1', id: item.id }))?.stages).toEqual(['done']);
  });

  it('completes a transition when its stored binding has no live session', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { item, transitionService } = await queueDecision(storage, {
      type: 'transition',
      board: 'work',
      stage: 'done',
      idempotencyKey: 'merged-dead-session',
      message: { text: 'Pull request merged; card moved to Done.' },
    });
    await storage.prepareRunStart({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      workItem: {
        id: item.id,
        input: {
          externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:1' },
          title: 'Fix issue',
          stages: ['execute'],
          sessions: {},
          metadata: {},
        },
      },
      role: 'work',
      session: { sessionId: 'session-gone', branch: 'factory/issue-1', threadId: 'thread-gone' },
      resourceId: PROJECT_ID,
      kickoffKey: 'kickoff-dead-session',
      kickoffMessage: null,
    });
    const dispatcher = new FactoryDecisionDispatcher({
      controller: { getSessionByResource: vi.fn(async () => undefined) },
      isAutoRunEnabled: async () => true,
      transitionService,
      storage,
      ownerId: 'worker-1',
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    expect((await storage.listDeferredDecisions('org-1', PROJECT_ID))[0]?.status).toBe('succeeded');
    expect((await storage.get({ orgId: 'org-1', id: item.id }))?.stages).toEqual(['done']);
  });

  it('delivers the transition message to the active session and still moves the card', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { item, transitionService } = await queueDecision(storage, {
      type: 'transition',
      board: 'work',
      stage: 'done',
      idempotencyKey: 'merged-with-binding',
      message: { text: 'Pull request merged; card moved to Done.' },
    });
    const { controller, sendNotificationSignal } = createSession();
    await storage.prepareRunStart({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      workItem: {
        id: item.id,
        input: {
          externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:1' },
          title: 'Fix issue',
          stages: ['execute'],
          sessions: {},
          metadata: {},
        },
      },
      role: 'work',
      session: { sessionId: 'session-1', branch: 'factory/issue-1', threadId: 'thread-1' },
      resourceId: PROJECT_ID,
      kickoffKey: 'kickoff-null',
      kickoffMessage: null,
    });
    const primeCredentials = vi.fn(async () => {});
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      isAutoRunEnabled: async () => true,
      transitionService,
      storage,
      ownerId: 'worker-1',
      primeCredentials,
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    const [record] = await storage.listDeferredDecisions('org-1', PROJECT_ID);
    expect(record?.status).toBe('succeeded');
    expect((await storage.get({ orgId: 'org-1', id: item.id }))?.stages).toEqual(['done']);
    expect(primeCredentials).toHaveBeenCalledWith({ orgId: 'org-1', userId: 'user-1' });
    expect(sendNotificationSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'rule-message',
        summary: 'Pull request merged; card moved to Done.',
        payload: { message: 'Pull request merged; card moved to Done.' },
      }),
      expect.objectContaining({
        ifActive: { behavior: 'deliver' },
        ifIdle: { behavior: 'wake' },
      }),
    );
    const requestContext = sendNotificationSignal.mock.calls[0]?.[1]?.requestContext;
    expect(requestContext?.get('user')).toEqual({ workosId: 'user-1', organizationId: 'org-1' });
  });

  it('retries the skill kickoff when the signal is persisted without starting a run', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { item, transitionService } = await queueDecision(storage, {
      type: 'invokeSkill',
      role: 'work',
      skillName: 'understand-issue',
      idempotencyKey: 'skill-persist-only',
    });
    const { controller, session } = createSession();
    await storage.prepareRunStart({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      workItem: {
        id: item.id,
        input: {
          externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:1' },
          title: 'Fix issue',
          stages: ['execute'],
          sessions: {},
          metadata: {},
        },
      },
      role: 'work',
      session: { sessionId: 'session-1', branch: 'factory/issue-1', threadId: 'thread-1' },
      resourceId: PROJECT_ID,
      kickoffKey: 'kickoff-null',
      kickoffMessage: null,
    });
    session.sendSignal.mockImplementationOnce(() => ({
      accepted: Promise.resolve({ accepted: true as const, action: 'blocked' }),
    }));
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      isAutoRunEnabled: async () => true,
      transitionService,
      storage,
      ownerId: 'worker-1',
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    const [record] = await storage.listDeferredDecisions('org-1', PROJECT_ID);
    expect(record?.status).toBe('retry');
    expect(record?.lastError).toContain('did not reach the agent');
  });

  it('retries the skill kickoff when acceptance carries no delivery action', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { item, transitionService } = await queueDecision(storage, {
      type: 'invokeSkill',
      role: 'work',
      skillName: 'understand-issue',
      idempotencyKey: 'skill-no-action',
    });
    const { controller, session } = createSession();
    await storage.prepareRunStart({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      workItem: {
        id: item.id,
        input: {
          externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:1' },
          title: 'Fix issue',
          stages: ['execute'],
          sessions: {},
          metadata: {},
        },
      },
      role: 'work',
      session: { sessionId: 'session-1', branch: 'factory/issue-1', threadId: 'thread-1' },
      resourceId: PROJECT_ID,
      kickoffKey: 'kickoff-no-action',
      kickoffMessage: null,
    });
    // A session that resolves acceptance without an action never verified
    // delivery — with `requireDelivery` set that must count as a failure.
    session.sendSignal.mockImplementationOnce(() => ({
      accepted: Promise.resolve({ accepted: true as const, action: undefined }),
    }));
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      isAutoRunEnabled: async () => true,
      transitionService,
      storage,
      ownerId: 'worker-1',
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    const [record] = await storage.listDeferredDecisions('org-1', PROJECT_ID);
    expect(record?.status).toBe('retry');
    expect(record?.lastError).toContain('did not reach the agent');
  });

  it('prepares a missing binding before dispatching a rule-driven skill', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { item, transitionService } = await queueDecision(storage, {
      type: 'invokeSkill',
      role: 'triage',
      skillName: 'understand-issue',
      idempotencyKey: 'skill-auto-start',
    });
    const { controller, session } = createSession();
    const prepareBinding = vi.fn(async () => {
      await storage.prepareRunStart({
        orgId: 'org-1',
        userId: 'user-1',
        factoryProjectId: PROJECT_ID,
        workItem: {
          id: item.id,
          input: {
            externalSource: item.externalSource,
            title: item.title,
            stages: ['intake'],
            sessions: {},
            metadata: item.metadata,
          },
        },
        role: 'triage',
        session: { sessionId: 'session-1', branch: 'factory/issue-1', threadId: 'thread-1' },
        resourceId: PROJECT_ID,
        kickoffKey: 'skill-auto-start',
        kickoffMessage: null,
      });
    });
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      isAutoRunEnabled: async () => true,
      transitionService,
      storage,
      ownerId: 'worker-1',
      prepareBinding,
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    expect(prepareBinding).toHaveBeenCalledWith(
      expect.objectContaining({ item: expect.objectContaining({ id: item.id }), role: 'triage' }),
    );
    expect(session.sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({ contents: expect.stringContaining('<skill name="understand-issue">') }),
      { requestContext: expect.anything(), requireDelivery: true },
    );
  });

  it('recreates a missing controller session before dispatching to an active binding', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { item, transitionService } = await queueDecision(storage, {
      type: 'invokeSkill',
      role: 'triage',
      skillName: 'understand-issue',
      idempotencyKey: 'skill-session-recovery',
    });
    await storage.prepareRunStart({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      workItem: {
        id: item.id,
        input: {
          externalSource: item.externalSource,
          title: item.title,
          stages: ['intake'],
          sessions: {},
          metadata: item.metadata,
        },
      },
      role: 'triage',
      session: { sessionId: 'session-1', branch: 'factory/issue-1', threadId: 'thread-1' },
      resourceId: PROJECT_ID,
      kickoffKey: 'skill-session-recovery',
      kickoffMessage: null,
    });
    const { controller, session } = createSession();
    controller.getSessionByResource.mockResolvedValueOnce(undefined as never).mockResolvedValue(session);
    const prepareBinding = vi.fn(async () => {
      await storage.prepareRunStart({
        orgId: 'org-1',
        userId: 'user-1',
        factoryProjectId: PROJECT_ID,
        workItem: {
          id: item.id,
          input: {
            externalSource: item.externalSource,
            title: item.title,
            stages: ['intake'],
            sessions: {},
            metadata: item.metadata,
          },
        },
        role: 'triage',
        session: { sessionId: 'session-1', branch: 'factory/issue-1', threadId: 'thread-2' },
        resourceId: PROJECT_ID,
        kickoffKey: 'skill-session-recovery-replacement',
        kickoffMessage: null,
      });
    });
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      isAutoRunEnabled: async () => true,
      transitionService,
      storage,
      ownerId: 'worker-1',
      prepareBinding,
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    expect(prepareBinding).toHaveBeenCalledWith(
      expect.objectContaining({ item: expect.objectContaining({ id: item.id }), role: 'triage' }),
    );
    expect(session.thread.switch).toHaveBeenCalledWith({ threadId: 'thread-2' });
    expect(session.sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({ contents: expect.stringContaining('<skill name="understand-issue">') }),
      { requestContext: expect.anything(), requireDelivery: true },
    );
  });

  it('does not deliver a skill kickoff twice after completion ambiguity', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { item, transitionService } = await queueDecision(storage, {
      type: 'invokeSkill',
      role: 'triage',
      skillName: 'understand-issue',
      idempotencyKey: 'skill-ambiguity',
    });
    await storage.prepareRunStart({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      workItem: {
        id: item.id,
        input: {
          externalSource: item.externalSource,
          title: item.title,
          stages: ['intake'],
          sessions: {},
          metadata: item.metadata,
        },
      },
      role: 'triage',
      session: { sessionId: 'session-1', branch: 'factory/issue-1', threadId: 'thread-1' },
      resourceId: PROJECT_ID,
      kickoffKey: 'skill-ambiguity',
      kickoffMessage: null,
    });
    const [decision] = await storage.listDeferredDecisions('org-1', PROJECT_ID);
    const { controller, session } = createSession();
    vi.spyOn(storage, 'completeDeferredDecision').mockRejectedValueOnce(new Error('database unavailable'));
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      isAutoRunEnabled: async () => true,
      transitionService,
      storage,
      ownerId: 'worker-1',
    });

    const first = new Date('2030-01-01T00:00:00Z');
    await dispatcher.runOnce(first);
    await dispatcher.runOnce(new Date(first.getTime() + 2_000));

    expect(session.sendSignal).toHaveBeenCalledTimes(1);
    expect(session.sendSignal).toHaveBeenCalledWith(expect.objectContaining({ id: decision?.id }), {
      requestContext: expect.anything(),
      requireDelivery: true,
    });
    expect((await storage.listDeferredDecisions('org-1', PROJECT_ID))[0]?.status).toBe('succeeded');
  });

  it('retries after post-delivery completion ambiguity without delivering the notification twice', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { item, transitionService } = await queueDecision(storage, {
      type: 'sendMessage',
      role: 'work',
      message: 'Review completion.',
      idempotencyKey: 'message-1',
    });
    const { controller, delivered, sendNotificationSignal } = createSession();
    await storage.prepareRunStart({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      workItem: {
        id: item.id,
        input: {
          externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:1' },
          title: 'Fix issue',
          stages: ['execute'],
          sessions: {},
          metadata: {},
        },
      },
      role: 'work',
      session: { sessionId: 'session-1', branch: 'factory/issue-1', threadId: 'thread-1' },
      resourceId: PROJECT_ID,
      kickoffKey: 'kickoff-null',
      kickoffMessage: null,
    });
    vi.spyOn(storage, 'completeDeferredDecision').mockRejectedValueOnce(new Error('database unavailable'));
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      isAutoRunEnabled: async () => true,
      transitionService,
      storage,
      ownerId: 'worker-1',
    });

    const first = new Date('2030-01-01T00:00:00Z');
    await dispatcher.runOnce(first);
    await dispatcher.runOnce(new Date(first.getTime() + 2_000));

    expect(sendNotificationSignal).toHaveBeenCalledTimes(2);
    expect(delivered).toEqual(['message-1']);
    expect((await storage.listDeferredDecisions('org-1', PROJECT_ID))[0]?.status).toBe('succeeded');
  });

  it('fills a missing parent when reusing a linked item created before provenance was available', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const parent = await createItem(storage);
    const orphan = await storage.upsert({
      orgId: 'org-1',
      userId: 'webhook',
      factoryProjectId: PROJECT_ID,
      input: {
        externalSource: {
          integrationId: 'github',
          type: 'pull-request',
          externalId: 'github-pr:2',
          url: 'https://github.com/acme/repo/pull/2',
        },
        title: 'Linked PR',
        stages: ['intake'],
        sessions: {},
        metadata: {},
      },
    });
    const rules = defaultFactoryRules({
      version: 'rules-v1',
      overrides: {
        work: {
          execute: {
            issue: {
              onEnter: () => ({
                type: 'upsertLinkedWorkItem',
                idempotencyKey: 'linked-pr-1',
                board: 'work',
                source: 'github-pr',
                sourceKey: 'github-pr:2',
                title: 'Linked PR',
                url: 'https://github.com/acme/repo/pull/2',
                stage: 'intake',
              }),
            },
          },
        },
      },
    });
    const transitionService = new FactoryTransitionService({ storage, rules });
    await transitionService.transition({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      workItemId: parent.id,
      board: 'work',
      stage: 'execute',
      expectedRevision: parent.revision,
      actor: { type: 'human', id: 'user-1' },
      ingress: { type: 'human', identity: 'move-linked' },
      cause: 'test',
    });
    const { controller } = createSession();
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      isAutoRunEnabled: async () => true,
      transitionService,
      storage,
      ownerId: 'worker-1',
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    expect((await storage.get({ orgId: 'org-1', id: orphan.item.id }))?.parentWorkItemId).toBe(parent.id);
  });

  it('resolves provenance recorded after a parentless PR decision was committed but before materialization', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const parent = await createItem(storage);
    await storage.commitRuleEvaluation({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      workItemId: null,
      ingress: { identity: 'github:pull-request:2:opened', triggerType: 'pull_request.opened' },
      ruleSetVersion: 'rules-v1',
      expectedRevision: null,
      actor: { type: 'system', id: 'rules' },
      outcome: { status: 'accepted' },
      decisions: [
        {
          type: 'upsertLinkedWorkItem',
          idempotencyKey: 'linked-pr-late-provenance',
          board: 'review',
          source: 'github-pr',
          sourceKey: 'github-pr:2',
          title: 'Linked PR',
          url: 'https://github.com/acme/repo/pull/2',
          stage: 'intake',
          metadata: { githubRepositoryId: 7, githubPullRequestNumber: 2 },
        },
      ],
      causalChain: [],
      now: new Date('2030-01-01T00:00:00Z'),
    });
    const resolveLinkedWorkItemParentId = vi.fn().mockResolvedValue(parent.id);
    const transitionService = new FactoryTransitionService({
      storage,
      rules: defaultFactoryRules({ version: 'rules-v1' }),
    });
    const { controller } = createSession();
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      isAutoRunEnabled: async () => true,
      transitionService,
      storage,
      ownerId: 'worker-1',
      resolveLinkedWorkItemParentId,
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:01Z'));

    const linked = (await storage.list({ orgId: 'org-1', factoryProjectId: PROJECT_ID })).find(
      item => item.externalSource?.externalId === 'github-pr:2',
    );
    expect(resolveLinkedWorkItemParentId).toHaveBeenCalledWith({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      decision: expect.objectContaining({ source: 'github-pr', sourceKey: 'github-pr:2' }),
    });
    expect(linked?.parentWorkItemId).toBe(parent.id);
  });

  it('does not parent a linked card to itself when a poll re-emits "opened" for an already-filed PR', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { item: card } = await storage.upsert({
      orgId: 'org-1',
      userId: 'test',
      factoryProjectId: PROJECT_ID,
      input: {
        externalSource: {
          integrationId: 'github',
          type: 'pull-request',
          externalId: 'github-pr:3',
          url: 'https://github.com/acme/repo/pull/3',
        },
        parentWorkItemId: null,
        title: 'Linked PR',
        stages: ['intake'],
        sessions: {},
        metadata: {},
      },
      reuseMode: 'preserve',
    });
    // The second evaluation resolves the PR card itself as the triggering item.
    await storage.commitRuleEvaluation({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      workItemId: card.id,
      ingress: { identity: 'poll:7:pull-request:3', triggerType: 'pull_request.opened' },
      ruleSetVersion: 'rules-v1',
      expectedRevision: card.revision,
      actor: { type: 'system', id: 'rules' },
      outcome: { status: 'accepted' },
      decisions: [
        {
          type: 'upsertLinkedWorkItem',
          idempotencyKey: 'linked-pr-polled-again',
          board: 'review',
          source: 'github-pr',
          sourceKey: 'github-pr:3',
          title: 'Linked PR',
          url: 'https://github.com/acme/repo/pull/3',
          stage: 'intake',
          metadata: { githubRepositoryId: 7, githubPullRequestNumber: 3 },
        },
      ],
      causalChain: [],
      now: new Date('2030-01-01T00:00:00Z'),
    });
    const transitionService = new FactoryTransitionService({
      storage,
      rules: defaultFactoryRules({ version: 'rules-v1' }),
    });
    const { controller } = createSession();
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      isAutoRunEnabled: async () => true,
      transitionService,
      storage,
      ownerId: 'worker-1',
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:01Z'));

    const pending = await storage.listDeferredDecisions('org-1', PROJECT_ID);
    expect(pending.map(record => record.status)).toEqual(['succeeded']);
    expect(await storage.list({ orgId: 'org-1', factoryProjectId: PROJECT_ID })).toHaveLength(1);
    expect((await storage.get({ orgId: 'org-1', id: card.id }))?.parentWorkItemId).toBeNull();
  });

  it('backfills missing source metadata on an already-filed card without overwriting or adopting it', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { item: card } = await storage.upsert({
      orgId: 'org-1',
      userId: 'test',
      factoryProjectId: PROJECT_ID,
      input: {
        externalSource: {
          integrationId: 'github',
          type: 'pull-request',
          externalId: 'github-pr:3',
          url: 'https://github.com/acme/repo/pull/3',
        },
        parentWorkItemId: null,
        title: 'Linked PR',
        stages: ['review'],
        sessions: {},
        metadata: { author: 'human-edited' },
      },
      reuseMode: 'preserve',
    });
    await storage.commitRuleEvaluation({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      workItemId: card.id,
      ingress: { identity: 'poll:7:pull-request:3', triggerType: 'pull_request.opened' },
      ruleSetVersion: 'rules-v1',
      expectedRevision: card.revision,
      actor: { type: 'system', id: 'rules' },
      outcome: { status: 'accepted' },
      decisions: [
        {
          type: 'upsertLinkedWorkItem',
          idempotencyKey: 'linked-pr-backfill',
          board: 'review',
          source: 'github-pr',
          sourceKey: 'github-pr:3',
          title: 'Linked PR',
          url: 'https://github.com/acme/repo/pull/3',
          stage: 'intake',
          metadata: { author: 'octocat', sourceCreatedAt: '2029-12-01T00:00:00Z' },
        },
      ],
      causalChain: [],
      now: new Date('2030-01-01T00:00:00Z'),
    });
    const transitionService = new FactoryTransitionService({
      storage,
      rules: defaultFactoryRules({ version: 'rules-v1' }),
    });
    const { controller } = createSession();
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      isAutoRunEnabled: async () => true,
      transitionService,
      storage,
      ownerId: 'worker-1',
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:01Z'));

    const pending = await storage.listDeferredDecisions('org-1', PROJECT_ID);
    expect(pending.map(record => record.status)).toEqual(['succeeded']);
    const updated = await storage.get({ orgId: 'org-1', id: card.id });
    expect(updated?.metadata).toMatchObject({ author: 'human-edited', sourceCreatedAt: '2029-12-01T00:00:00Z' });
    expect(updated?.metadata?.[FACTORY_RULE_MATERIALIZATION_KEY]).toBeUndefined();
    // Preserved: not re-entered into intake.
    expect(updated?.stages).toEqual(['review']);
  });

  it('recovers linked-item materialization after an upsert crash and fires Intake onEnter exactly once', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const parent = await createItem(storage);
    const intakeEntered = vi.fn();
    const rules = defaultFactoryRules({
      version: 'rules-v1',
      overrides: {
        work: {
          execute: {
            issue: {
              onEnter: () => ({
                type: 'upsertLinkedWorkItem',
                idempotencyKey: 'linked-1',
                board: 'work',
                source: 'github-issue',
                sourceKey: 'github-issue:2',
                title: 'Linked issue',
                url: null,
                stage: 'intake',
              }),
            },
          },
          intake: { issue: { onEnter: intakeEntered } },
        },
      },
    });
    const transitionService = new FactoryTransitionService({ storage, rules });
    await transitionService.transition({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      workItemId: parent.id,
      board: 'work',
      stage: 'execute',
      expectedRevision: parent.revision,
      actor: { type: 'human', id: 'user-1' },
      ingress: { type: 'human', identity: 'move-linked' },
      cause: 'test',
    });
    let failInitialEntry = true;
    const recoveringTransition = {
      transition: vi.fn(async (request: Parameters<FactoryTransitionService['transition']>[0]) => {
        if (request.initialEntry && failInitialEntry) {
          failInitialEntry = false;
          throw new Error('crash after upsert');
        }
        return transitionService.transition(request);
      }),
    };
    const { controller } = createSession();
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      isAutoRunEnabled: async () => true,
      transitionService: recoveringTransition,
      storage,
      ownerId: 'worker-1',
    });
    const first = new Date('2030-01-01T00:00:00Z');

    await dispatcher.runOnce(first);
    await dispatcher.runOnce(new Date(first.getTime() + 2_000));

    const linked = (await storage.list({ orgId: 'org-1', factoryProjectId: PROJECT_ID })).find(
      item => item.externalSource?.externalId === 'github-issue:2',
    );
    expect(linked).toMatchObject({ parentWorkItemId: parent.id, stages: ['intake'] });
    expect(intakeEntered).toHaveBeenCalledTimes(1);
    expect((await storage.listDeferredDecisions('org-1', PROJECT_ID))[0]?.status).toBe('succeeded');
  });

  it('removes a newly materialized linked item when its initial Intake entry is rejected', async () => {
    const { workItems: storage } = await createFactoryStorageForTests();
    const parent = await createItem(storage);
    const rules = defaultFactoryRules({
      version: 'rules-v1',
      overrides: {
        work: {
          execute: {
            issue: {
              onEnter: () => ({
                type: 'upsertLinkedWorkItem',
                idempotencyKey: 'linked-rejected',
                board: 'work',
                source: 'github-issue',
                sourceKey: 'github-issue:2',
                title: 'Rejected linked issue',
                url: null,
                stage: 'intake',
              }),
            },
          },
          intake: {
            issue: {
              onEnter: () => ({ type: 'reject', code: 'forbidden', reason: 'Intake is closed.' }),
            },
          },
        },
      },
    });
    const transitionService = new FactoryTransitionService({ storage, rules });
    await transitionService.transition({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      workItemId: parent.id,
      board: 'work',
      stage: 'execute',
      expectedRevision: parent.revision,
      actor: { type: 'human', id: 'user-1' },
      ingress: { type: 'human', identity: 'move-linked-rejected' },
      cause: 'test',
    });
    const { controller } = createSession();
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      isAutoRunEnabled: async () => true,
      transitionService,
      storage,
      ownerId: 'worker-1',
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    expect(
      (await storage.list({ orgId: 'org-1', factoryProjectId: PROJECT_ID })).find(
        item => item.externalSource?.externalId === 'github-issue:2',
      ),
    ).toBeUndefined();
    expect((await storage.listDeferredDecisions('org-1', PROJECT_ID))[0]).toMatchObject({
      status: 'retry',
      lastError: 'forbidden: Intake is closed.',
    });
  });

  it('does not replay Intake onEnter when a linked upsert reuses an independently-created item', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const parent = await createItem(storage);
    await createItem(storage, 'github-issue:2');
    const intakeEntered = vi.fn();
    const rules = defaultFactoryRules({
      version: 'rules-v1',
      overrides: {
        work: {
          execute: {
            issue: {
              onEnter: () => ({
                type: 'upsertLinkedWorkItem',
                idempotencyKey: 'linked-1',
                board: 'work',
                source: 'github-issue',
                sourceKey: 'github-issue:2',
                title: 'Linked issue',
                url: null,
                stage: 'intake',
              }),
            },
          },
          intake: { issue: { onEnter: intakeEntered } },
        },
      },
    });
    const transitionService = new FactoryTransitionService({ storage, rules });
    await transitionService.transition({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      workItemId: parent.id,
      board: 'work',
      stage: 'execute',
      expectedRevision: parent.revision,
      actor: { type: 'human', id: 'user-1' },
      ingress: { type: 'human', identity: 'move-linked' },
      cause: 'test',
    });
    const { controller } = createSession();
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      isAutoRunEnabled: async () => true,
      transitionService,
      storage,
      ownerId: 'worker-1',
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    expect(intakeEntered).not.toHaveBeenCalled();
    expect((await storage.listDeferredDecisions('org-1', PROJECT_ID))[0]?.status).toBe('succeeded');
  });

  it('rejects a chained effect at the bounded causal depth before external dispatch', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage);
    const rules = defaultFactoryRules({
      version: 'rules-v1',
      overrides: {
        work: {
          execute: {
            issue: {
              onEnter: () => ({
                type: 'sendMessage',
                role: 'work',
                message: 'Too deep.',
                idempotencyKey: 'message-deep',
              }),
            },
          },
        },
      },
    });
    const transitionService = new FactoryTransitionService({ storage, rules });
    await transitionService.transition({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      workItemId: item.id,
      board: 'work',
      stage: 'execute',
      expectedRevision: item.revision,
      actor: { type: 'system', id: 'test' },
      ingress: { type: 'rule', identity: 'deep-chain' },
      cause: 'test',
      causalChain: Array.from({ length: 8 }, (_, index) => ({
        ingressId: `ancestor-${index}`,
        decisionType: 'transition' as const,
      })),
    });
    const { controller, sendNotificationSignal } = createSession();
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      isAutoRunEnabled: async () => true,
      transitionService,
      storage,
      ownerId: 'worker-1',
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    expect(sendNotificationSignal).not.toHaveBeenCalled();
    expect((await storage.listDeferredDecisions('org-1', PROJECT_ID))[0]).toMatchObject({
      status: 'retry',
      lastError: 'Factory rule causal depth exceeded.',
    });
  });

  it('keeps live notification transport failures retryable', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { item, transitionService } = await queueDecision(storage, {
      type: 'sendMessage',
      role: 'work',
      message: 'Review completion.',
      idempotencyKey: 'message-transport-failure',
    });
    const { controller, sendNotificationSignal } = createSession();
    let resolvePersistence = () => {};
    const persistence = new Promise<void>(resolve => {
      resolvePersistence = resolve;
    });
    sendNotificationSignal
      .mockImplementationOnce(() => {
        throw new Error('socket closed synchronously');
      })
      .mockImplementationOnce(async () => ({
        persisted: persistence,
        accepted: Promise.reject(new Error('acceptance failed before persistence')),
      }))
      .mockRejectedValue(new Error('ECONNRESET'));
    await storage.prepareRunStart({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      workItem: {
        id: item.id,
        input: {
          externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:1' },
          title: 'Fix issue',
          stages: ['execute'],
          sessions: {},
          metadata: {},
        },
      },
      role: 'work',
      session: { sessionId: 'session-1', branch: 'factory/issue-1', threadId: 'thread-1' },
      resourceId: PROJECT_ID,
      kickoffKey: 'kickoff-transport-failure',
      kickoffMessage: null,
    });
    const dispatcher = new FactoryDecisionDispatcher({
      controller,
      isAutoRunEnabled: async () => true,
      transitionService,
      storage,
      ownerId: 'worker-1',
    });
    const start = new Date('2030-01-01T00:00:00Z');

    await dispatcher.runOnce(start);
    expect((await storage.listDeferredDecisions('org-1', PROJECT_ID))[0]).toMatchObject({
      status: 'retry',
      attempts: 1,
      failureCode: 'notification_delivery_failed',
    });
    const secondAttempt = dispatcher.runOnce(new Date(start.getTime() + 120_000));
    await new Promise<void>(resolve => setImmediate(resolve));
    resolvePersistence();
    await secondAttempt;
    expect((await storage.listDeferredDecisions('org-1', PROJECT_ID))[0]).toMatchObject({
      status: 'retry',
      attempts: 2,
      failureCode: 'notification_delivery_failed',
    });
    for (let attempt = 2; attempt < 5; attempt += 1) {
      await dispatcher.runOnce(new Date(start.getTime() + attempt * 120_000));
    }

    expect((await storage.listDeferredDecisions('org-1', PROJECT_ID))[0]).toMatchObject({
      status: 'failed',
      attempts: 5,
      failureCode: 'notification_delivery_failed',
      failureOccurrence: 1,
    });
  });
  it('backs off missing bindings and reaches a bounded terminal failure with sanitized errors', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    // prepareBinding promises delivery, so a binding that cannot be prepared
    // is a real failure — unlike the plain message above that goes quiet.
    const { transitionService } = await queueDecision(storage, {
      type: 'sendMessage',
      role: 'work',
      message: 'Review completion.',
      prepareBinding: true,
      idempotencyKey: 'message-1',
    });
    const { controller } = createSession();
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      isAutoRunEnabled: async () => true,
      transitionService,
      storage,
      ownerId: 'worker-1',
    });
    const start = new Date('2030-01-01T00:00:00Z');

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await dispatcher.runOnce(new Date(start.getTime() + attempt * 120_000));
    }

    const [decision] = await storage.listDeferredDecisions('org-1', PROJECT_ID);
    expect(decision).toMatchObject({
      status: 'failed',
      attempts: 5,
      failureCode: 'session_unavailable',
      failureOccurrence: 1,
    });
    expect(decision!.lastError).toBe('No active Factory binding for role work.');
    expect(decision!.lastError!.length).toBeLessThanOrEqual(512);
  });

  /** Prepare a prompt-kickoff pending start bound to the stubbed session. */
  async function preparePromptKickoff(storage: WorkItemsStorage, controller: unknown) {
    const rules = defaultFactoryRules({ version: 'rules-v1' });
    const transitionService = new FactoryTransitionService({ storage, rules });
    const sourceControl = {
      sessions: {
        getBySessionId: async () => ({
          id: 'source-session-1',
          sessionId: 'session-1',
          projectRepositoryId: 'project-repository-1',
          orgId: 'org-1',
          userId: 'user-1',
          branch: 'factory/issue-1',
          baseBranch: 'main',
        }),
      },
      projectRepositories: { get: async ({ id }: { id: string }) => ({ id, connectionId: 'connection-1' }) },
      connections: { get: async () => ({ factoryProjectId: PROJECT_ID }) },
    };
    const coordinator = new FactoryStartCoordinator(
      controller as never,
      storage,
      transitionService,
      sourceControl as never,
    );
    await coordinator.prepare({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      sessionId: 'session-1',
      threadTitle: 'Fix issue',
      kickoffKey: 'kickoff-1',
      invocation: { type: 'prompt', prompt: 'Investigate the issue.' },
      destinationStage: 'triage',
      workItem: {
        role: 'work',
        input: {
          externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:1' },
          title: 'Fix issue',
          stages: ['intake'],
          sessions: {},
          metadata: {},
        },
      },
    });
    return { transitionService };
  }

  it('recovers and dispatches a prepared kickoff after the coordinator returns', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { controller, delivered, sendNotificationSignal } = createSession();
    const { transitionService } = await preparePromptKickoff(storage, controller);
    const primeCredentials = vi.fn(async () => {});
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      isAutoRunEnabled: async () => true,
      transitionService,
      storage,
      ownerId: 'worker-1',
      primeCredentials,
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));
    const restarted = new FactoryDecisionDispatcher({
      controller: controller as never,
      isAutoRunEnabled: async () => true,
      transitionService,
      storage,
      ownerId: 'worker-2',
    });
    await restarted.runOnce(new Date('2030-01-01T00:01:00Z'));

    expect(delivered).toEqual(['factory-kickoff:kickoff-1']);
    expect(sendNotificationSignal).toHaveBeenCalledTimes(1);
    // Kickoff wake runs build the Factory workspace, which requires the
    // authenticated session owner on the request context.
    expect(primeCredentials).toHaveBeenCalledWith({ orgId: 'org-1', userId: 'user-1' });
    const kickoffOptions = sendNotificationSignal.mock.calls[0]![1];
    expect(kickoffOptions?.requestContext?.get('user')).toEqual({ workosId: 'user-1', organizationId: 'org-1' });
    expect((await storage.listPendingStarts('org-1', PROJECT_ID))[0]?.status).toBe('sent');
  });

  it('redelivers a kickoff notification dropped onto an ending run once that run finishes', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    // First send lands `deliver` on a run that then ends without acting on the
    // kickoff; the dispatcher must wait for that run's end and redeliver into
    // the idle session instead of completing on the delivery ack.
    const { controller, delivered, getAgentEndListenerCount } = createSession(undefined, {
      notificationResponses: [{ action: 'deliver', endRun: true }, { action: 'wake' }],
    });
    const { transitionService } = await preparePromptKickoff(storage, controller);
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      isAutoRunEnabled: async () => true,
      transitionService,
      storage,
      ownerId: 'worker-1',
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    expect(delivered).toEqual(['factory-kickoff:kickoff-1', 'factory-kickoff:kickoff-1:retry:1']);
    expect((await storage.listPendingStarts('org-1', PROJECT_ID))[0]?.status).toBe('sent');
    expect(getAgentEndListenerCount()).toBe(0);
  });

  it('fails a kickoff for retry when the delivered run never ends', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { controller } = createSession(undefined, {
      notificationResponses: [{ action: 'deliver' }],
    });
    const { transitionService } = await preparePromptKickoff(storage, controller);
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      isAutoRunEnabled: async () => true,
      transitionService,
      storage,
      ownerId: 'worker-1',
      skillCompletionObservationTimeoutMs: 25,
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    // A delivery ack alone must never complete the pending start: the kickoff
    // was consumed by a run that never ended, so the row stays retryable.
    expect((await storage.listPendingStarts('org-1', PROJECT_ID))[0]).toMatchObject({
      status: 'retry',
      lastError: expect.stringContaining('has not ended'),
    });
  });

  it('fails a kickoff for retry when the woken run ends in error', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { controller } = createSession(undefined, { agentEndReason: 'error' });
    const { transitionService } = await preparePromptKickoff(storage, controller);
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      isAutoRunEnabled: async () => true,
      transitionService,
      storage,
      ownerId: 'worker-1',
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    expect((await storage.listPendingStarts('org-1', PROJECT_ID))[0]).toMatchObject({
      status: 'retry',
      lastError: expect.stringContaining('ended in error'),
    });
  });

  it('dispatches a pending start on the first tick even when the deferred-decision queue exceeds the batch size', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    // Deeper than one tick's claim limit: without starts-first claiming these
    // would consume the whole batch and starve the pending start.
    const queueDepth = FACTORY_DISPATCH_CONSTANTS.batchSize + 2;
    for (let index = 0; index < queueDepth; index += 1) {
      await queueDecision(
        storage,
        { type: 'sendMessage', role: 'work', message: 'Continue.', idempotencyKey: `message-${index}` },
        { sourceKey: `github-issue:${100 + index}`, ingress: `move-${index}` },
      );
    }
    const { controller, delivered } = createSession();
    const rules = defaultFactoryRules({ version: 'rules-v1' });
    const transitionService = new FactoryTransitionService({ storage, rules });
    const sourceControl = {
      sessions: {
        getBySessionId: async () => ({
          id: 'source-session-1',
          sessionId: 'session-1',
          projectRepositoryId: 'project-repository-1',
          orgId: 'org-1',
          userId: 'user-1',
          branch: 'factory/issue-1',
          baseBranch: 'main',
        }),
      },
      projectRepositories: { get: async ({ id }: { id: string }) => ({ id, connectionId: 'connection-1' }) },
      connections: { get: async () => ({ factoryProjectId: PROJECT_ID }) },
    };
    const coordinator = new FactoryStartCoordinator(
      controller as never,
      storage,
      transitionService,
      sourceControl as never,
    );
    await coordinator.prepare({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      sessionId: 'session-1',
      threadTitle: 'Fix issue',
      kickoffKey: 'kickoff-1',
      invocation: { type: 'prompt', prompt: 'Investigate the issue.' },
      destinationStage: 'triage',
      workItem: {
        role: 'work',
        input: {
          externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:1' },
          title: 'Fix issue',
          stages: ['intake'],
          sessions: {},
          metadata: {},
        },
      },
    });
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      isAutoRunEnabled: async () => true,
      transitionService,
      storage,
      ownerId: 'worker-1',
    });

    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    expect(delivered).toContain('factory-kickoff:kickoff-1');
    expect((await storage.listPendingStarts('org-1', PROJECT_ID))[0]?.status).toBe('sent');
  });

  it('starts one polling loop and stops claiming before shutdown returns', async () => {
    vi.useFakeTimers();
    try {
      const storage = (await createFactoryStorageForTests()).workItems;
      const deferredClaim = vi.spyOn(storage, 'claimDeferredDecisions');
      const pendingClaim = vi.spyOn(storage, 'claimPendingStarts');
      const { controller } = createSession();
      const transitionService = new FactoryTransitionService({
        storage,
        rules: defaultFactoryRules({ version: 'rules-v1' }),
      });
      const dispatcher = new FactoryDecisionDispatcher({
        controller: controller as never,
        isAutoRunEnabled: async () => true,
        transitionService,
        storage,
        ownerId: 'worker-1',
      });

      dispatcher.start();
      dispatcher.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(deferredClaim).toHaveBeenCalledTimes(1);
      expect(pendingClaim).toHaveBeenCalledTimes(1);

      await dispatcher.stop();
      await vi.advanceTimersByTimeAsync(5_000);
      expect(deferredClaim).toHaveBeenCalledTimes(1);
      expect(pendingClaim).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
