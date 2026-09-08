/**
 * The one way a new work item enters a factory: upsert the card, then walk it
 * through the governed `intake` initial entry so the board's entry rules run.
 * The HTTP route and the supervisor's `factory_create_work_item` both create
 * through here; a card written any other way skips the lifecycle.
 */

import type { FactoryTransitionService } from './rules/transition-service.js';
import type { FactoryRuleActor } from './rules/types.js';
import type {
  CreateWorkItemInput,
  WorkItemPriorState,
  WorkItemRow,
  WorkItemsStorage,
} from './storage/domains/work-items/base.js';

export type CreateFactoryWorkItemOutcome =
  | { status: 'created'; item: WorkItemRow }
  /** The source key matched an existing card, which the input updated instead. */
  | { status: 'reused'; item: WorkItemRow; previous: WorkItemPriorState }
  /** Intake entry refused the card; it has been deleted again. */
  | { status: 'rejected'; code: string; reason: string }
  /** No transition service is mounted, so nothing can enter intake; the card has been deleted again. */
  | { status: 'unavailable' };

export interface CreateFactoryWorkItemInput {
  workItems: Pick<WorkItemsStorage, 'upsert' | 'delete' | 'getForProject'>;
  transitionService: Pick<FactoryTransitionService, 'transition'> | undefined;
  orgId: string;
  factoryProjectId: string;
  /** Stamped as the card's creator (`created_by`, stage history). */
  userId: string;
  /** Who the initial-entry transition acts as. */
  actor: FactoryRuleActor;
  ingressType: 'human' | 'agent';
  input: CreateWorkItemInput;
  /**
   * Runs once the card exists and before it enters intake, for anything the
   * worker must find on the card the moment the lifecycle starts (a brief on
   * the feed). If it throws, the card is deleted again and the outcome is
   * `rejected`: a card never enters the lifecycle without its brief.
   */
  beforeEntry?: (item: WorkItemRow) => Promise<unknown>;
}

export async function createFactoryWorkItem({
  workItems,
  transitionService,
  orgId,
  factoryProjectId,
  userId,
  actor,
  ingressType,
  input,
  beforeEntry,
}: CreateFactoryWorkItemInput): Promise<CreateFactoryWorkItemOutcome> {
  const result = await workItems.upsert({ orgId, userId, factoryProjectId, input, reuseMode: 'non-stage' });
  let item = result.item;
  if (!result.created) return { status: 'reused', item, previous: result.previous };

  if (!transitionService) {
    await workItems.delete({ orgId, id: item.id });
    return { status: 'unavailable' };
  }
  if (beforeEntry) {
    try {
      await beforeEntry(item);
    } catch (error) {
      await workItems.delete({ orgId, id: item.id });
      return {
        status: 'rejected',
        code: 'entry_preparation_failed',
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }
  const entered = await transitionService.transition({
    orgId,
    factoryProjectId,
    workItemId: item.id,
    board: item.externalSource?.type === 'pull-request' ? 'review' : 'work',
    stage: 'intake',
    expectedRevision: item.revision,
    actor,
    ingress: { type: ingressType, identity: `work-item:${item.id}:initial-entry` },
    cause: 'work_item_created',
    initialEntry: true,
  });
  if (entered.status === 'rejected') {
    await workItems.delete({ orgId, id: item.id });
    return { status: 'rejected', code: entered.code, reason: entered.reason };
  }
  item = (await workItems.getForProject(orgId, factoryProjectId, item.id)) ?? item;
  return { status: 'created', item };
}
