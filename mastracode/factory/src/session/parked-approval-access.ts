import type { SourceControlSession } from '../storage/domains/source-control/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';

export interface CardFollowDependencies {
  workItems?: Partial<Pick<WorkItemsStorage, 'listWorkItemSubscribers' | 'get'>>;
  getSession: (sessionId: string) => Promise<SourceControlSession | null>;
}

/**
 * Whether a person asked for a card's work, so may answer what its session
 * waits on: they filed the card, or a session of theirs follows it.
 */
export async function followsCard(
  deps: CardFollowDependencies,
  workItemId: string | undefined,
  tenant: { orgId: string; userId: string },
): Promise<boolean> {
  const workItems = deps.workItems;
  if (!workItemId || !workItems?.get || !workItems.listWorkItemSubscribers) return false;
  const item = await workItems.get({ orgId: tenant.orgId, id: workItemId });
  if (!item) return false;
  if (item.createdBy === tenant.userId) return true;
  // A follow belongs to its session, and a session can change hands: ask who owns it now.
  const followers = await workItems.listWorkItemSubscribers({ orgId: tenant.orgId, workItemId });
  for (const sessionId of new Set(followers.map(follower => follower.sessionId))) {
    const following = await deps.getSession(sessionId);
    if (following?.orgId === tenant.orgId && following.userId === tenant.userId) return true;
  }
  return false;
}
