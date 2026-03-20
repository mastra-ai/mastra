import type { MastraDBMessage } from '@mastra/core/agent';
import type { ObservationalMemoryRecord } from '@mastra/core/storage';

/** Returned by `turn.start()` — the loaded context for this turn. */
export interface TurnContext {
  messages: MastraDBMessage[];
  systemMessage: string | undefined;
  continuation: MastraDBMessage | undefined;
  otherThreadsContext: string | undefined;
  record: ObservationalMemoryRecord;
}

/** Returned by `step.prepare()` — what the agent needs for this step. */
export interface StepContext {
  /** System messages containing observations (one per cache-stable chunk). */
  systemMessage: string[] | undefined;
  /** Whether buffered chunks were activated in this step. */
  activated: boolean;
  /** Whether a sync observation was triggered in this step. */
  observed: boolean;
  /** Whether an async buffer was triggered in this step. */
  buffered: boolean;
  /** Whether reflection was triggered in this step. */
  reflected: boolean;
  /** Current status snapshot from getStatus(). */
  status: {
    pendingTokens: number;
    threshold: number;
    shouldObserve: boolean;
    shouldBuffer: boolean;
    shouldReflect: boolean;
    canActivate: boolean;
  };
}

/** Returned by `turn.end()` — final turn state. */
export interface TurnResult {
  record: ObservationalMemoryRecord;
}
