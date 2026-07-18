import { randomUUID } from 'node:crypto';

import { getFactoryStorage, getSeededFactoryRules } from '../../runtime-config.js';
import type { ExternalWorkItemSource, WorkItemsStorage } from '../../storage/domains/work-items/base.js';
import { resolveFactoryStageRules } from './resolve.js';
import type {
  FactoryCommitDecision,
  FactoryRuleActor,
  FactoryRuleBoard,
  FactoryRuleCausalEntry,
  FactoryRuleRejectionCode,
  FactoryRuleStage,
  FactoryRules,
  FactoryStageRuleContext,
  FactoryTransitionResult,
} from './types.js';
import { FACTORY_RULE_STAGES, factoryRuleSourceForWorkItem } from './types.js';
import {
  MAX_FACTORY_RULE_CAUSAL_DEPTH,
  validateFactoryRuleDecision,
  validateFactoryRuleDecisions,
} from './validation.js';

const RULE_TIMEOUT_MS = 5_000;
const MAX_REJECTION_REASON = 512;

export interface FactoryTransitionRequest {
  orgId: string;
  factoryProjectId: string;
  workItemId: string;
  board: FactoryRuleBoard;
  stage: FactoryRuleStage;
  expectedRevision: number;
  actor: FactoryRuleActor;
  ingress: { type: 'human' | 'agent' | 'toolResult' | 'github' | 'rule'; identity: string; transitionId?: string };
  cause: string;
  causalChain?: readonly FactoryRuleCausalEntry[];
  /** Internal materialization path: evaluate only the destination onEnter leaf even when already at that stage. */
  initialEntry?: boolean;
}

export interface FactoryTransitionServiceOptions {
  rules?: FactoryRules;
  storage?: WorkItemsStorage;
  timeoutMs?: number;
}

function rejection(
  transitionId: string,
  itemId: string,
  code: FactoryRuleRejectionCode,
  reason: string,
): FactoryTransitionResult {
  return { status: 'rejected', transitionId, itemId, code, reason: reason.slice(0, MAX_REJECTION_REASON) };
}

function actorId(actor: FactoryRuleActor): string {
  switch (actor.type) {
    case 'human':
    case 'system':
      return actor.id;
    case 'agent':
      return `agent:${actor.bindingId}`;
    case 'github':
      return `github:${actor.login}`;
  }
}

function currentStage(stages: readonly string[]): FactoryRuleStage | undefined {
  if (stages.length !== 1) return undefined;
  const stage = stages[0];
  return FACTORY_RULE_STAGES.includes(stage as FactoryRuleStage) ? (stage as FactoryRuleStage) : undefined;
}

function workItemSource(source: ExternalWorkItemSource | null) {
  if (!source) return 'manual' as const;
  if (source.integrationId === 'linear') return 'linear-issue' as const;
  return source.type === 'pull-request' ? ('github-pr' as const) : ('github-issue' as const);
}

function ruleFailure(error: unknown): { code: FactoryRuleRejectionCode; reason: string } {
  return {
    code: 'rule_error',
    reason: error instanceof Error ? `Factory rule failed: ${error.message}` : 'Factory rule failed.',
  };
}

async function withRuleTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('FACTORY_RULE_TIMEOUT')), timeoutMs);
  });
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export class FactoryTransitionService {
  readonly #rules: FactoryRules;
  readonly #storage: WorkItemsStorage;
  readonly #timeoutMs: number;

  constructor(options: FactoryTransitionServiceOptions = {}) {
    const rules = options.rules ?? getSeededFactoryRules();
    if (!rules) throw new Error('Factory rules are unavailable.');
    this.#rules = rules;
    this.#storage = options.storage ?? getFactoryStorage().getDomain<WorkItemsStorage>('work-items');
    this.#timeoutMs = options.timeoutMs ?? RULE_TIMEOUT_MS;
  }

  get ruleSetVersion(): string {
    return this.#rules.version;
  }

  async transition(request: FactoryTransitionRequest): Promise<FactoryTransitionResult> {
    const replay = await this.#storage.getTransitionResultByIngress(
      request.orgId,
      request.factoryProjectId,
      request.ingress.identity,
    );
    if (replay) return replay as unknown as FactoryTransitionResult;

    const transitionId = request.ingress.transitionId ?? randomUUID();
    const item = await this.#storage.get({ orgId: request.orgId, id: request.workItemId });
    if (!item) {
      return this.#commitRejection(request, transitionId, 'invalid_transition', 'Work item not found.');
    }

    if (request.causalChain && request.causalChain.length > MAX_FACTORY_RULE_CAUSAL_DEPTH) {
      return this.#commitRejection(
        request,
        transitionId,
        'causal_depth_exceeded',
        'Factory rule causal depth exceeded.',
      );
    }
    const itemSource = workItemSource(item.externalSource);
    const source = factoryRuleSourceForWorkItem(itemSource);
    if ((request.board === 'review') !== (source === 'pullRequest')) {
      return this.#commitRejection(
        request,
        transitionId,
        'invalid_transition',
        'The work item does not belong to the requested board.',
      );
    }
    const fromStage = currentStage(item.stages);
    if (!fromStage) {
      return this.#commitRejection(
        request,
        transitionId,
        'invalid_transition',
        'The work item does not have one canonical Factory stage.',
      );
    }

    const contextBase = {
      tenant: { orgId: request.orgId, projectId: request.factoryProjectId },
      actor: request.actor,
      ingress: { type: request.ingress.type, id: request.ingress.identity },
      cause: request.cause,
      causalChain: request.causalChain ?? [],
      ruleSetVersion: this.#rules.version,
      item: {
        id: item.id,
        source: itemSource,
        sourceKey: item.externalSource
          ? `${item.externalSource.integrationId}:${item.externalSource.type}:${item.externalSource.externalId}`
          : null,
        parentWorkItemId: item.parentWorkItemId,
        title: item.title,
        url: item.externalSource?.url ?? null,
        stages: [...item.stages],
      },
      board: request.board,
      itemRevision: item.revision,
      source,
      fromStage,
      toStage: request.stage,
    } satisfies Omit<FactoryStageRuleContext, 'stage'>;

    let evaluation:
      | { outcome: 'accepted'; decisions: Record<string, unknown>[] }
      | { outcome: 'rejected'; code: string; reason: string };
    try {
      evaluation = await withRuleTimeout(
        (async () => {
          const decisions: FactoryCommitDecision[] = [];
          for (const rule of resolveFactoryStageRules(this.#rules, {
            board: request.board,
            source,
            fromStage,
            toStage: request.stage,
            initialEntry: request.initialEntry,
          })) {
            const context: FactoryStageRuleContext = Object.freeze({
              ...contextBase,
              stage: rule.phase === 'exit' ? fromStage : request.stage,
            });
            const raw = await rule.handler(context);
            if (raw === undefined) continue;
            const decision = validateFactoryRuleDecision(raw, context.causalChain.length);
            if (decision.type === 'reject') {
              return { outcome: 'rejected' as const, code: decision.code, reason: decision.reason };
            }
            decisions.push(decision);
          }
          return {
            outcome: 'accepted' as const,
            decisions: validateFactoryRuleDecisions(decisions) as unknown as Record<string, unknown>[],
          };
        })(),
        this.#timeoutMs,
      );
    } catch (error) {
      const failed =
        error instanceof Error && error.message === 'FACTORY_RULE_TIMEOUT'
          ? { code: 'timeout' as const, reason: 'Factory rule evaluation timed out.' }
          : ruleFailure(error);
      evaluation = { outcome: 'rejected', ...failed };
    }
    return this.#commit(request, transitionId, evaluation);
  }

  async #commitRejection(
    request: FactoryTransitionRequest,
    transitionId: string,
    code: FactoryRuleRejectionCode,
    reason: string,
  ): Promise<FactoryTransitionResult> {
    return this.#commit(request, transitionId, { outcome: 'rejected', code, reason });
  }

  async #commit(
    request: FactoryTransitionRequest,
    transitionId: string,
    evaluation:
      | { outcome: 'accepted'; decisions: Record<string, unknown>[] }
      | { outcome: 'rejected'; code: string; reason: string },
  ): Promise<FactoryTransitionResult> {
    const committed = await this.#storage.commitTransition({
      orgId: request.orgId,
      factoryProjectId: request.factoryProjectId,
      workItemId: request.workItemId,
      expectedRevision: request.expectedRevision,
      destinationStage: request.stage,
      actorId: actorId(request.actor),
      ingress: { identity: request.ingress.identity, triggerType: request.ingress.type, transitionId },
      ruleSetVersion: this.#rules.version,
      causalChain: [...(request.causalChain ?? [])],
      evaluation,
    });
    if (committed.status === 'missing') {
      return rejection(transitionId, request.workItemId, 'invalid_transition', 'Work item not found.');
    }
    return committed.result as unknown as FactoryTransitionResult;
  }
}
