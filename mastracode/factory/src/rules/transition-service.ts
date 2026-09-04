import { randomUUID } from 'node:crypto';

import type { WorkItemRow, WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { resolveFactoryStageRules } from './resolve.js';
import type {
  FactoryCommitDecision,
  FactoryRuleActor,
  FactoryRuleBoard,
  FactoryRuleCausalEntry,
  FactoryRuleRejectionCode,
  FactoryRuleStage,
  FactoryTriageType,
  FactoryRules,
  FactoryStageRuleContext,
  FactoryTransitionResult,
} from './types.js';
import {
  externallyAuthoredWorkItem,
  factoryRuleSourceForWorkItem,
  isFactoryRuleStage,
  isWorkingFactoryRuleStage,
  workItemSource,
} from './types.js';
import {
  MAX_FACTORY_RULE_CAUSAL_DEPTH,
  validateFactoryRuleDecision,
  validateFactoryRuleDecisions,
} from './validation.js';

const RULE_TIMEOUT_MS = 5_000;
const MAX_REJECTION_REASON = 512;
const TERMINAL_STAGES: ReadonlySet<FactoryRuleStage> = new Set(['done', 'canceled']);
/** Longest a committed transition waits for terminal resource cleanup. Cleanup
 * reattaches remote sandboxes, so a hung provider call must not leave the
 * already-committed transition request pending; past this bound the cleanup
 * keeps running in the background as pure best-effort. */
const TERMINAL_CLEANUP_TIMEOUT_MS = 30_000;

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
  /** Re-runs the stage's entry rules when the item already holds that stage, to restart work the entry invalidated. */
  reenter?: boolean;
  /** Structured verdict required from a bound triage-agent terminal request. */
  triageType?: FactoryTriageType;
}

export interface FactoryTransitionServiceOptions {
  rules: FactoryRules;
  storage: WorkItemsStorage;
  timeoutMs?: number;
  /**
   * Called after a transition commits into a terminal stage (`done` /
   * `canceled`) — the point where the item's sessions stop receiving runs, so
   * resources they hold (e.g. sandboxes) can be released for reuse. Awaited,
   * but failures are swallowed: releasing resources must never break or roll
   * back the committed transition.
   */
  onTerminalStage?: (args: {
    orgId: string;
    factoryProjectId: string;
    workItemId: string;
    stage: FactoryRuleStage;
    revision: number;
  }) => Promise<void> | void;
  /** Upper bound on how long a committed transition waits for
   * `onTerminalStage` before returning (default 30s). The cleanup continues
   * in the background past the bound. */
  terminalCleanupTimeoutMs?: number;
  /**
   * Called after a transition first records a person's acceptance of a
   * non-bug item (see `WorkItemRow.acceptedAt`). Fire-and-forget: failures
   * are swallowed, the committed transition never depends on it.
   */
  onAccepted?: (args: {
    orgId: string;
    factoryProjectId: string;
    workItemId: string;
    item: WorkItemRow;
  }) => Promise<void> | void;
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

export function currentStage(stages: readonly string[]): FactoryRuleStage | undefined {
  if (stages.length !== 1) return undefined;
  const stage = stages[0];
  return isFactoryRuleStage(stage) ? stage : undefined;
}

export function roleForStage(board: FactoryRuleBoard, stage: FactoryRuleStage): string {
  if (board === 'review') return 'review';
  if (stage === 'triage') return 'triage';
  if (stage === 'planning') return 'plan';
  return 'work';
}

interface TransitionConsentOptions {
  autonomy?: 'arm' | 'disarm';
  consentedBy?: string;
  accept?: boolean;
}

// Entering a resting lane disarms whoever rests it; only a person's drag into a working lane arms.
function transitionConsent(stage: FactoryRuleStage, humanBoardDrag: boolean): 'arm' | 'disarm' | undefined {
  if (!isWorkingFactoryRuleStage(stage)) return 'disarm';
  return humanBoardDrag ? 'arm' : undefined;
}

// An event arriving as data (GitHub, sweeps) never pre-approves the runs its transition queues.
function bearsConsent(actor: FactoryRuleActor): boolean {
  return actor.type === 'human' || actor.type === 'agent';
}

// Rides the transition's own revision-checked commit, so a stale or rejected commit flips nothing.
function consentEffect(request: FactoryTransitionRequest, humanBoardDrag: boolean): TransitionConsentOptions {
  const autonomy = transitionConsent(request.stage, humanBoardDrag);
  return bearsConsent(request.actor) ? { autonomy, consentedBy: actorId(request.actor) } : { autonomy };
}

type RunStartDecision = Extract<FactoryCommitDecision, { type: 'invokeSkill' | 'sendMessage' }>;

function startsRun(decision: FactoryCommitDecision): decision is RunStartDecision {
  return decision.type === 'invokeSkill' || (decision.type === 'sendMessage' && decision.prepareBinding === true);
}

// Answering a recorded run start, or the role's own mid-run agent, with a run would start a second one.
function runAlreadyUnderway(request: FactoryTransitionRequest, decision: RunStartDecision): boolean {
  if (request.cause === 'run_start') return true;
  return request.actor.type === 'agent' && request.actor.role === decision.role;
}

function stageTransitionMessage(fromStage: FactoryRuleStage, toStage: FactoryRuleStage): string {
  return `This work was moved from the ${fromStage} stage to the ${toStage} stage.`;
}

function isTriageAgent(actor: FactoryRuleActor): actor is Extract<FactoryRuleActor, { type: 'agent' }> {
  return actor.type === 'agent' && actor.role === 'triage';
}

function isHumanTransition(request: FactoryTransitionRequest): boolean {
  return request.actor.type === 'human' && request.ingress.type === 'human';
}

function requiresHumanApproval(triageType: FactoryTriageType | null | undefined): boolean {
  return triageType !== undefined && triageType !== null && triageType !== 'bug';
}

function isAtRest(stage: FactoryRuleStage): boolean {
  return stage === 'intake' || stage === 'triage';
}

function entersWork(stage: FactoryRuleStage): boolean {
  return stage === 'planning' || stage === 'execute';
}

// A person moving a card into Planning/Execute is the approval gesture —
// recorded once, so later agent hops need no second nod. Not limited to moves
// out of rest: a card accepted before acceptance was recorded still gets its
// stamp (and its label reconciled) the next time a person moves it forward.
function acceptsItem(request: FactoryTransitionRequest): boolean {
  return isHumanTransition(request) && entersWork(request.stage);
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
  readonly #onTerminalStage: FactoryTransitionServiceOptions['onTerminalStage'];
  readonly #terminalCleanupTimeoutMs: number;
  readonly #onAccepted: FactoryTransitionServiceOptions['onAccepted'];

  constructor(options: FactoryTransitionServiceOptions) {
    this.#rules = options.rules;
    this.#storage = options.storage;
    this.#timeoutMs = options.timeoutMs ?? RULE_TIMEOUT_MS;
    this.#onTerminalStage = options.onTerminalStage;
    this.#onAccepted = options.onAccepted;
    this.#terminalCleanupTimeoutMs = options.terminalCleanupTimeoutMs ?? TERMINAL_CLEANUP_TIMEOUT_MS;
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

    if (isTriageAgent(request.actor) && request.triageType === undefined) {
      return this.#commitRejection(
        request,
        transitionId,
        'invalid_transition',
        'Triage transitions must report a structured triage classification.',
      );
    }
    if (item.triageType && request.triageType && item.triageType !== request.triageType) {
      return this.#commitRejection(
        request,
        transitionId,
        'forbidden',
        'The persisted triage classification cannot be changed by a later transition.',
      );
    }
    // The gate stands at the exit of rest. A non-bug card already in
    // Planning/Execute can only have been put there by a person, so an agent
    // carrying it further (plan → build) is not asked for a second nod even
    // when the acceptance stamp predates its recording.
    const triageType = item.triageType ?? request.triageType;
    if (
      requiresHumanApproval(triageType) &&
      entersWork(request.stage) &&
      isAtRest(fromStage) &&
      !isHumanTransition(request) &&
      !item.acceptedAt
    ) {
      return this.#commitRejection(
        request,
        transitionId,
        'approval_required',
        'A maintainer must move this non-bug work item into Planning or Execute from the Factory UI.',
      );
    }

    // The card's own content can steer a bound agent; on a card authored
    // outside the write-access circle, leaving rest takes a person's gesture.
    if (
      request.actor.type === 'agent' &&
      !isWorkingFactoryRuleStage(fromStage) &&
      isWorkingFactoryRuleStage(request.stage) &&
      externallyAuthoredWorkItem(item)
    ) {
      return this.#commitRejection(
        request,
        transitionId,
        'approval_required',
        'This card comes from outside the write-access circle; a person must resume it from the Factory board.',
      );
    }

    const humanBoardDrag =
      request.actor.type === 'human' && request.cause === 'board_drag' && fromStage !== request.stage;

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
        metadata: item.metadata,
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
            reenter: request.reenter,
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
            if (startsRun(decision) && runAlreadyUnderway(request, decision)) continue;
            decisions.push(decision);
          }
          const validated = validateFactoryRuleDecisions(decisions);
          if (humanBoardDrag) {
            const message = stageTransitionMessage(fromStage, request.stage);
            const skill = validated.find(decision => decision.type === 'invokeSkill');
            if (skill) {
              skill.precedingMessage = message;
            } else {
              validated.unshift({
                type: 'sendMessage',
                idempotencyKey: `factory-stage:${transitionId}`,
                message,
                priority: 'urgent',
                idleBehavior: 'wake',
                // Parking a card says stop: no seat is right by construction, so
                // the notice goes to whichever session is live — or nobody.
                ...(isWorkingFactoryRuleStage(request.stage)
                  ? { role: roleForStage(request.board, request.stage), prepareBinding: true }
                  : {}),
              });
            }
          }
          return {
            outcome: 'accepted' as const,
            decisions: validateFactoryRuleDecisions(validated) as unknown as Record<string, unknown>[],
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
    return this.#commit(
      request,
      transitionId,
      evaluation,
      evaluation.outcome === 'accepted'
        ? { ...consentEffect(request, humanBoardDrag), accept: acceptsItem(request) && !item.acceptedAt }
        : {},
    );
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
    options: TransitionConsentOptions = {},
  ): Promise<FactoryTransitionResult> {
    const committed = await this.#storage.commitTransition({
      autonomy: options.autonomy,
      consentedBy: options.consentedBy,
      ...(options.accept ? { accept: true } : {}),
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
      ...(isTriageAgent(request.actor) && request.triageType ? { triageType: request.triageType } : {}),
    });
    if (committed.status === 'missing') {
      return rejection(transitionId, request.workItemId, 'invalid_transition', 'Work item not found.');
    }
    const result = committed.result as unknown as FactoryTransitionResult;
    if (
      this.#onAccepted &&
      options.accept &&
      committed.status === 'committed' &&
      result.status === 'accepted' &&
      committed.item?.acceptedAt
    ) {
      const item = committed.item;
      void Promise.resolve(
        this.#onAccepted({
          orgId: request.orgId,
          factoryProjectId: request.factoryProjectId,
          workItemId: request.workItemId,
          item,
        }),
      ).catch(error => {
        console.warn(`[factory] acceptance hook failed for work item ${request.workItemId}:`, error);
      });
    }
    if (this.#onTerminalStage && result.status === 'accepted' && TERMINAL_STAGES.has(result.stage)) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const cleanup = Promise.resolve(
          this.#onTerminalStage({
            orgId: request.orgId,
            factoryProjectId: request.factoryProjectId,
            workItemId: request.workItemId,
            stage: result.stage,
            revision: result.revision,
          }),
        );
        // A late rejection after the timeout wins the race must not surface
        // as an unhandled rejection.
        cleanup.catch(() => {});
        await Promise.race([
          cleanup,
          new Promise<void>(resolve => {
            timer = setTimeout(resolve, this.#terminalCleanupTimeoutMs);
          }),
        ]);
      } catch {
        // Resource release is best-effort — never fail a committed transition.
      } finally {
        clearTimeout(timer);
      }
    }
    return result;
  }
}
