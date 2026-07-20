import { randomUUID } from 'node:crypto';

import type { AgentController } from '@mastra/core/agent-controller';
import { RequestContext } from '@mastra/core/request-context';
import type { MastraCodeState } from '@mastra/code-sdk/schema';

import { resolveSkillInvocation, type SkillSession } from '../../skills/service.js';
import type {
  FactoryDeferredDecisionRecord,
  FactoryPendingStartRecord,
  FactoryRunBindingRecord,
  WorkItemRow,
  WorkItemsStorage,
} from '../../storage/domains/work-items/base.js';
import { getWorkItemsStorage } from '../../storage/domains.js';
import type { FactoryCommitDecision, FactoryRuleActor, FactoryRuleCausalEntry } from './types.js';
import { FACTORY_RULE_STAGES } from './types.js';
import type { FactoryTransitionService } from './transition-service.js';
import { MAX_FACTORY_RULE_CAUSAL_DEPTH, validateFactoryRuleDecision } from './validation.js';

const LEASE_MS = 30_000;
const POLL_MS = 1_000;
const BATCH_SIZE = 10;
const MAX_ATTEMPTS = 5;
const MAX_ERROR_LENGTH = 512;
const MAX_BACKOFF_MS = 60_000;

interface DispatcherSession extends SkillSession {
  thread: {
    switch(input: { threadId: string }): Promise<unknown>;
    listActiveMessages(): Promise<Array<{ id: string }>>;
  };
  sendSignal(
    input: { id: string; type: 'user'; tagName: 'user'; contents: string },
    options: { requestContext: RequestContext },
  ): { accepted: Promise<unknown> };
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
  storage?: WorkItemsStorage;
  ownerId?: string;
  reconcileToolResults?: () => Promise<void>;
  prepareBinding?: (input: FactoryBindingPreparationInput) => Promise<void>;
  primeCredentials?: (tenant: { orgId: string; userId: string }) => Promise<void>;
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
  if (requireDelivery && !result.accepted)
    throw new Error('Factory notification was persisted without agent delivery.');
  await result.accepted;
}

export class FactoryDecisionDispatcher {
  readonly #controller: FactoryController;
  readonly #transitionService: Pick<FactoryTransitionService, 'transition'>;
  readonly #storage: WorkItemsStorage;
  readonly #ownerId: string;
  readonly #reconcileToolResults?: () => Promise<void>;
  readonly #prepareBinding?: (input: FactoryBindingPreparationInput) => Promise<void>;
  readonly #primeCredentials?: (tenant: { orgId: string; userId: string }) => Promise<void>;
  #timer?: ReturnType<typeof setInterval>;
  #activeRun?: Promise<void>;

  constructor(options: FactoryDecisionDispatcherOptions) {
    this.#controller = options.controller;
    this.#transitionService = options.transitionService;
    this.#storage = options.storage ?? getWorkItemsStorage();
    this.#ownerId = options.ownerId ?? `factory-dispatcher:${randomUUID()}`;
    this.#reconcileToolResults = options.reconcileToolResults;
    this.#prepareBinding = options.prepareBinding;
    this.#primeCredentials = options.primeCredentials;
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
    await this.#activeRun;
  }

  async runOnce(now = new Date()): Promise<void> {
    await this.#reconcileToolResults?.();
    const leaseExpiresAt = new Date(now.getTime() + LEASE_MS);
    const [decisions, starts] = await Promise.all([
      this.#storage.claimDeferredDecisions({
        ownerId: this.#ownerId,
        now,
        leaseExpiresAt,
        limit: BATCH_SIZE,
      }),
      this.#storage.claimPendingStarts({
        ownerId: this.#ownerId,
        now,
        leaseExpiresAt,
        limit: BATCH_SIZE,
      }),
    ]);
    await Promise.all([
      ...decisions.map(decision => this.#dispatchDecision(decision, now)),
      ...starts.map(start => this.#dispatchPendingStart(start, now)),
    ]);
  }

  async #tick(): Promise<void> {
    if (this.#activeRun) return;
    this.#activeRun = this.runOnce().catch(error => {
      console.error('Factory decision dispatch cycle failed', sanitizeDispatchError(error));
    });
    try {
      await this.#activeRun;
    } finally {
      this.#activeRun = undefined;
    }
  }

  async #dispatchDecision(record: FactoryDeferredDecisionRecord, now: Date): Promise<void> {
    try {
      const decision = validateFactoryRuleDecision(record.decision, record.causalChain.length);
      if (decision.type === 'reject') throw new Error('Deferred Factory decisions cannot reject.');
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
          scope: binding.projectPath,
          name: decision.skillName,
          arguments: decision.arguments,
        });
        const session = resolved.session as DispatcherSession;
        await this.#switchThread(session, binding);
        const delivered = await session.thread.listActiveMessages();
        if (delivered.some(message => message.id === record.id)) return;
        const result = session.sendSignal(
          {
            id: record.id,
            type: 'user',
            tagName: 'user',
            contents: resolved.message,
          },
          { requestContext },
        );
        await result.accepted;
        return;
      }
      case 'sendMessage': {
        const binding = await this.#requireBinding(record, decision.role);
        const session = await this.#requireSession(binding);
        await awaitNotification(
          await session.sendNotificationSignal(
            {
              source: 'factory',
              kind: 'rule-message',
              summary: decision.message,
              priority: 'high',
              payload: { message: decision.message },
              sourceId: record.id,
              dedupeKey: record.idempotencyKey,
            },
            { ifActive: { behavior: 'deliver' }, ifIdle: { behavior: 'wake' } },
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
        ingress: { type: 'rule', identity: `decision:${record.idempotencyKey}:initial-entry` },
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
      ingress: { type: 'rule', identity: `decision:${record.idempotencyKey}:destination` },
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
      const session = await this.#controller.getSessionByResource(binding.resourceId, binding.projectPath);
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
    const session = (await this.#controller.getSessionByResource(binding.resourceId, binding.projectPath)) as
      | DispatcherSession
      | undefined;
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
              { ifActive: { behavior: 'deliver' }, ifIdle: { behavior: 'wake' } },
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
  stages: FACTORY_RULE_STAGES,
} as const;
