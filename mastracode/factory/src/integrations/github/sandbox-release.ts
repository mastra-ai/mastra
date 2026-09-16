import { evictSessionSandbox, peekSessionSandbox } from '../../sandbox/session-sandbox.js';

/**
 * Stop or destroy the sandbox a session holds in this process, dropping it
 * from the per-process memo first so later opens construct fresh.
 *
 * Sandbox identity is the session id, so there is no reuse pool to publish
 * into — a reopened session resolves the same id through its provider
 * (reconnect/resume, or a fresh VM whose setup hook re-materializes).
 * Sessions never opened in this replica have no memo entry; their VMs are
 * left to the provider's idle lifecycle (pause / idle GC).
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
  };
  if (options.destroy) {
    await (sandbox._destroy ? sandbox._destroy() : sandbox.destroy?.());
    return;
  }
  await (sandbox._stop ? sandbox._stop() : sandbox.stop?.());
}

/**
 * Tear down the sandbox a just-deleted user session was holding. The row is
 * already gone, so the VM is destroyed rather than stopped — nothing will
 * ever resolve this session id again.
 */
export async function reclaimDeletedSessionSandbox(options: {
  session: Pick<import('../../storage/domains/source-control/base.js').SourceControlSession, 'id'>;
}): Promise<void> {
  await releaseSessionSandbox({ sessionId: options.session.id, destroy: true });
}
