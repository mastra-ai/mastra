/**
 * @deprecated Session facts are now forwarded natively by the AgentController
 * when pulse is configured on Mastra:
 *
 * ```ts
 * new Mastra({ pulse: {} }) // or { pulse: { storage, exporters } }
 * ```
 *
 * Every session the controller creates gets an internal forwarder publishing
 * approval / abort / follow-up / mode / model facts onto the core PulseBus —
 * no per-session wiring in user land. This shim is a no-op retained so old
 * imports keep compiling; it will be removed with the next breaking release.
 */

export interface PulseSessionIds {
  threadId?: string;
  resourceId?: string;
}

interface SubscribableSession {
  subscribe(listener: (event: any) => void): () => void;
}

/** @deprecated No-op — configure `pulse` on Mastra instead (see module docs). */
export function attachPulseSession(
  _session: SubscribableSession,
  _exporter?: unknown,
  _ids: PulseSessionIds = {},
): () => void {
  return () => {};
}
