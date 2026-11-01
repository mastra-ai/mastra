import type { RequestContext } from '@mastra/core/request-context';

import { boardForWorkItem, isPullRequestCard } from '../boards/semantics.js';
import { resolveFactorySessionAddress } from '../rules/binding-context.js';
import { workItemSource } from '../rules/types.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';

/**
 * The head self-review approved for the session's Work card, which a change request must open
 * at. `undefined` leaves the change request ungated; `null` blocks it until self-review approves.
 */
export async function selfReviewApprovedHead(options: {
  requestContext: RequestContext | undefined;
  workItems: WorkItemsStorage;
  projects: FactoryProjectsStorage;
}): Promise<string | null | undefined> {
  const { requestContext, workItems, projects } = options;
  const resolution = await resolveFactorySessionAddress({ requestContext, storage: workItems });
  if (!resolution) return undefined;
  const binding = resolution.binding ?? (await workItems.findActiveRunBinding(resolution.address));
  if (!binding) return undefined;
  const item = await workItems.get({ orgId: binding.orgId, id: binding.workItemId });
  if (!item || boardForWorkItem(item) !== 'work') return undefined;
  // A pull request's own card is reviewed, never self-reviewed.
  if (isPullRequestCard({ source: workItemSource(item.externalSource) })) return undefined;
  if (typeof item.metadata?.openPullRequestNumber === 'number') return undefined;
  // A verdict already recorded still binds the change request to its head.
  if (item.metadata?.selfReviewVerdict === undefined) {
    await projects.ensureReady();
    const project = await projects.get({ orgId: binding.orgId, id: binding.factoryProjectId });
    if (!project?.selfReviewEnabled) return undefined;
  }
  const sha = item.metadata?.selfReviewedHeadSha;
  return item.metadata?.selfReviewVerdict === 'approve' && typeof sha === 'string' ? sha : null;
}
