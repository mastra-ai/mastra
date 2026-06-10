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

export function buildHarnessRequestContext<TState>({
  harnessContext,
  base,
}: BuildHarnessRequestContextOptions<TState>): RequestContext {
  const requestContext = base ?? new RequestContext<unknown>();
  requestContext.set('harness', harnessContext);
  return requestContext;
}
