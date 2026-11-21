import type { IMastraLogger } from '../../logger';
import type { MastraMemory } from '../../memory/memory';
import { isObservationalMemoryEnabled } from '../../memory/types';
import type { MemoryConfigInternal } from '../../memory/types';
import type { MessageList } from '../message-list';
import type { SaveQueueManager } from './index';

/**
 * A processOutputResult tripwire skips the run-level save and, by default, rolls back the
 * response messages the run already stored. When the aborter asks to keep them instead
 * (`abort(reason, { persist: 'partial' })`), save the turn: this both preserves an early
 * save (a flush before a tool-approval suspension, or per step with savePerStep) and
 * writes the turn when nothing was saved yet. The store overwrites by message id, so a
 * repeat save of rows this run already wrote is harmless.
 *
 * Observational Memory owns its own saving, so no keep-save runs under it — the same rule
 * `onStepFinish` applies to per-step saves. Errors are logged, not thrown: a failed keep-save
 * must never change the outcome of a run that already tripped. The one exception is an error
 * the caller names through `rethrow` — the durable ownership fence, which the ordinary save
 * rethrows so a superseded run stops before it reaches structured output, title generation and
 * the finish event.
 */
export async function persistPartialTurn({
  memory,
  threadId,
  memoryConfig,
  messageList,
  saveQueueManager,
  authorize,
  beforePersist,
  rethrow,
  logger,
  runId,
}: {
  memory: MastraMemory | undefined;
  threadId: string | undefined;
  memoryConfig: MemoryConfigInternal | undefined;
  messageList: MessageList;
  saveQueueManager: SaveQueueManager | undefined;
  authorize?: () => Promise<void>;
  /**
   * Guard the save queue runs immediately before writing, e.g. the durable execution-ownership
   * fence (`assertExecutionOwned`). A rejection skips the save, as a failed authorization does.
   */
  beforePersist?: () => Promise<void>;
  /**
   * Errors that must fail the run instead of being logged, e.g. `isExecutionFenceError`. Losing
   * the execution means this run no longer owns the thread, so the caller has to stop.
   */
  rethrow?: (error: unknown) => boolean;
  logger: IMastraLogger;
  runId: string;
}) {
  if (!memory || !threadId || memoryConfig?.readOnly) return;
  if (isObservationalMemoryEnabled(memoryConfig?.observationalMemory)) return;

  try {
    await authorize?.();
    await saveQueueManager?.flushMessages(messageList, threadId, memoryConfig, { beforePersist });
  } catch (error) {
    if (rethrow?.(error)) throw error;
    logger.error('Failed to keep a partial turn after an output processor tripwire', { error, runId, threadId });
  }
}
