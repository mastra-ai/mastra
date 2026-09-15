import type { FactoryRunBindingRecord, WorkItemsStorage } from '../storage/domains/work-items/base.js';

export interface TerminalStageCleanupOptions {
  workItems: Pick<
    WorkItemsStorage,
    'get' | 'listRunBindings' | 'revokeRunBindingsForWorkItem' | 'supersedeTerminalDecisionsForWorkItem'
  >;
  /** Final ingest of trailing tool results before the binding is revoked. */
  reconcileBinding?: (binding: FactoryRunBindingRecord) => Promise<void>;
  /** Release the item's session sandboxes back to the reuse pool. */
  releaseSandboxes?: (args: TerminalStageCleanupArgs) => Promise<unknown>;
}

export interface TerminalStageCleanupArgs {
  orgId: string;
  factoryProjectId: string;
  workItemId: string;
  /** Revision produced by the terminal transition that scheduled this cleanup. */
  revision?: number;
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
    } catch {
      // Best-effort; revocation below does not depend on the listing.
    }
    // Cleanup can outlive the terminal transition's response window. Do not
    // revoke a new binding or retire its workspace if the card has since been
    // re-entered for another pass.
    const item = await options.workItems.get({ orgId: args.orgId, id: args.workItemId }).catch(() => null);
    if (args.revision !== undefined && item?.revision !== args.revision) return;

    try {
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
      await options.workItems.supersedeTerminalDecisionsForWorkItem({
        orgId: args.orgId,
        factoryProjectId: args.factoryProjectId,
        workItemId: args.workItemId,
        supersededAt: new Date(),
      });
    } catch {
      // Best-effort; legacy rows are repaired at the next startup.
    }
    try {
      await options.releaseSandboxes?.(args);
    } catch {
      // Best-effort; a leaked sandbox is retired by the next reconcile walk.
    }
  };
}
