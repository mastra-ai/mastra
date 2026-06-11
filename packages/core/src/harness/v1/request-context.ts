import { RequestContext } from '@internal/core/request-context';
import type { HarnessEvent, HarnessQuestionAnswer } from '../types';

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
  state?: Readonly<TState>;
  getState(): Readonly<TState>;
  /** Update harness state (used by stateful built-in tools) */
  setState?: (updates: Partial<TState>) => Promise<void>;
  /** Update harness state in a serialized transaction, optionally emitting events */
  updateState?: <TResult>(
    updater: (state: Readonly<TState>) =>
      | { updates?: Partial<TState>; events?: HarnessEvent[]; result: TResult }
      | Promise<{ updates?: Partial<TState>; events?: HarnessEvent[]; result: TResult }>,
  ) => Promise<TResult>;
  /** Emit a harness event (used by built-in tools to forward UI events) */
  emitEvent?: (event: HarnessEvent) => void;
  /** Abort signal for the current operation (used by blocking built-in tools) */
  abortSignal?: AbortSignal;
  /** Register a pending question resolver (used by ask_user tool) */
  registerQuestion?: (params: { questionId: string; resolve: (answer: HarnessQuestionAnswer) => void }) => void;
  /** Register a pending plan approval resolver (used by submit_plan tool) */
  registerPlanApproval?: (params: {
    planId: string;
    resolve: (result: { action: 'approved' | 'rejected'; feedback?: string }) => void;
  }) => void;
}

export type BuildHarnessRequestContextOptions<TState> = {
  harnessContext: HarnessRequestContext<TState>;
};

export function buildHarnessRequestContext<TState>({
  harnessContext,
}: BuildHarnessRequestContextOptions<TState>): RequestContext {
  const requestContext = new RequestContext<unknown>();
  requestContext.set('harness', harnessContext);
  return requestContext;
}
