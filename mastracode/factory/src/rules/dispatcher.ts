import { randomUUID } from 'node:crypto';

import type { MastraCodeState } from '@mastra/code-sdk/schema';
import type { AgentController, AgentControllerEventListener } from '@mastra/core/agent-controller';
import { RequestContext } from '@mastra/core/request-context';

import { resolveSkillInvocation } from '../skills/service.js';
import type { SkillSession } from '../skills/service.js';
import type {
  FactoryDeferredDecisionRecord,
  FactoryPendingStartRecord,
  FactoryRunBindingRecord,
  WorkItemRow,
  WorkItemsStorage,
} from '../storage/domains/work-items/base.js';
import type { FactoryTransitionService } from './transition-service.js';
import type { FactoryCommitDecision, FactoryRuleActor, FactoryRuleCausalEntry } from './types.js';
import { FACTORY_RULE_STAGES } from './types.js';
import { MAX_FACTORY_RULE_CAUSAL_DEPTH, validateFactoryRuleDecision } from './validation.js';

const LEASE_MS = 30_000;
const POLL_MS = 1_000;
const BATCH_SIZE = 10;
const MAX_ATTEMPTS = 5;
const MAX_ERROR_LENGTH = 512;
const MAX_BACKOFF_MS = 60_000;
const SKILL_COMPLETION_OBSERVATION_TIMEOUT_MS = 10 * 60_000;
// Dispatches can legitimately run for minutes. Woken skill invocations hold
// capacity until their agent run reaches a terminal state; binding preparation
// also runs detached from the poll loop under this concurrency cap.
const MAX_IN_FLIGHT = 25;

function waitForAgentEndOrTimeout(agentEnd: Promise<void>): Promise<boolean> {
  return new Promise(resolve => {
    const timeout = setTimeout(() => resolve(false), SKILL_COMPLETION_OBSERVATION_TIMEOUT_MS);
    timeout.unref?.();
    void agentEnd.then(() => {
      clearTimeout(timeout);
      resolve(true);
    });
  });
}

interface DispatcherSession extends SkillSession {
  thread: {
    switch(input: { threadId: string }): Promise<unknown>;
    listActiveMessages(): Promise<Array<{ id: string }>>;
  };
  abort(): void;
  sendSignal(
    input: { id: string; type: 'user'; tagName: 'user'; contents: string },
    options: { requestContext: RequestContext; requireDelivery?: boolean },
  ): { accepted: Promise<{ accepted: true; runId?: string; action?: string }> };
  subscribe(listener: AgentControllerEventListener): () => void;
}

type FactoryController = Pick<AgentController<MastraCodeState>, 'getSessionByResource'>;

export interface FactoryBindingPreparationInput {
  record: FactoryDeferredDecisionRecord;
  item: WorkItemRow;
  role: string;
}

export interface FactoryDecisionDispatcherOptions {
  controller: FactoryController;
  transitionService: Pick<FactoryTransitionService, 'transition'>;
  storage: WorkItemsStorage;
  ownerId?: string;
  /** `false` parks `invokeSkill` effects as `proposed`; every other effect still runs. */
  isAutoRunEnabled: (tenant: { orgId: string; factoryProjectId: string }) => Promise<boolean>;
  reconcileToolResults?: () => Promise<void>;
  prepareBinding?: (input: FactoryBindingPreparationInput) => Promise<void>;
  primeCredentials?: (tenant: { orgId: string; userId: string }) => Promise<void>;
  maxInFlight?: number;
}

function sanitizeDispatchError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/\b(?:bearer|token|api[-_ ]?key|authorization)\s*[:=]?\s*[^\s,;]+/gi, '[redacted]')
    .slice(0, MAX_ERROR_LENGTH);
}

function retryAt(now: Date, attempts: number): Date {
  return new Date(now.getTime() + Math.min(1_000 * 2 ** Math.max(0, attempts - 1), MAX_BACKOFF_MS));
}

function externalSourceForDecision(decision: Extract<FactoryCommitDecision, { type: 'upsertLinkedWorkItem' }>) {
  const [integrationId, type] =
    decision.source === 'github-pr'
      ? ['github', 'pull-request']
      : decision.source === 'github-issue'
        ? ['github', 'issue']
        : decision.source === 'linear-issue'
          ? ['linear', 'issue']
          : ['factory', 'manual'];
  return { integrationId, type, externalId: decision.sourceKey, url: decision.url ?? undefined };
}

function deferredActor(record: FactoryDeferredDecisionRecord): FactoryRuleActor {
  const actor = record.actor;
  if (
    actor?.type === 'github' &&
    typeof actor.login === 'string' &&
    typeof actor.trusted === 'boolean' &&
    typeof actor.factoryAuthored === 'boolean'
  ) {
    return {
      type: 'github',
      login: actor.login,
      trusted: actor.trusted,
      factoryAuthored: actor.factoryAuthored,
    };
  }
  return { type: 'system', id: 'factory-rule-dispatcher' };
}

function leaseIdentity(
  record: Pick<FactoryDeferredDecisionRecord | FactoryPendingStartRecord, 'id' | 'orgId' | 'factoryProjectId'>,
  ownerId: string,
) {
  return { id: record.id, orgId: record.orgId, factoryProjectId: record.factoryProjectId, ownerId };
}

async function awaitNotification(
  result: Awaited<ReturnType<SkillSession['sendNotificationSignal']>>,
  requireDelivery = false,
): Promise<void> {
  await result.persisted;
  if (!result.accepted) {
    if (requireDelivery) throw new Error('Factory notification was persisted without agent delivery.');
    return;
  }
  const accepted = await result.accepted;
  if (!requireDelivery) return;
  if (accepted.action === 'wake') {
    await accepted.output.consumeStream();
    return;
  }
  if (accepted.action !== 'deliver') {
    throw new Error(`Factory notification did not reach the agent (${String(accepted.action)}).`);
  }
}

export class FactoryDecisionDispatcher {
  readonly #controller: FactoryController;
  readonly #transitionService: Pick<FactoryTransitionService, 'transition'>;
  readonly #storage: WorkItemsStorage;
  readonly #ownerId: string;
  readonly #isAutoRunEnabled: (tenant: { orgId: string; factoryProjectId: string }) => Promise<boolean>;
  readonly #reconcileToolResults?: () => Promise<void>;
  readonly #prepareBinding?: (input: FactoryBindingPreparationInput) => Promise<void>;
  readonly #primeCredentials?: (tenant: { orgId: string; userId: string }) => Promise<void>;
  readonly #maxInFlight: number;
  #timer?: ReturnType<typeof setInterval>;
  #activeClaim?: Promise<void>;
  readonly #inFlight = new Set<Promise<void>>();

  constructor(options: FactoryDecisionDispatcherOptions) {
    this.#controller = options.controller;
    this.#transitionService = options.transitionService;
    this.#storage = options.storage;
    this.#ownerId = options.ownerId ?? `factory-dispatcher:${randomUUID()}`;
    this.#isAutoRunEnabled = options.isAutoRunEnabled;
    this.#reconcileToolResults = options.reconcileToolResults;
    this.#prepareBinding = options.prepareBinding;
    this.#primeCredentials = options.primeCredentials;
    const maxInFlight = options.maxInFlight ?? MAX_IN_FLIGHT;
    this.#maxInFlight = Number.isFinite(maxInFlight) && maxInFlight > 0 ? Math.floor(maxInFlight) : MAX_IN_FLIGHT;
  }

  start(): void {
    if (this.#timer) return;
    void this.#tick();
    this.#timer = setInterval(() => void this.#tick(), POLL_MS);
    this.#timer.unref?.();
  }

  async stop(): Promise<void> {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = undefined;
    await this.#activeClaim;
    await Promise.allSettled([...this.#inFlight]);
  }

  async runOnce(now = new Date()): Promise<void> {
    await Promise.all(await this.#claimAndStart(now));
  }

  /**
   * Claims a batch and starts dispatches without awaiting their completion.
   * Dispatches can legitimately take minutes (skill kickoffs consume the
   * agent's run stream; binding preparation provisions sandboxes), so awaiting
   * them here would freeze the poll loop and starve every other queued
   * decision. In-flight records stay protected from re-claim by lease renewal.
   */
  async #claimAndStart(now: Date): Promise<Array<Promise<void>>> {
    await this.#reconcileToolResults?.();
    const capacity = this.#maxInFlight - this.#inFlight.size;
    if (capacity <= 0) return [];
    const limit = Math.min(BATCH_SIZE, capacity);
    const leaseExpiresAt = new Date(now.getTime() + LEASE_MS);
    // Starts are claimed before deferred decisions: a pending start is a user
    // waiting on a brand-new session, while a deferred decision is a background
    // continuation of one that is already running. A deep decision queue must
    // never starve new sessions out of the tick.
    const starts = await this.#storage.claimPendingStarts({
      ownerId: this.#ownerId,
      now,
      leaseExpiresAt,
      limit,
    });
    const decisionsLimit = limit - starts.length;
    const decisions =
      decisionsLimit > 0
        ? await this.#storage.claimDeferredDecisions({
            ownerId: this.#ownerId,
            now,
            leaseExpiresAt,
            limit: decisionsLimit,
          })
        : [];
    return [
      ...starts.map(start => this.#track(this.#dispatchPendingStart(start, now))),
      ...decisions.map(decision => this.#track(this.#dispatchDecision(decision, now))),
    ];
  }

  #track(dispatch: Promise<void>): Promise<void> {
    this.#inFlight.add(dispatch);
    void dispatch.catch(() => {}).then(() => this.#inFlight.delete(dispatch));
    return dispatch;
  }

  async #tick(): Promise<void> {
    if (this.#activeClaim) return;
    this.#activeClaim = this.#claimAndStart(new Date()).then(
      dispatches => {
        for (const dispatch of dispatches) {
          dispatch.catch(error => {
            console.error('Factory decision dispatch failed', sanitizeDispatchError(error));
          });
        }
      },
      error => {
        console.error('Factory decision dispatch cycle failed', sanitizeDispatchError(error));
      },
    );
    try {
      await this.#activeClaim;
    } finally {
      this.#activeClaim = undefined;
    }
  }

  async #dispatchDecision(record: FactoryDeferredDecisionRecord, now: Date): Promise<void> {
    try {
      const decision = validateFactoryRuleDecision(record.decision, record.causalChain.length);
      if (decision.type === 'reject') throw new Error('Deferred Factory decisions cannot reject.');
      if (await this.#needsApproval(record, decision)) {
        const proposed = await this.#storage.proposeDeferredDecision(leaseIdentity(record, this.#ownerId), new Date());
        if (!proposed) throw new Error('Factory decision lease was lost before approval could be requested.');
        return;
      }
      await this.#withLease(
        async leaseExpiresAt =>
          this.#storage.renewDeferredDecisionLease(leaseIdentity(record, this.#ownerId), leaseExpiresAt),
        async () => this.#executeDecision(record, decision),
      );
      const completed = await this.#storage.completeDeferredDecision(leaseIdentity(record, this.#ownerId), new Date());
      if (!completed) throw new Error('Factory decision lease was lost before completion.');
    } catch (error) {
      const terminal = record.attempts >= MAX_ATTEMPTS;
      await this.#storage.failDeferredDecision({
        ...leaseIdentity(record, this.#ownerId),
        now: new Date(),
        availableAt: retryAt(now, record.attempts),
        lastError: sanitizeDispatchError(error),
        terminal,
      });
    }
  }

  /** Starting an agent run spends the project's compute and executes its code — the one effect a human owns. */
  async #needsApproval(record: FactoryDeferredDecisionRecord, decision: FactoryCommitDecision): Promise<boolean> {
    if (decision.type !== 'invokeSkill' || record.approvedAt !== null) return false;
    return !(await this.#isAutoRunEnabled({ orgId: record.orgId, factoryProjectId: record.factoryProjectId }));
  }

  async #executeDecision(record: FactoryDeferredDecisionRecord, decision: FactoryCommitDecision): Promise<void> {
    const nextChain: FactoryRuleCausalEntry[] = [
      ...(record.causalChain as FactoryRuleCausalEntry[]),
      { ingressId: record.idempotencyKey, decisionType: decision.type },
    ];
    if (nextChain.length > MAX_FACTORY_RULE_CAUSAL_DEPTH) throw new Error('Factory rule causal depth exceeded.');

    switch (decision.type) {
      case 'transition': {
        const item = await this.#requireItem(record);
        const result = await this.#transitionService.transition({
          orgId: record.orgId,
          factoryProjectId: record.factoryProjectId,
          workItemId: item.id,
          board: decision.board,
          stage: decision.stage,
          expectedRevision: item.revision,
          actor: { type: 'system', id: 'factory-rule-dispatcher' },
          ingress: { type: 'rule', identity: `decision:${record.idempotencyKey}` },
          cause: 'rule_decision',
          causalChain: nextChain,
        });
        if (result.status === 'rejected') throw new Error(`${result.code}: ${result.reason}`);
        if (!decision.message) return;
        // Best-effort recipient lookup: no active binding (or no authenticated
        // session owner) means nobody is engaged with this item, so the
        // transition itself is the whole effect. A retry after a delivery
        // failure is safe because the transition replays by ingress identity.
        const binding = await this.#findBinding(record, decision.message.role);
        if (!binding) return;
        const startedBy = item.sessions[binding.role]?.startedBy;
        if (!startedBy) return;
        await this.#primeCredentials?.({ orgId: record.orgId, userId: startedBy });
        const requestContext = new RequestContext();
        requestContext.set('user', { workosId: startedBy, organizationId: record.orgId });
        const session = await this.#requireSession(binding);
        await awaitNotification(
          await session.sendNotificationSignal(
            {
              source: 'factory',
              kind: 'rule-message',
              summary: decision.message.text,
              priority: 'high',
              payload: { message: decision.message.text },
              sourceId: record.id,
              dedupeKey: record.idempotencyKey,
            },
            {
              ifActive: { behavior: 'deliver' },
              ifIdle: { behavior: 'wake' },
              requestContext,
            },
          ),
          true,
        );
        return;
      }
      case 'upsertLinkedWorkItem': {
        await this.#upsertLinkedItem(record, decision, nextChain);
        return;
      }
      case 'invokeSkill': {
        const binding = await this.#requireOrPrepareBinding(record, decision.role);
        const item = record.workItemId ? await this.#storage.get({ orgId: record.orgId, id: record.workItemId }) : null;
        const startedBy = item?.sessions[binding.role]?.startedBy;
        if (!startedBy) throw new Error(`Factory binding ${binding.id} has no authenticated session owner.`);
        await this.#primeCredentials?.({ orgId: record.orgId, userId: startedBy });
        const requestContext = new RequestContext();
        requestContext.set('user', { workosId: startedBy, organizationId: record.orgId });
        const resolved = await resolveSkillInvocation(this.#controller, {
          resourceId: binding.resourceId,
          name: decision.skillName,
          arguments: decision.arguments,
        });
        const session = resolved.session as DispatcherSession;
        await this.#switchThread(session, binding);
        const delivered = await session.thread.listActiveMessages();
        if (delivered.some(message => message.id === record.id)) return;
        if (decision.cancelInFlight) session.abort();
        if (decision.precedingMessage) {
          await awaitNotification(
            await session.sendNotificationSignal(
              {
                source: 'factory',
                kind: 'stage-transition',
                summary: decision.precedingMessage,
                priority: 'medium',
                payload: { message: decision.precedingMessage },
                sourceId: `${record.id}:stage-transition`,
                dedupeKey: `${record.idempotencyKey}:stage-transition`,
              },
              {
                ifActive: { behavior: 'deliver' },
                ifIdle: { behavior: 'persist' },
                requestContext,
              },
            ),
          );
        }
        let resolveAgentEnd!: () => void;
        const agentEnd = new Promise<void>(resolve => {
          resolveAgentEnd = resolve;
        });
        const unsubscribe = session.subscribe(event => {
          if (event.type === 'agent_end') {
            resolveAgentEnd();
          }
        });

        try {
          const result = session.sendSignal(
            {
              id: record.id,
              type: 'user',
              tagName: 'user',
              contents: resolved.message,
            },
            // Without `requireDelivery` the session resolves `accepted` on the
            // next tick and swallows wake failures, so a kickoff that never
            // reached the agent would be marked succeeded and the thread would
            // stay empty forever.
            { requestContext, requireDelivery: true },
          );
          const settled = await result.accepted;
          if (settled.action !== 'wake' && settled.action !== 'deliver') {
            // An undefined action means the session did not verify delivery at
            // all — with `requireDelivery` set that is a contract violation, not
            // a success.
            throw new Error(`Factory skill invocation signal did not reach the agent (${String(settled.action)}).`);
          }
          if (settled.action === 'wake') {
            const observed = await waitForAgentEndOrTimeout(agentEnd);
            if (!observed) {
              console.warn('Factory skill run terminal event was not observed before timeout', {
                decisionId: record.id,
                runId: settled.runId,
              });
            }
          }
        } finally {
          unsubscribe();
        }
        return;
      }
      case 'sendMessage': {
        const binding = decision.prepareBinding
          ? await this.#requireOrPrepareBinding(record, decision.role)
          : await this.#requireBinding(record, decision.role);
        const item = record.workItemId ? await this.#storage.get({ orgId: record.orgId, id: record.workItemId }) : null;
        const startedBy = item?.sessions[binding.role]?.startedBy;
        if (!startedBy) throw new Error(`Factory binding ${binding.id} has no authenticated session owner.`);
        await this.#primeCredentials?.({ orgId: record.orgId, userId: startedBy });
        const requestContext = new RequestContext();
        requestContext.set('user', { workosId: startedBy, organizationId: record.orgId });
        const session = await this.#requireSession(binding);
        await awaitNotification(
          await session.sendNotificationSignal(
            {
              source: 'factory',
              kind: 'rule-message',
              summary: decision.message,
              priority: decision.priority ?? 'high',
              payload: { message: decision.message },
              sourceId: record.id,
              dedupeKey: record.idempotencyKey,
            },
            {
              ifActive: { behavior: 'deliver' },
              ifIdle: { behavior: decision.idleBehavior ?? 'wake' },
              requestContext,
            },
          ),
          true,
        );
        return;
      }
      case 'notify': {
        const binding = await this.#requireBinding(record);
        const session = await this.#requireSession(binding);
        await awaitNotification(
          await session.sendNotificationSignal({
            source: 'factory',
            kind: 'rule-notification',
            summary: decision.title,
            payload: { body: decision.body, level: decision.level },
            sourceId: record.id,
            dedupeKey: record.idempotencyKey,
          }),
        );
      }
    }
  }

  async #upsertLinkedItem(
    record: FactoryDeferredDecisionRecord,
    decision: Extract<FactoryCommitDecision, { type: 'upsertLinkedWorkItem' }>,
    causalChain: FactoryRuleCausalEntry[],
  ): Promise<void> {
    const result = await this.#storage.upsert({
      orgId: record.orgId,
      userId: 'factory-rule-dispatcher',
      factoryProjectId: record.factoryProjectId,
      input: {
        externalSource: externalSourceForDecision(decision),
        parentWorkItemId: record.workItemId,
        title: decision.title,
        stages: ['intake'],
        sessions: {},
        metadata: { ...decision.metadata, factoryRuleMaterializationKey: record.idempotencyKey },
      },
      reuseMode: 'preserve',
    });
    const materializedByDecision = result.item.metadata?.factoryRuleMaterializationKey === record.idempotencyKey;
    if (!materializedByDecision && (decision.stage === 'intake' || !result.item.stages.includes('intake'))) return;

    const board = decision.board;
    let expectedRevision = result.item.revision;
    if (materializedByDecision) {
      const initial = await this.#transitionService.transition({
        orgId: record.orgId,
        factoryProjectId: record.factoryProjectId,
        workItemId: result.item.id,
        board,
        stage: 'intake',
        expectedRevision,
        actor: deferredActor(record),
        ingress: { type: 'rule', identity: `decision:${record.idempotencyKey}:${result.item.id}:initial-entry` },
        cause: 'linked_item_materialized',
        causalChain,
        initialEntry: true,
      });
      if (initial.status === 'rejected') {
        if (result.created) await this.#storage.delete({ orgId: record.orgId, id: result.item.id });
        throw new Error(`${initial.code}: ${initial.reason}`);
      }
      expectedRevision = initial.revision;
    }
    if (decision.stage === 'intake') return;

    const moved = await this.#transitionService.transition({
      orgId: record.orgId,
      factoryProjectId: record.factoryProjectId,
      workItemId: result.item.id,
      board,
      stage: decision.stage,
      expectedRevision,
      actor: { type: 'system', id: 'factory-rule-dispatcher' },
      ingress: { type: 'rule', identity: `decision:${record.idempotencyKey}:${result.item.id}:destination` },
      cause: materializedByDecision ? 'linked_item_materialized' : 'linked_item_reconciled',
      causalChain,
    });
    if (moved.status === 'rejected') throw new Error(`${moved.code}: ${moved.reason}`);
  }

  async #requireItem(record: FactoryDeferredDecisionRecord) {
    if (!record.workItemId) throw new Error('Factory decision is not linked to a work item.');
    const item = await this.#storage.get({ orgId: record.orgId, id: record.workItemId });
    if (!item) throw new Error('Factory work item not found.');
    return item;
  }

  async #findBinding(
    record: FactoryDeferredDecisionRecord,
    role?: string,
  ): Promise<FactoryRunBindingRecord | undefined> {
    if (!record.workItemId) throw new Error('Factory decision is not linked to a work item.');
    const bindings = await this.#storage.listRunBindings(record.orgId, record.factoryProjectId, record.workItemId);
    return bindings
      .filter(candidate => candidate.status === 'active' && (role === undefined || candidate.role === role))
      .sort((left, right) => {
        if (role === undefined && left.role === 'work' && right.role !== 'work') return -1;
        if (role === undefined && right.role === 'work' && left.role !== 'work') return 1;
        return right.createdAt.getTime() - left.createdAt.getTime() || left.id.localeCompare(right.id);
      })[0];
  }

  async #requireBinding(record: FactoryDeferredDecisionRecord, role?: string): Promise<FactoryRunBindingRecord> {
    const binding = await this.#findBinding(record, role);
    if (!binding) throw new Error(role ? `No active Factory binding for role ${role}.` : 'No active Factory binding.');
    return binding;
  }

  async #requireOrPrepareBinding(
    record: FactoryDeferredDecisionRecord,
    role: string,
  ): Promise<FactoryRunBindingRecord> {
    const binding = await this.#findBinding(record, role);
    if (binding) {
      const session = await this.#controller.getSessionByResource(binding.resourceId);
      if (session) return binding;
    }
    if (!this.#prepareBinding) {
      throw new Error(binding ? 'Bound Factory session not found.' : `No active Factory binding for role ${role}.`);
    }
    const item = await this.#requireItem(record);
    await this.#prepareBinding({ record, item, role });
    return this.#requireBinding(record, role);
  }

  async #requireSession(binding: FactoryRunBindingRecord): Promise<DispatcherSession> {
    const session = (await this.#controller.getSessionByResource(binding.resourceId)) as DispatcherSession | undefined;
    if (!session) throw new Error('Bound Factory session not found.');
    await this.#switchThread(session, binding);
    return session;
  }

  async #switchThread(session: SkillSession, binding: FactoryRunBindingRecord): Promise<void> {
    await (session as DispatcherSession).thread.switch({ threadId: binding.threadId });
  }

  async #withLease(
    renew: (leaseExpiresAt: Date) => Promise<unknown | null>,
    effect: () => Promise<void>,
  ): Promise<void> {
    let renewalFailure: unknown;
    let renewal = Promise.resolve();
    const timer = setInterval(
      () => {
        renewal = renewal.then(async () => {
          try {
            const renewed = await renew(new Date(Date.now() + LEASE_MS));
            if (!renewed) renewalFailure = new Error('Factory dispatch lease was lost during execution.');
          } catch (error) {
            renewalFailure = error;
          }
        });
      },
      Math.floor(LEASE_MS / 3),
    );
    timer.unref?.();
    try {
      await effect();
      await renewal;
      if (renewalFailure) throw renewalFailure;
    } finally {
      clearInterval(timer);
      await renewal;
    }
  }

  async #dispatchPendingStart(record: FactoryPendingStartRecord, now: Date): Promise<void> {
    try {
      await this.#withLease(
        async leaseExpiresAt =>
          this.#storage.renewPendingStartLease(leaseIdentity(record, this.#ownerId), leaseExpiresAt),
        async () => {
          if (record.message === null) return;
          const bindings = await this.#storage.listRunBindings(record.orgId, record.factoryProjectId);
          const binding = bindings.find(
            candidate => candidate.id === record.bindingId && candidate.status === 'active',
          );
          if (!binding) throw new Error('Prepared Factory binding is unavailable or revoked.');
          // Wake runs build the Factory workspace, which requires the
          // authenticated session owner on the request context.
          const item = await this.#storage.get({ orgId: record.orgId, id: binding.workItemId });
          const startedBy = item?.sessions[binding.role]?.startedBy;
          if (!startedBy) throw new Error(`Factory binding ${binding.id} has no authenticated session owner.`);
          await this.#primeCredentials?.({ orgId: record.orgId, userId: startedBy });
          const requestContext = new RequestContext();
          requestContext.set('user', { workosId: startedBy, organizationId: record.orgId });
          const session = await this.#requireSession(binding);
          await awaitNotification(
            await session.sendNotificationSignal(
              {
                source: 'factory',
                kind: 'run-kickoff',
                summary: record.message!,
                priority: 'high',
                payload: { message: record.message },
                sourceId: record.id,
                dedupeKey: `factory-kickoff:${record.kickoffKey}`,
              },
              { ifActive: { behavior: 'deliver' }, ifIdle: { behavior: 'wake' }, requestContext },
            ),
            true,
          );
        },
      );
      const completed = await this.#storage.completePendingStart(leaseIdentity(record, this.#ownerId), new Date());
      if (!completed) throw new Error('Factory kickoff lease was lost before completion.');
    } catch (error) {
      await this.#storage.failPendingStart({
        ...leaseIdentity(record, this.#ownerId),
        now: new Date(),
        availableAt: retryAt(now, record.attempts),
        lastError: sanitizeDispatchError(error),
        terminal: record.attempts >= MAX_ATTEMPTS,
      });
    }
  }
}

export const FACTORY_DISPATCH_CONSTANTS = {
  leaseMs: LEASE_MS,
  pollMs: POLL_MS,
  batchSize: BATCH_SIZE,
  maxAttempts: MAX_ATTEMPTS,
  maxErrorLength: MAX_ERROR_LENGTH,
  maxBackoffMs: MAX_BACKOFF_MS,
  skillCompletionObservationTimeoutMs: SKILL_COMPLETION_OBSERVATION_TIMEOUT_MS,
  maxInFlight: MAX_IN_FLIGHT,
  stages: FACTORY_RULE_STAGES,
} as const;
