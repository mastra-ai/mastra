import type { RequestContext } from '@mastra/core/request-context';

import { toBoardSource } from '../boards/project-boards.js';
import type { ProjectBoardSource } from '../boards/project-boards.js';
import type { BoardRegistry } from '../boards/registry.js';
import { cardBoardFlow, isPullRequestCard } from '../boards/semantics.js';
import { resolveFactorySessionAddress } from '../rules/binding-context.js';
import { workItemSource } from '../rules/types.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';

/**
 * The head self-review approved for the session's card, which a change request must open at.
 * `undefined` leaves the change request ungated (the card's board has no self-review phase);
 * `null` blocks it until self-review approves.
 */
export async function selfReviewApprovedHead(options: {
  requestContext: RequestContext | undefined;
  workItems: WorkItemsStorage;
  boards: BoardRegistry | ProjectBoardSource;
}): Promise<string | null | undefined> {
  const { requestContext, workItems } = options;
  const resolution = await resolveFactorySessionAddress({ requestContext, storage: workItems });
  if (!resolution) return undefined;
  const binding = resolution.binding ?? (await workItems.findActiveRunBinding(resolution.address));
  if (!binding) return undefined;
  const item = await workItems.get({ orgId: binding.orgId, id: binding.workItemId });
  if (!item) return undefined;
  const boards = await toBoardSource(options.boards).load(binding);
  if (cardBoardFlow(boards, item).selfReview === undefined) return undefined;
  // A pull request's own card is reviewed, never self-reviewed.
  if (isPullRequestCard({ source: workItemSource(item.externalSource) })) return undefined;
  if (typeof item.metadata?.openPullRequestNumber === 'number') return undefined;
  const sha = item.metadata?.selfReviewedHeadSha;
  return item.metadata?.selfReviewVerdict === 'approve' && typeof sha === 'string' ? sha : null;
}
