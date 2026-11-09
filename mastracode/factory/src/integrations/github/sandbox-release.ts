import type { FactorySandbox } from '@mastra/core/workspace';

import { evictSessionSandbox, peekSessionSandbox } from '../../sandbox/session-sandbox.js';
import type { SourceControlSession } from '../../storage/domains/source-control/base.js';

/**
 * Stop or destroy the sandbox a session holds in this process, dropping it
 * from the per-process memo first so later opens construct fresh.
 *
 * Sandbox identity is the session id, so there is no reuse pool to publish
 * into — a reopened session resolves the same id through its provider
 * (reconnect/resume, or a fresh VM whose setup hook re-materializes).
 * Sessions never opened in this replica have no memo entry; destroying those
 * goes through {@link destroyDetachedSessionSandbox}.
 */
export async function releaseSessionSandbox(options: {
  /** The session's storage row id (the sandbox identity). */
  sessionId: string;
  /** Destroy instead of stop — for sessions that are gone for good. */
  destroy?: boolean;
}): Promise<void> {
  const entry = peekSessionSandbox(options.sessionId);
  if (!entry) return;
  evictSessionSandbox(options.sessionId);
  const sandbox = entry.sandbox as unknown as {
    _stop?: () => Promise<void>;
    _destroy?: () => Promise<void>;
    stop?: () => Promise<void>;
    destroy?: () => Promise<void>;
    status?: string;
  };
  if (options.destroy) {
    // Constructed here but never started: the lifecycle wrapper treats that as
    // nothing to clean up, yet the VM may exist from an earlier process. The
    // provider's own destroy kills it by identity without resuming.
    if (sandbox.status === 'pending' && sandbox.destroy) {
      await sandbox.destroy();
      return;
    }
    await (sandbox._destroy ? sandbox._destroy() : sandbox.destroy?.());
    return;
  }
  await (sandbox._stop ? sandbox._stop() : sandbox.stop?.());
}

/**
 * Destroy a session's VM by identity from a process that holds no instance of
 * it. Constructs the provider sandbox (cheap, side-effect-free by contract)
 * and calls its plain `destroy()` — never `start()` and never the `_destroy`
 * lifecycle wrapper, which skips sandboxes this instance never started.
 */
export async function destroyDetachedSessionSandbox(options: {
  sandbox: FactorySandbox;
  session: Pick<SourceControlSession, 'id' | 'sandboxId'>;
}): Promise<void> {
  const sandbox = options.sandbox.create(
    {
      sessionId: options.session.id,
      sandboxId: options.session.sandboxId ?? undefined,
      getRepositoryAccess: undefined,
    },
    {},
  );
  await sandbox.destroy();
}

/**
 * Tear down the sandbox a just-deleted user session was holding. The row is
 * already gone, so the VM is destroyed rather than stopped — nothing will
 * ever resolve this session id again.
 */
export async function reclaimDeletedSessionSandbox(options: {
  session: Pick<SourceControlSession, 'id'>;
}): Promise<void> {
  await releaseSessionSandbox({ sessionId: options.session.id, destroy: true });
}
