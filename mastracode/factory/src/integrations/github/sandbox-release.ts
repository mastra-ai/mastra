import type { MaterializationSandbox, SandboxFleet } from '../../sandbox/fleet.js';
import type { SourceControlStorageHandle } from '../../storage/domains/source-control/base.js';
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
  sandbox?: MaterializationSandbox;
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
    const sandbox = options.sandbox ?? (await options.fleet.reattachSandbox(options.sandboxId));
    await recycleClaimedWorkdir(sandbox, options.sandboxWorkdir, repository.defaultBranch);
  } catch {
    // Reaped, unreachable, or wedged — the claim-side recycle is the
    // correctness guarantee; this scrub is hygiene for idle VMs.
  }
}
