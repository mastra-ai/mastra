import { DEFAULT_BOARD_ID, REVIEW_CONTEXT } from '../boards/index.js';
import type { BoardRegistry, InstalledBoard } from '../boards/index.js';
import { autoApprovedExitTool, exitToolSucceeded } from '../boards/phase-automation.js';
import { phaseRunDecision } from '../boards/phase-runner.js';
import { toBoardSource } from '../boards/project-boards.js';
import type { ProjectBoardSource } from '../boards/project-boards.js';
import { boardFlow, boardForWorkItem, hasPullRequest, pullRequestCardRejection } from '../boards/semantics.js';
import { boardTransitionPolicyResultSchema, immutablePolicySnapshot } from '../boards/transition-policy.js';
import type { AuditActorProfileInput, AuditActorType, AuditContext } from '../storage/domains/audit/base.js';
import type { AuditRecorder } from '../storage/domains/audit/domain.js';
import { isAgentActor } from '../storage/domains/work-items/base.js';
import type { Card, WorkItemsStorage } from '../storage/domains/work-items/base.js';
import type {
  FactoryCommitDecision,
  FactoryRuleActor,
  FactoryRuleBoard,
  FactoryRuleCausalEntry,
  FactoryRuleRejectionCode,
  FactoryRuleStage,
  FactoryStageRuleContext,
  FactoryTransitionResult,
  FactoryTransitionResultRejected,
} from './types.js';
import { factoryRuleSourceForWorkItem, workItemSource } from './types.js';
import {
  MAX_FACTORY_RULE_CAUSAL_DEPTH,
  assertFactoryDecisionTarget,
  validateFactoryRuleDecision,
  validateFactoryRuleDecisions,
} from './validation.js';

const RULE_TIMEOUT_MS = 5_000;
const MAX_REJECTION_REASON = 512;
/** Longest a committed transition waits for terminal resource cleanup. Cleanup
 * reattaches remote sandboxes, so a hung provider call must not leave the
 * already-committed transition request pending; past this bound the cleanup
 * keeps running in the background as pure best-effort. */
const TERMINAL_CLEANUP_TIMEOUT_MS = 30_000;

export interface FactoryTransitionRequest {
  orgId: string;
  factoryProjectId: string;
  workItemId: string;
  /** Installed board id; the service rejects boards that are not installed. */
  board: string;
  stage: FactoryRuleStage;
  expectedRevision: number;
  actor: FactoryRuleActor;
  actorProfile?: AuditActorProfileInput;
  /** Where a browser request came from; rules and agents carry none. */
  context?: AuditContext;
  ingress: { type: 'human' | 'agent' | 'toolResult' | 'github' | 'rule'; identity: string; transitionId?: string };
  cause: string;
  causalChain?: readonly FactoryRuleCausalEntry[];
  /** Internal materialization path: start the destination phase's runner even when already at that stage. */
  initialEntry?: boolean;
  /** Starts the stage's runner again when the item already holds that stage, to restart work the entry invalidated. */
  reenter?: boolean;
  /** Internal proof that this move consumes an approved `submit_plan` result. */
  planApproved?: true;
  /** Internal: the tool whose successful result this move consumes (a tool-result rule's move). */
  completedTool?: string;
  /**
   * Internal: an intake route moves the card on a status event. A route is admin-authored, so it
   * may name any phase on the card's board regardless of the board's next phases; it enters a
   * working phase only when the route allows it.
   */
  eventRoute?: { routeId: string; allowWorkingPhase: boolean };
}

export interface FactoryTransitionServiceOptions {
  configVersion: string;
  storage: WorkItemsStorage;
  /** A fixed registry, or the per-project boards; each transition loads its project's boards. */
  boards?: BoardRegistry | ProjectBoardSource;
  /** Every commit, accepted or rejected, lands here as `stage_moved` / `transition_rejected` under the request's actor. */
  audit?: AuditRecorder;
  timeoutMs?: number;
  /**
   * Called after a transition commits into a phase the board declares
   * terminal — the point where the item's sessions stop receiving runs, so
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
    /** The actor that committed this terminal transition. Lets cleanup leave
     * the seat that drove its own transition (an agent tool call) untouched. */
    actor: FactoryRuleActor;
  }) => Promise<void> | void;
  /**
   * Called after a transition commits a stage change, e.g. to tell the item's
   * followers. Not awaited, and failures are logged: a notification must never
   * fail or delay the committed transition.
   */
  onTransitionCommitted?: (args: {
    orgId: string;
    factoryProjectId: string;
    workItemId: string;
    fromStage: string | undefined;
    toStage: string;
  }) => Promise<void> | void;
  /** Upper bound on how long a committed transition waits for
   * `onTerminalStage` before returning (default 30s). The cleanup continues
   * in the background past the bound. */
  terminalCleanupTimeoutMs?: number;
  /**
   * Called after a person moves a Work card from Intake or Triage into Planning or
   * Building, which approves the work. Fire-and-forget: failures are swallowed, the committed transition never
   * depends on it.
   */
  onAccepted?: (args: {
    orgId: string;
    factoryProjectId: string;
    workItemId: string;
    item: Card;
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
    case 'gitlab':
      return `gitlab:${actor.username}`;
  }
}

// The dispatcher executes an agent-approved decision as a human actor so its consent carries; the trail still names the agent.
export function auditActorOf(actor: FactoryRuleActor): { actorId: string; actorType: AuditActorType } {
  const id = actorId(actor);
  switch (actor.type) {
    case 'github':
    case 'gitlab':
      return { actorId: id, actorType: 'human' };
    case 'human':
      return { actorId: id, actorType: isAgentActor(id) ? 'agent' : 'human' };
    default:
      return { actorId: id, actorType: actor.type };
  }
}

/** The role a session's own agent moves under when nobody signed in started its turn (see `factory_transition_work_item` in the session tools). */
const SESSION_AGENT_ROLE = 'session';

function isStale(result: FactoryTransitionResult): result is FactoryTransitionResultRejected {
  return result.status === 'rejected' && result.code === 'stale';
}

/** Tell the caller where the card is now, so a model doesn't read "stale" as "already moved". */
function staleRejection(result: FactoryTransitionResultRejected, current: Card): FactoryTransitionResult {
  const stage = currentStage(current.stages) ?? current.stages.join(', ');
  return rejection(
    result.transitionId,
    result.itemId,
    'stale',
    `The card changed (now revision ${current.revision}, in ${stage}). Retry with expectedRevision ${current.revision} if the move still applies.`,
  );
}

export function currentStage(stages: readonly string[]): FactoryRuleStage | undefined {
  return stages.length === 1 ? stages[0] : undefined;
}

interface TransitionConsentOptions {
  autonomy?: 'arm' | 'disarm';
  consentedBy?: string;
  /** A person moved a card into its board's build seat from before it (see {@link acceptsWork}): that move approves the work. */
  accepted?: boolean;
}

/**
 * Whether moving a card from `from` to `to` hands it to the board's builder for the first time: `to`
 * runs in the seat of the board's build phase ({@link boardFlow}), and `from` is a resting phase or a
 * working phase of another seat that is no review (Work: Intake or Triage into Planning or Building).
 */
function acceptsWork(board: InstalledBoard, from: string, to: string): boolean {
  const buildRole = boardFlow(board).buildRole;
  if (!buildRole || board.roleForPhase(to) !== buildRole) return false;
  const fromPhase = board.phases[from];
  if (!fromPhase || fromPhase.kind === 'terminal') return false;
  if (fromPhase.kind === 'resting') return true;
  const fromRole = fromPhase.runner.context;
  return fromRole !== buildRole && fromRole !== REVIEW_CONTEXT;
}

// Entering a resting lane disarms whoever rests it; only a person's move into a working lane arms.
function transitionConsent(working: boolean, humanMove: boolean): 'arm' | 'disarm' | undefined {
  if (!working) return 'disarm';
  return humanMove ? 'arm' : undefined;
}

// An event arriving as data (GitHub, sweeps) never pre-approves the runs its transition queues.
function bearsConsent(actor: FactoryRuleActor): boolean {
  return actor.type === 'human' || actor.type === 'agent';
}

// Rides the transition's own revision-checked commit, so a stale or rejected commit flips nothing.
function consentEffect(
  request: FactoryTransitionRequest,
  working: boolean,
  humanMove: boolean,
): TransitionConsentOptions {
  // A provider event (a reopen, a close) is not a person's say-so: whatever a person armed before
  // no longer stands once a route moves the card.
  if (request.eventRoute) return { autonomy: 'disarm' };
  const autonomy = transitionConsent(working, humanMove);
  return bearsConsent(request.actor) ? { autonomy, consentedBy: actorId(request.actor) } : { autonomy };
}

type RunStartDecision = Extract<FactoryCommitDecision, { type: 'invokeSkill' | 'sendMessage' }>;

function startsRun(decision: FactoryCommitDecision): decision is RunStartDecision {
  return decision.type === 'invokeSkill' || (decision.type === 'sendMessage' && decision.prepareBinding === true);
}

// Answering a recorded run start, or the role's own mid-run agent, with a run would start a second one.
// A run that starts after its own agent's move is queued onto that agent's run instead.
function runAlreadyUnderway(request: FactoryTransitionRequest, decision: RunStartDecision): boolean {
  if (request.cause === 'run_start') return true;
  if (decision.type === 'invokeSkill' && decision.startsAfterOwnMove === true) return false;
  return request.actor.type === 'agent' && request.actor.role === decision.role;
}

function stageTransitionMessage(fromStage: FactoryRuleStage, toStage: FactoryRuleStage): string {
  return `This work was moved from the ${fromStage} stage to the ${toStage} stage.`;
}

function isHumanTransition(request: FactoryTransitionRequest): boolean {
  return request.actor.type === 'human' && request.ingress.type === 'human';
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
  readonly #configVersion: string;
  readonly #boards: ProjectBoardSource;
  readonly #storage: WorkItemsStorage;
  readonly #timeoutMs: number;
  readonly #onTerminalStage: FactoryTransitionServiceOptions['onTerminalStage'];
  readonly #terminalCleanupTimeoutMs: number;
  readonly #onAccepted: FactoryTransitionServiceOptions['onAccepted'];
  readonly #onTransitionCommitted: FactoryTransitionServiceOptions['onTransitionCommitted'];
  readonly #audit: AuditRecorder | undefined;

  constructor(options: FactoryTransitionServiceOptions) {
    this.#configVersion = options.configVersion;
    this.#boards = toBoardSource(options.boards);
    this.#storage = options.storage;
    this.#audit = options.audit;
    this.#timeoutMs = options.timeoutMs ?? RULE_TIMEOUT_MS;
    this.#onTerminalStage = options.onTerminalStage;
    this.#onAccepted = options.onAccepted;
    this.#onTransitionCommitted = options.onTransitionCommitted;
    this.#terminalCleanupTimeoutMs = options.terminalCleanupTimeoutMs ?? TERMINAL_CLEANUP_TIMEOUT_MS;
  }

  get configVersion(): string {
    return this.#configVersion;
  }

  async transition(request: FactoryTransitionRequest): Promise<FactoryTransitionResult> {
    const replay = await this.#storage.getTransitionResultByIngress(
      request.orgId,
      request.factoryProjectId,
      request.ingress.identity,
    );
    if (replay) return replay as unknown as FactoryTransitionResult;

    const transitionId = request.ingress.transitionId ?? globalThis.crypto.randomUUID();
    const item = await this.#storage.get({ orgId: request.orgId, id: request.workItemId });
    if (!item) {
      const rejection = await this.#commitRejection(
        request,
        transitionId,
        'invalid_transition',
        'Work item not found.',
      );
      await this.#recordTransition(request, undefined, rejection);
      return rejection;
    }
    let moved = item;
    let result = await this.#evaluateAndCommit(request, transitionId, item);
    if (isStale(result)) {
      // A stale move persisted nothing (not even its ingress), so the same identity can commit now.
      const current = await this.#storage.get({ orgId: request.orgId, id: request.workItemId });
      if (current && (await this.#retriesStaleMove(request, item, current))) {
        moved = current;
        result = await this.#evaluateAndCommit(
          { ...request, expectedRevision: current.revision },
          transitionId,
          current,
        );
      }
      if (isStale(result) && current) result = staleRejection(result, current);
    }
    await this.#recordTransition(request, moved, result);
    this.#notifyCommitted(request, moved, result);
    return result;
  }

  /**
   * A bound phase agent reads the card's revision from its phase signal, and its own run moves it
   * on: attaching the pull request it opened, recording a verdict. A revision lost only to such a
   * write, with the card still in the phase this agent's seat runs, retries once at the current
   * revision; the move is evaluated again, so one the board no longer allows is still refused.
   * A card whose phase changed is left to the agent with the current revision and phase.
   */
  async #retriesStaleMove(request: FactoryTransitionRequest, read: Card, current: Card): Promise<boolean> {
    if (request.actor.type !== 'agent' || request.actor.role === SESSION_AGENT_ROLE) return false;
    // Only a revision the card has since moved past; one it never reached was not read from it.
    if (request.expectedRevision >= current.revision) return false;
    const stage = currentStage(current.stages);
    if (stage === undefined || stage !== currentStage(read.stages)) return false;
    const board = (await this.#boards.load(request)).get(request.board);
    return board?.roleForPhase(stage) === request.actor.role;
  }

  #notifyCommitted(request: FactoryTransitionRequest, item: Card, result: FactoryTransitionResult): void {
    const onTransitionCommitted = this.#onTransitionCommitted;
    if (!onTransitionCommitted || result.status !== 'accepted') return;
    // Board-neutral: `currentStage` only knows the built-in rule stages.
    const fromStage = item.stages.length === 1 ? item.stages[0] : undefined;
    if (result.stage === fromStage) return;
    // Inside the chain so a synchronous throw is isolated the same way an async rejection is.
    void Promise.resolve()
      .then(() =>
        onTransitionCommitted({
          orgId: request.orgId,
          factoryProjectId: request.factoryProjectId,
          workItemId: item.id,
          fromStage,
          toStage: result.stage,
        }),
      )
      .catch(error => {
        console.warn(`[factory] stage notification failed for work item ${item.id}:`, error);
      });
  }

  /** A rejection can outlive its work item: the row still names the id the caller asked for. */
  async #recordTransition(
    request: FactoryTransitionRequest,
    item: Card | undefined,
    result: FactoryTransitionResult,
  ): Promise<void> {
    if (!this.#audit) return;
    const from = item ? currentStage(item.stages) : undefined;
    if (result.status === 'accepted' && result.stage === from && !request.reenter) return;
    const outcome =
      result.status === 'accepted'
        ? { action: 'factory.work_item.stage_moved' as const, to: result.stage, revision: result.revision }
        : {
            action: 'factory.work_item.transition_rejected' as const,
            to: request.stage,
            code: result.code,
            reason: result.reason,
          };
    const { action, ...detail } = outcome;
    await this.#audit
      .record({
        orgId: request.orgId,
        factoryProjectId: request.factoryProjectId,
        ...auditActorOf(request.actor),
        actorProfile: request.actorProfile,
        ...(request.context ? { context: request.context } : {}),
        action,
        idempotencyKey: result.transitionId,
        targets: [{ type: 'work_item', id: item?.id ?? request.workItemId, ...(item ? { name: item.title } : {}) }],
        metadata: {
          transitionId: result.transitionId,
          ingressType: request.ingress.type,
          cause: request.cause,
          configVersion: this.#configVersion,
          ...(from ? { from } : {}),
          ...(request.reenter ? { reenter: true } : {}),
          ...detail,
        },
      })
      .catch(error => {
        console.warn(`[factory] audit failed for transition ${result.transitionId}:`, error);
      });
  }

  async #evaluateAndCommit(
    request: FactoryTransitionRequest,
    transitionId: string,
    item: Card,
  ): Promise<FactoryTransitionResult> {
    const boards = await this.#boards.load(request);
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
    const isPullRequest = source === 'pullRequest' || source === 'gitlabPullRequest';
    // Rows filed before boards were persisted belong to the default board.
    if (item.board === null && !boards.has(DEFAULT_BOARD_ID)) {
      return this.#commitRejection(
        request,
        transitionId,
        'invalid_transition',
        'This legacy work item has no assigned board. Assign an installed board and phase through the work-item PATCH endpoint before transitioning it.',
      );
    }
    const itemBoard = boardForWorkItem(item);
    if (request.board !== itemBoard) {
      return this.#commitRejection(
        request,
        transitionId,
        'invalid_transition',
        `The work item belongs to board "${itemBoard}", not "${request.board}".`,
      );
    }
    const board = boards.get(request.board);
    if (!board) {
      return this.#commitRejection(
        request,
        transitionId,
        'invalid_transition',
        `Board "${request.board}" is not installed.`,
      );
    }
    const fromStage = item.stages.length === 1 ? item.stages[0] : undefined;
    if (!fromStage || !Object.prototype.hasOwnProperty.call(board.phases, fromStage)) {
      return this.#commitRejection(
        request,
        transitionId,
        'invalid_transition',
        'The work item does not have one canonical phase on the requested board.',
      );
    }
    if (
      !Object.prototype.hasOwnProperty.call(board.phases, request.stage) ||
      (!request.eventRoute && !board.allowsTransition(fromStage, request.stage))
    ) {
      const nextStages = [...new Set((board.transitions[fromStage] ?? []).map(transition => transition.to))];
      const nextStagesReason =
        nextStages.length > 0
          ? `Next stages declared from ${fromStage}: ${nextStages.join(', ')}.`
          : `No next stage is declared from ${fromStage}.`;
      return this.#commitRejection(
        request,
        transitionId,
        'invalid_transition',
        `The ${board.name} board does not allow moving from ${fromStage} to ${request.stage}. ${nextStagesReason}`,
      );
    }
    const cardShapeRejection = pullRequestCardRejection(
      board,
      {
        standalonePullRequest: isPullRequest,
        hasPullRequest: hasPullRequest({ workItem: item.workItem, source: itemSource }),
      },
      request.stage,
    );
    if (cardShapeRejection) {
      return this.#commitRejection(request, transitionId, 'invalid_transition', cardShapeRejection);
    }

    if (
      request.eventRoute &&
      !request.eventRoute.allowWorkingPhase &&
      fromStage !== request.stage &&
      board.isWorking(request.stage)
    ) {
      return this.#commitRejection(
        request,
        transitionId,
        'approval_required',
        `Intake route ${request.eventRoute.routeId} moves cards into ${board.phases[request.stage]?.name ?? request.stage}, a working phase, only when the route allows working phases.`,
      );
    }

    // The coordinator's own self-move at run start would otherwise inject a second run's kickoff.
    const humanMove = request.actor.type === 'human' && fromStage !== request.stage && request.cause !== 'run_start';
    // The board, not the phase name, says whether a seat is engaged on either side of this move.
    const entersWorking = board.isWorking(request.stage);
    const seatRole = board.roleForPhase(request.stage);

    const contextBase = {
      tenant: { orgId: request.orgId, projectId: request.factoryProjectId },
      actor: request.actor,
      ingress: { type: request.ingress.type, id: request.ingress.identity },
      cause: request.cause,
      causalChain: request.causalChain ?? [],
      configVersion: this.#configVersion,
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
        workItem: item.workItem,
        acceptedAt: item.acceptedAt,
        metadata: item.metadata,
      },
      board: request.board,
      itemRevision: item.revision,
      source,
      fromStage,
      toStage: request.stage,
    } satisfies Omit<FactoryStageRuleContext, 'stage'>;

    let evaluation:
      | { outcome: 'accepted'; decisions: Record<string, unknown>[]; intents: TransitionConsentOptions }
      | { outcome: 'rejected'; code: string; reason: string };
    try {
      evaluation = await withRuleTimeout(
        (async () => {
          // Plans are approved without a person only where the card's phase auto-approves submit_plan.
          const plansAutoApproved = autoApprovedExitTool(boards, item) === 'submit_plan';
          // A phase with an exit tool holds the card until the tool succeeds (for submit_plan, with
          // an approved plan; autoApprove only decides whether it approves itself). Then the agent,
          // or the board's own rule for the tool, moves the card. A person can move it any time.
          const fromPhase = board.phases[fromStage];
          const exitTool = fromPhase?.kind === 'working' ? fromPhase.exitTool : undefined;
          if (
            request.actor.type !== 'human' &&
            !request.eventRoute &&
            exitTool &&
            fromStage !== request.stage &&
            entersWorking &&
            !(exitTool.id === 'submit_plan' ? request.planApproved === true : request.completedTool === exitTool.id) &&
            !exitToolSucceeded(item, fromStage, exitTool.id)
          ) {
            return {
              outcome: 'rejected' as const,
              code: 'approval_required',
              reason:
                exitTool.id === 'submit_plan'
                  ? `${fromPhase!.name} ends when submit_plan comes back with an approved plan; until then the card stays here. Call submit_plan and wait for a person to approve the plan (or for it to be approved automatically), then move the card into ${board.phases[request.stage]?.name ?? request.stage} with factory_transition_work_item.`
                  : `${fromPhase!.name} ends when ${exitTool.id} succeeds; until then the card stays here. A person can also move it from the Factory board or a chat they are signed in to.`,
            };
          }
          const policy = boardTransitionPolicyResultSchema.parse(
            await board.transitionPolicy?.(
              immutablePolicySnapshot({
                ...contextBase,
                item: { ...contextBase.item, triageType: item.triageType },
                initialEntry: request.initialEntry ?? false,
                reenter: request.reenter ?? false,
                isHumanTransition: isHumanTransition(request),
                plansAutoApproved,
                planApproved: request.planApproved === true,
                requestedTriageType: undefined,
              }),
            ),
          );
          if (policy?.type === 'reject') {
            return { outcome: 'rejected' as const, code: policy.code, reason: policy.reason };
          }
          const run = phaseRunDecision(board, request.stage, contextBase, {
            initialEntry: request.initialEntry,
            reenter: request.reenter,
          });
          const validated = validateFactoryRuleDecisions(run ? [run] : [], contextBase.causalChain.length).filter(
            decision => {
              assertFactoryDecisionTarget(decision, boards, itemBoard);
              return !(startsRun(decision) && runAlreadyUnderway(request, decision));
            },
          );
          if (humanMove) {
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
                ...(entersWorking && seatRole !== undefined ? { role: seatRole, prepareBinding: true } : {}),
              });
            }
          }
          return {
            outcome: 'accepted' as const,
            intents: {
              accepted: isHumanTransition(request) && acceptsWork(board, fromStage, request.stage),
            },
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
        ? { ...consentEffect(request, entersWorking, humanMove), ...evaluation.intents }
        : {},
      boards,
    );
  }

  async #commitRejection(
    request: FactoryTransitionRequest,
    transitionId: string,
    code: FactoryRuleRejectionCode,
    reason: string,
  ): Promise<FactoryTransitionResult> {
    return this.#commit(
      request,
      transitionId,
      { outcome: 'rejected', code, reason: reason.slice(0, MAX_REJECTION_REASON) },
      {},
      undefined,
    );
  }

  async #commit(
    request: FactoryTransitionRequest,
    transitionId: string,
    evaluation:
      | { outcome: 'accepted'; decisions: Record<string, unknown>[] }
      | { outcome: 'rejected'; code: string; reason: string },
    options: TransitionConsentOptions,
    // The registry the move was evaluated against; rejected moves never release resources.
    boards: BoardRegistry | undefined,
  ): Promise<FactoryTransitionResult> {
    const committed = await this.#storage.commitTransition({
      autonomy: options.autonomy,
      consentedBy: options.consentedBy,
      orgId: request.orgId,
      factoryProjectId: request.factoryProjectId,
      workItemId: request.workItemId,
      expectedRevision: request.expectedRevision,
      destinationStage: request.stage,
      actorId: actorId(request.actor),
      ingress: { identity: request.ingress.identity, triggerType: request.ingress.type, transitionId },
      configVersion: this.#configVersion,
      causalChain: [...(request.causalChain ?? [])],
      evaluation,
    });
    if (committed.status === 'missing') {
      return rejection(transitionId, request.workItemId, 'invalid_transition', 'Work item not found.');
    }
    const result = committed.result as unknown as FactoryTransitionResult;
    if (
      this.#onAccepted &&
      options.accepted &&
      committed.status === 'committed' &&
      result.status === 'accepted' &&
      committed.item
    ) {
      const item = committed.item;
      const onAccepted = this.#onAccepted;
      // Invoke inside the chain so a synchronous throw is isolated the same way an async rejection is.
      void Promise.resolve()
        .then(() =>
          onAccepted({
            orgId: request.orgId,
            factoryProjectId: request.factoryProjectId,
            workItemId: request.workItemId,
            item,
          }),
        )
        .catch(error => {
          console.warn(`[factory] acceptance hook failed for work item ${request.workItemId}:`, error);
        });
    }
    // Only an installed board's declaration releases resources; an unknown board or phase never does.
    if (
      this.#onTerminalStage &&
      result.status === 'accepted' &&
      boards?.get(request.board)?.isTerminal(result.stage) === true
    ) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const cleanup = Promise.resolve(
          this.#onTerminalStage({
            orgId: request.orgId,
            factoryProjectId: request.factoryProjectId,
            workItemId: request.workItemId,
            stage: result.stage,
            revision: result.revision,
            actor: request.actor,
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
