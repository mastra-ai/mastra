import type { SourceControlStorageHandle } from '../../storage/domains/source-control/base.js';
import type { WorkItemsStorage } from '../../storage/domains/work-items/base.js';

/**
 * Release the sandboxes held by a work item's sessions back to the reuse pool.
 *
 * Called when the item commits into a terminal stage (`done` / `canceled`):
 * its branch sessions stop receiving runs, so their VMs — which would
 * otherwise idle until the provider reaps them — can serve the next session
 * for the same repository and user instead of a fresh provision. Each session
 * keeps its row (a reopened branch simply claims a pooled VM or provisions
 * fresh on next use); it only loses its sandbox binding.
 */
export async function releaseWorkItemSandboxes(options: {
  workItems: Pick<WorkItemsStorage, 'get'>;
  sourceControl: Pick<SourceControlStorageHandle, 'sessions' | 'sandboxPool'>;
  orgId: string;
  workItemId: string;
}): Promise<void> {
  const { workItems, sourceControl } = options;
  const item = await workItems.get({ orgId: options.orgId, id: options.workItemId });
  if (!item) return;
  const sessionIds = [...new Set(Object.values(item.sessions).map(session => session.sessionId))];
  for (const sessionId of sessionIds) {
    const session = await sourceControl.sessions.getBySessionId(sessionId);
    if (!session || session.orgId !== options.orgId) continue;
    if (!session.sandboxId || !session.sandboxWorkdir) continue;
    await sourceControl.sandboxPool.release({
      orgId: session.orgId,
      projectRepositoryId: session.projectRepositoryId,
      userId: session.userId,
      sandboxId: session.sandboxId,
      sandboxWorkdir: session.sandboxWorkdir,
      materializedAt: session.materializedAt,
    });
    await sourceControl.sessions.setSandbox({
      id: session.id,
      sandboxId: null,
      sandboxWorkdir: session.sandboxWorkdir,
    });
  }
}
