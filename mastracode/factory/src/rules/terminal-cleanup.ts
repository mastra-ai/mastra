import type { FactoryRunBindingRecord, WorkItemsStorage } from '../storage/domains/work-items/base.js';

export interface TerminalStageCleanupOptions {
  workItems: Pick<WorkItemsStorage, 'listRunBindings' | 'revokeRunBindingsForWorkItem' | 'dismissProposalsForWorkItem'>;
  /** Final ingest of trailing tool results before the binding is revoked. */
  reconcileBinding?: (binding: FactoryRunBindingRecord) => Promise<void>;
  /** Release the item's session sandboxes back to the reuse pool. */
  releaseSandboxes?: (args: { orgId: string; workItemId: string }) => Promise<unknown>;
}

export interface TerminalStageCleanupArgs {
  orgId: string;
  factoryProjectId: string;
  workItemId: string;
}

/**
 * Terminal-stage cleanup for a work item: ingest any trailing tool results
 * from the item's bound threads, revoke its active run bindings so completed
 * items leave the reconcile walk (the active set otherwise grows forever),
 * dismiss the runs still parked on it, then release its sandboxes. Every step
 * is best-effort — a committed transition never fails on cleanup; leaked
 * bindings are drained by the staleness sweep.
 */
export function createTerminalStageCleanup(options: TerminalStageCleanupOptions) {
  return async (args: TerminalStageCleanupArgs): Promise<void> => {
    try {
      const bindings = await options.workItems.listRunBindings(args.orgId, args.factoryProjectId, args.workItemId);
      for (const binding of bindings) {
        if (binding.status !== 'active') continue;
        // The tool result that drove this terminal transition (e.g. PR
        // creation) may not be ingested yet — reconcile before revoking.
        await options.reconcileBinding?.(binding).catch(() => {});
      }
      await options.workItems.revokeRunBindingsForWorkItem({
        orgId: args.orgId,
        factoryProjectId: args.factoryProjectId,
        workItemId: args.workItemId,
        revokedAt: new Date(),
      });
    } catch {
      // Best-effort; the staleness sweep retries later.
    }
    try {
      // A merged pull request answers its own parked runs: there is nothing
      // left for them to do, so they should stop asking to be started.
      await options.workItems.dismissProposalsForWorkItem({
        orgId: args.orgId,
        factoryProjectId: args.factoryProjectId,
        workItemId: args.workItemId,
        dismissedAt: new Date(),
      });
    } catch {
      // Best-effort; a stranded proposal is still dismissible from the card.
    }
    await options.releaseSandboxes?.(args);
  };
}
