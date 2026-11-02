/**
 * Filing a work item, shared by the board's create route and the Factory tools
 * so a card filed from a session goes through exactly what "New card" does.
 */

import type { BoardRegistry } from '../boards/index.js';
import type { FactoryTransitionRequest, FactoryTransitionService } from '../rules/transition-service.js';
import type { EmitAuditInput } from '../storage/domains/audit/domain.js';
import type { CreateWorkItemInput, WorkItemRow, WorkItemsStorage } from '../storage/domains/work-items/base.js';

/** Records one audit event for the caller; routes bind it to the request, tools to the session's person. */
export type FactoryAuditEmit = (input: EmitAuditInput) => Promise<void>;

type TransitionResult = Awaited<ReturnType<FactoryTransitionService['transition']>>;

export type CreateFactoryWorkItemResult =
  /** A new card, entered into its board's first phase and audited. */
  | { status: 'created'; item: WorkItemRow }
  /** The source key matched an existing card, which was updated instead (the caller audits the patch). */
  | { status: 'reused'; item: WorkItemRow }
  | {
      status: 'refused';
      code: 'invalid_board' | 'governed_transition_required' | 'factory_transitions_unavailable';
      message: string;
    }
  /** The first phase's entry rules refused the card; it was removed again. */
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
  origin,
}: CreateFactoryWorkItemArgs): Promise<CreateFactoryWorkItemResult> {
  const boardId = input.board ?? (input.externalSource?.type === 'pull-request' ? 'review' : 'work');
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
  const result = await workItems.upsert({
    orgId,
    userId,
    factoryProjectId,
    input: { ...input, board: boardId, stages: initialStages },
    reuseMode: 'non-stage',
  });
  if (!result.created) return { status: 'reused', item: result.item };

  const created = result.item;
  if (!transitionService) {
    await workItems.delete({ orgId, id: created.id });
    return {
      status: 'refused',
      code: 'factory_transitions_unavailable',
      message: 'Factory stage transitions are not available right now.',
    };
  }
  const entered = await transitionService.transition({
    orgId,
    factoryProjectId,
    workItemId: created.id,
    board: boardId,
    stage: board.initialPhase,
    expectedRevision: created.revision,
    actor: { type: 'human', id: userId },
    ...origin,
    ingress: { type: 'human', identity: `work-item:${created.id}:initial-entry` },
    cause: 'work_item_created',
    initialEntry: true,
  });
  if (entered.status === 'rejected') {
    await workItems.delete({ orgId, id: created.id });
    return { status: 'rejected', code: entered.code, reason: entered.reason };
  }
  const item = (await workItems.getForProject(orgId, factoryProjectId, created.id)) ?? created;
  await audit({
    action: 'factory.work_item.created',
    factoryProjectId,
    targets: [{ type: 'work_item', id: item.id, name: item.title }],
    metadata: { externalSource: item.externalSource, stages: item.stages },
  });
  return { status: 'created', item };
}
