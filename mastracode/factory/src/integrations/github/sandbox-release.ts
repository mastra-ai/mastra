import type { SandboxFleet } from '../../sandbox/fleet.js';
import type { SourceControlStorageHandle } from '../../storage/domains/source-control/base.js';
import type { WorkItemsStorage } from '../../storage/domains/work-items/base.js';
import { recycleClaimedWorkdir } from './sandbox.js';

/**
 * Scrub a sandbox that is about to enter the reuse pool: force-checkout the
 * default branch and drop the released session's local state, so idle pooled
 * VMs don't sit on stale branches, dirty worktrees, or abandoned work while
 * they wait for the next claim. Best-effort — the VM may already be reaped
 * (the pooled claim then falls back to fresh provisioning) and the claim
 * path recycles the workdir again before reuse, so a failed scrub never
 * blocks the release.
 */
export async function cleanReleasedSandbox(options: {
  fleet: Pick<SandboxFleet, 'reattachSandbox'>;
  sourceControl: Pick<SourceControlStorageHandle, 'projectRepositories' | 'repositories'>;
  orgId: string;
  projectRepositoryId: string;
  sandboxId: string;
  sandboxWorkdir: string;
}): Promise<void> {
  try {
    const projectRepository = await options.sourceControl.projectRepositories.get({
      orgId: options.orgId,
      id: options.projectRepositoryId,
    });
    if (!projectRepository) return;
    const repository = await options.sourceControl.repositories.get({
      orgId: options.orgId,
      id: projectRepository.repositoryId,
    });
    if (!repository) return;
    const sandbox = await options.fleet.reattachSandbox(options.sandboxId);
    await recycleClaimedWorkdir(sandbox, options.sandboxWorkdir, repository.defaultBranch);
  } catch {
    // Reaped, unreachable, or wedged — the claim-side recycle is the
    // correctness guarantee; this scrub is hygiene for idle VMs.
  }
}

/**
 * Release the sandboxes held by a work item's sessions back to the reuse pool.
 *
 * Called when the item commits into a terminal stage (`done` / `canceled`):
 * its branch sessions stop receiving runs, so their VMs — which would
 * otherwise idle until the provider reaps them — can serve the next session
 * for the same repository instead of a fresh provision. Each session
 * keeps its row (a reopened branch simply claims a pooled VM or provisions
 * fresh on next use); it only loses its sandbox binding.
 */
export async function releaseWorkItemSandboxes(options: {
  workItems: Pick<WorkItemsStorage, 'get'>;
  sourceControl: Pick<SourceControlStorageHandle, 'sessions' | 'sandboxPool' | 'projectRepositories' | 'repositories'>;
  fleet: Pick<SandboxFleet, 'reattachSandbox'>;
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
    await cleanReleasedSandbox({
      fleet: options.fleet,
      sourceControl,
      orgId: session.orgId,
      projectRepositoryId: session.projectRepositoryId,
      sandboxId: session.sandboxId,
      sandboxWorkdir: session.sandboxWorkdir,
    });
    await sourceControl.sandboxPool.release({
      orgId: session.orgId,
      projectRepositoryId: session.projectRepositoryId,
      userId: session.userId,
      sandboxId: session.sandboxId,
      sandboxWorkdir: session.sandboxWorkdir,
    });
    await sourceControl.sessions.setSandbox({
      id: session.id,
      sandboxId: null,
      sandboxWorkdir: session.sandboxWorkdir,
    });
  }
}
