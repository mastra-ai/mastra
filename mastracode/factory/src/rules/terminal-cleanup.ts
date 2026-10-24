import { currentStageEnteredAt } from '../storage/domains/work-items/base.js';
import type { FactoryRunBindingRecord, WorkItemsStorage } from '../storage/domains/work-items/base.js';

export interface TerminalStageCleanupOptions {
  workItems: Pick<
    WorkItemsStorage,
    | 'get'
    | 'listRunBindings'
    | 'revokeRunBinding'
    | 'revokeRunBindingsForWorkItem'
    | 'supersedeDecisionsForWorkItem'
    | 'findRunBindingBySession'
  >;
  /** Final ingest of trailing tool results before the binding is revoked. */
  reconcileBinding?: (binding: FactoryRunBindingRecord) => Promise<void>;
  /**
   * Abort the live controller run bound to a retired seat. Without this the
   * model keeps executing unbound after its binding is revoked (its transition
   * tool vanishes or throws), and the parked run can later be resumed and
   * rationalize a false blocked state.
   */
  abortSession?: (binding: FactoryRunBindingRecord) => Promise<void>;
  /** Release the item's session sandboxes back to the reuse pool. */
  releaseSandboxes?: (args: TerminalStageCleanupArgs & { preserveSessionIds?: string[] }) => Promise<unknown>;
}

export interface TerminalStageCleanupArgs {
  orgId: string;
  factoryProjectId: string;
  workItemId: string;
  /** Revision produced by the terminal transition that scheduled this cleanup. */
  revision?: number;
  /**
   * When the card entered the terminal stage. Seats created at or after it
   * belong to that stage's own close-out and are left running; cleanup bails
   * only if the card has since left this entry.
   */
  stageEnteredAt?: Date;
  /**
   * The bound agent seat whose own tool call drove this terminal transition, if
   * any. Its run is already returning from the tool call; aborting it would
   * interrupt its own completion, so it is left alone.
   */
  initiatingBindingId?: string;
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
    const cutoff = args.stageEnteredAt;
    if (cutoff) {
      // Minting the close-out's own seat bumps the revision, so key on the
      // terminal entry instead: bail only once the card has left it.
      if (!item || currentStageEnteredAt(item)?.getTime() !== cutoff.getTime()) return;
    } else if (args.revision !== undefined && item?.revision !== args.revision) {
      return;
    }
    const retired = (binding: FactoryRunBindingRecord) => !cutoff || binding.createdAt.getTime() < cutoff.getTime();
    const preserveSessionIds = new Set<string>();

    // Stop the live runs still executing on this item's seats before the
    // bindings are revoked, so no model keeps running unbound (and no parked
    // run can later be resumed) once its transition tool is gone.
    if (options.abortSession) {
      try {
        const active = await options.workItems.listRunBindings(args.orgId, args.factoryProjectId, args.workItemId);
        for (const binding of active) {
          if (binding.status !== 'active' || !retired(binding)) continue;
          // The seat that drove this transition is already ending gracefully.
          if (binding.id === args.initiatingBindingId) continue;
          // A role handoff, reopen, or this stage's own close-out may have
          // rebound this session to a newer active run since the listing (for
          // this item or another); aborting the session would kill that
          // successor. Only abort while this binding still owns the session.
          // If the lookup fails we cannot rule out a successor, so skip the
          // abort — revocation below still severs this seat's authority, and a
          // false abort would kill a live run for a different work item.
          let current: FactoryRunBindingRecord | null;
          try {
            current = await options.workItems.findRunBindingBySession({
              factoryProjectId: binding.factoryProjectId,
              threadId: binding.threadId,
              resourceId: binding.resourceId,
              sessionId: binding.sessionId,
            });
          } catch {
            continue;
          }
          if (current?.status === 'active' && current.id !== binding.id) continue;
          await options.abortSession(binding).catch(() => {});
        }
      } catch {
        // Best-effort; revocation below still severs the seat's authority.
      }
    }

    try {
      if (cutoff) {
        const bindings = await options.workItems.listRunBindings(args.orgId, args.factoryProjectId, args.workItemId);
        for (const binding of bindings) {
          if (binding.status !== 'active') continue;
          if (!retired(binding)) {
            preserveSessionIds.add(binding.sessionId);
            continue;
          }
          await options.workItems.revokeRunBinding({
            orgId: args.orgId,
            factoryProjectId: args.factoryProjectId,
            bindingId: binding.id,
            revokedAt: new Date(),
          });
        }
      } else {
        await options.workItems.revokeRunBindingsForWorkItem({
          orgId: args.orgId,
          factoryProjectId: args.factoryProjectId,
          workItemId: args.workItemId,
          revokedAt: new Date(),
        });
      }
    } catch {
      // Best-effort; the staleness sweep retries later.
    }
    try {
      await options.workItems.supersedeDecisionsForWorkItem({
        orgId: args.orgId,
        factoryProjectId: args.factoryProjectId,
        workItemId: args.workItemId,
        supersededAt: new Date(),
      });
    } catch {
      // Best-effort; legacy rows are repaired at the next startup.
    }
    try {
      await options.releaseSandboxes?.(
        preserveSessionIds.size > 0 ? { ...args, preserveSessionIds: [...preserveSessionIds] } : args,
      );
    } catch {
      // Best-effort; a leaked sandbox is retired by the next reconcile walk.
    }
  };
}
