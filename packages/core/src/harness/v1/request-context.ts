import { RequestContext } from '@internal/core/request-context';

export type HarnessRequestContextSource = {
  type: 'top-level' | 'subagent-tool' | 'direct-local' | 'remote-resolve';
  parentSessionId?: string;
};

export interface HarnessRequestContext<TState = unknown> {
  harnessId: string;
  sessionId: string;
  ownerId: string;
  resourceId: string;
  threadId: string;
  modeId: string;
  modelId: string;
  parentSessionId?: string;
  subagentDepth: number;
  source: HarnessRequestContextSource;
  getState(): Readonly<TState>;
}

export type BuildHarnessRequestContextOptions<TState> = {
  harnessContext: HarnessRequestContext<TState>;
  /** Optional caller-provided context whose entries are carried forward before
   * the harness context is layered on top. */
  base?: RequestContext;
};

/**
 * Capability fields the v1 harness context does not itself provide but that the
 * HarnessCompat era forwards from the legacy harness so tools rendered through
 * v1 dispatch (e.g. the executing `subagent`, `ask_user`, `submit_plan`) can
 * reach the legacy display/HITL pipeline. Only these are carried forward — v1's
 * own identity/state fields (`sessionId`, `modelId`, `getState`, `setState`, …)
 * always win, so legacy state accessors never leak into the v1 run.
 */
const CARRIED_CAPABILITY_FIELDS = ['emitEvent', 'registerQuestion', 'registerPlanApproval', 'abortSignal'] as const;

export function buildHarnessRequestContext<TState>({
  harnessContext,
  base,
}: BuildHarnessRequestContextOptions<TState>): RequestContext {
  const requestContext = base ?? new RequestContext<unknown>();
  const existing = requestContext.get('harness');
  const merged: Record<string, unknown> = { ...(harnessContext as unknown as Record<string, unknown>) };
  if (existing && typeof existing === 'object') {
    const existingRecord = existing as Record<string, unknown>;
    for (const field of CARRIED_CAPABILITY_FIELDS) {
      // Only fill a capability the v1 context did not already supply.
      if (existingRecord[field] !== undefined && merged[field] === undefined) {
        merged[field] = existingRecord[field];
      }
    }
  }
  requestContext.set('harness', merged);
  return requestContext;
}
