/**
 * Filing a work item, shared by the board's create route and the Factory tools
 * so a card filed from a session goes through exactly what "New card" does.
 */

import { cardRuleFacts } from '../boards/index.js';
import type { BoardRegistry } from '../boards/index.js';
import type { IntakeOrderMeasure } from '../boards/intake-order-migration.js';
import { INTAKE_ROUTE_METADATA_KEY, resolveIntake } from '../boards/intake-routing.js';
import type { IntakeRoutesReader } from '../boards/intake-routing.js';
import type { FactoryTransitionRequest, FactoryTransitionService } from '../rules/transition-service.js';
import type { EmitAuditInput } from '../storage/domains/audit/domain.js';
import type { IntakeEvaluator } from '../storage/domains/boards/base.js';
import { WorkItemUpdateConflictError } from '../storage/domains/work-items/base.js';
import type { CreateWorkItemInput, Card, WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { CARD_NUMBER_METADATA_KEY } from './card-number.js';

/** Records one audit event for the caller; routes bind it to the request, tools to the session's person. */
export type FactoryAuditEmit = (input: EmitAuditInput) => Promise<void>;

type TransitionResult = Awaited<ReturnType<FactoryTransitionService['transition']>>;

/** Attempts at each step after the upsert before a card that keeps changing under its creator is left as is. */
const STEP_ATTEMPTS = 3;

/** One past the highest number given to a manually filed card in the project. */
async function nextCardNumber(workItems: WorkItemsStorage, orgId: string, factoryProjectId: string): Promise<number> {
  let highest = 0;
  for (const card of await workItems.listShared({ orgId, factoryProjectId })) {
    const number = card.metadata?.[CARD_NUMBER_METADATA_KEY];
    if (typeof number === 'number' && number > highest) highest = number;
  }
  return highest + 1;
}

export type CreateFactoryWorkItemResult =
  /** A new card, entered into its board's first phase and audited. */
  | { status: 'created'; item: Card }
  /** The source key matched an existing card, which was updated instead (the caller audits the patch). */
  | { status: 'reused'; item: Card }
  | {
      status: 'refused';
      code:
        | 'invalid_board'
        | 'governed_transition_required'
        | 'factory_transitions_unavailable'
        /** No board's intake rules take the card; the person names the board. */
        | 'intake_board_required';
      message: string;
    }
  /** The first phase's entry rules (or the move to an intake route's phase) refused the card; it was removed again unless a concurrent create had already reused it. */
  | { status: 'rejected'; code: Extract<TransitionResult, { status: 'rejected' }>['code']; reason: string };

export interface CreateFactoryWorkItemArgs {
  workItems: WorkItemsStorage;
  boards: BoardRegistry;
  transitionService: Pick<FactoryTransitionService, 'transition'> | undefined;
  audit: FactoryAuditEmit;
  orgId: string;
  /** Who files the card; becomes its `created_by` and the human actor of its first phase entry. */
  userId: string;
  factoryProjectId: string;
  input: CreateWorkItemInput;
  /** The project's intake routes; they place a card filed without a board or stages. */
  intakeRoutes?: IntakeRoutesReader;
  /** Which evaluator places a card filed without a board; the old `route-list` by default. */
  intakeEvaluator?: IntakeEvaluator;
  /** Starts the project's one-time intake order measure in the background. */
  intakeOrderMeasure?: Pick<IntakeOrderMeasure, 'start'>;
  /** Where a browser request came from; a session's tool call carries none. */
  origin?: Pick<FactoryTransitionRequest, 'actorProfile' | 'context'>;
}

/**
 * Upserts the card into its board's first phase, enters that phase as the
 * person (rolling the card back if its entry rules refuse it), then audits
 * `factory.work_item.created`. Throws `WorkItemRelationError` for a bad parent.
 */
export async function createFactoryWorkItem({
  workItems,
  boards,
  transitionService,
  audit,
  orgId,
  userId,
  factoryProjectId,
  input,
  intakeRoutes,
  intakeEvaluator = 'route-list',
  intakeOrderMeasure,
  origin,
}: CreateFactoryWorkItemArgs): Promise<CreateFactoryWorkItemResult> {
  // A card filed without a board goes where intake says; one that names a board went where the
  // person chose. Under the old evaluator a card naming its stages skips the rules too.
  let boardId = input.board;
  let placement: { phase: string; routeId: string } | undefined;
  if (boardId === undefined && !intakeRoutes && intakeEvaluator === 'intake-order') {
    return {
      status: 'refused',
      code: 'intake_board_required',
      message: 'Intake rules are unavailable right now. Pick the board to file it on.',
    };
  }
  if (boardId === undefined) {
    const scope = { orgId, factoryProjectId };
    const evaluator = intakeRoutes ? intakeEvaluator : 'route-list';
    const routed = intakeRoutes && (evaluator === 'intake-order' || input.stages === undefined);
    if (routed) intakeOrderMeasure?.start(scope);
    const [routes, order] = routed
      ? await Promise.all([
          intakeRoutes.listIntakeRoutes(scope),
          evaluator === 'intake-order'
            ? intakeRoutes.readIntakeOrder(scope, { boards: [...boards.keys()] })
            : undefined,
        ])
      : [[], undefined];
    const resolution = resolveIntake({
      evaluator,
      routes,
      order: order?.boardKeys ?? [],
      facts: cardRuleFacts({
        title: input.title,
        metadata: input.metadata ?? null,
        externalSource: input.externalSource ?? null,
      }),
      registry: boards,
    });
    // No board's rules take it: the person picks the board.
    if (resolution.outcome === 'not_routed') {
      return {
        status: 'refused',
        code: 'intake_board_required',
        message: `${resolution.reason} Pick the board to file it on.`,
      };
    }
    boardId = resolution.board;
    // Named stages keep the card in the board's first phase; the rule only picked the board.
    if (resolution.routeId !== null && input.stages === undefined) {
      placement = { phase: resolution.phase, routeId: resolution.routeId };
    }
  }
  const board = boards.get(boardId);
  if (!board) return { status: 'refused', code: 'invalid_board', message: `Board '${boardId}' is not installed.` };
  const initialStages = input.stages ?? [board.initialPhase];
  if (initialStages.length !== 1 || initialStages[0] !== board.initialPhase) {
    return {
      status: 'refused',
      code: 'governed_transition_required',
      message: `New work items must enter through the '${board.initialPhase}' phase of board '${boardId}'.`,
    };
  }

  await workItems.ensureReady();
  // A card with no issue behind it has no number of its own, so it gets the project's next one.
  const metadata = input.externalSource
    ? input.metadata
    : {
        ...input.metadata,
        [CARD_NUMBER_METADATA_KEY]: await nextCardNumber(workItems, orgId, factoryProjectId),
      };
  const result = await workItems.upsert({
    orgId,
    userId,
    factoryProjectId,
    input: {
      ...input,
      ...(metadata ? { metadata } : {}),
      board: boardId,
      stages: initialStages,
    },
    reuseMode: 'non-stage',
  });
  // A reused card keeps its own placement, so only a card this call created records the route.
  if (!result.created) return { status: 'reused', item: result.item };

  const id = result.item.id;
  // A concurrent create for the same source can reuse this card at any step below. That caller
  // has already returned it as `reused`, so a step that loses the revision race is retried at the
  // current revision, and the card is never rolled back once anyone else has touched it. A reuse
  // that only refreshes source facts keeps the revision but moves `updatedAt`, so the rollback
  // deletes only while both still match this call's last write.
  let revision: number | undefined = result.item.revision;
  let updatedAt = result.item.updatedAt;
  let contended = false;
  const reread = async () => {
    contended = true;
    revision = (await workItems.getForProject(orgId, factoryProjectId, id))?.revision;
  };
  const rollBack = async () => {
    if (contended || revision === undefined) return;
    await workItems.delete({ orgId, id, expectedRevision: revision, expectedUpdatedAt: updatedAt });
  };
  const notFound = { status: 'rejected', code: 'invalid_transition', reason: 'Work item not found.' } as const;

  if (placement) {
    for (let attempt = 1; revision !== undefined; attempt++) {
      try {
        const stamped = await workItems.update({
          orgId,
          id,
          userId,
          patch: { metadata: { [INTAKE_ROUTE_METADATA_KEY]: placement.routeId } },
          expectedRevision: revision,
        });
        revision = stamped?.item.revision;
        if (stamped) updatedAt = stamped.item.updatedAt;
        break;
      } catch (error) {
        const stale = error instanceof WorkItemUpdateConflictError && error.reason === 'revision';
        if (!stale || attempt >= STEP_ATTEMPTS) throw error;
        await reread();
      }
    }
    if (revision === undefined) return notFound;
  }
  if (!transitionService) {
    await rollBack();
    return {
      status: 'refused',
      code: 'factory_transitions_unavailable',
      message: 'Factory stage transitions are not available right now.',
    };
  }
  const transition = async (
    request: Omit<FactoryTransitionRequest, 'expectedRevision'>,
  ): Promise<TransitionResult | undefined> => {
    for (let attempt = 1; revision !== undefined; attempt++) {
      const transitioned = await transitionService.transition({ ...request, expectedRevision: revision });
      // The result carries no timestamp, so `updatedAt` stays at the last write this call saw; the
      // commit has moved the card past it, so a later rollback keeps the card instead of guessing.
      if (transitioned.status === 'accepted') revision = transitioned.revision;
      if (transitioned.status !== 'rejected' || transitioned.code !== 'stale' || attempt >= STEP_ATTEMPTS) {
        return transitioned;
      }
      await reread();
    }
    return undefined;
  };

  const entered = await transition({
    orgId,
    factoryProjectId,
    workItemId: id,
    board: boardId,
    stage: board.initialPhase,
    actor: { type: 'human', id: userId },
    ...origin,
    ingress: { type: 'human', identity: `work-item:${id}:initial-entry` },
    cause: 'work_item_created',
    initialEntry: true,
  });
  if (!entered) return notFound;
  if (entered.status === 'rejected') {
    await rollBack();
    return { status: 'rejected', code: entered.code, reason: entered.reason };
  }
  if (placement && placement.phase !== board.initialPhase) {
    const moved = await transition({
      orgId,
      factoryProjectId,
      workItemId: id,
      board: boardId,
      stage: placement.phase,
      // The route moves the card, not the person: a run it starts still needs their consent.
      actor: { type: 'system', id: 'factory-intake-route' },
      ingress: { type: 'rule', identity: `work-item:${id}:intake-route` },
      cause: 'work_item_created',
    });
    if (!moved) return notFound;
    if (moved.status === 'rejected') {
      await rollBack();
      return { status: 'rejected', code: moved.code, reason: moved.reason };
    }
  }
  const item = (await workItems.getForProject(orgId, factoryProjectId, id)) ?? result.item;
  await audit({
    action: 'factory.work_item.created',
    factoryProjectId,
    targets: [{ type: 'work_item', id: item.id, name: item.title }],
    metadata: { externalSource: item.externalSource, stages: item.stages },
  });
  return { status: 'created', item };
}
