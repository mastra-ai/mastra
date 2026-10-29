import { MastraFGAPermissions } from '../../auth/ee';
import { createTotalTimeoutNoticeMessages } from '../../loop/shared/record-terminal-error-message';
import { isMastraTimeoutError } from '../../loop/timeout';
import type { Mastra } from '../../mastra';
import type { MemoryConfigInternal } from '../../memory/types';
import { MessageList } from '../message-list';
import { assertExecutionOwned, DurableExecutionFenceError, EXECUTION_TIMED_OUT_ERROR_ID } from './execution-fence';
import { authorizeDurableMemory, getDurableMemoryAuthorizationChecks } from './memory-fga';
import { getRunRegistryEntry } from './run-registry';
import type { DurableAgenticWorkflowInput, RunRegistryEntry } from './types';

type SavedInput = { threadId: string; resourceId: string; memoryConfig?: MemoryConfigInternal };
type TimeoutNoticeState = { input: Promise<SavedInput | undefined>; notice?: Promise<void> };

const timeoutNoticeStates = new WeakMap<RunRegistryEntry, TimeoutNoticeState>();
// An input saved twice (again at the deadline, after the first save lost its claim) still gets one notice.
const noticedEntries = new WeakSet<RunRegistryEntry>();

function isTotalTimeout(error: unknown): boolean {
  return isMastraTimeoutError(error) && error.timeoutType === 'total';
}

/** Save the notice once, after the input, on the same save queue. */
function saveTimeoutNotice(entry: RunRegistryEntry, state: TimeoutNoticeState, error: unknown): Promise<void> {
  state.notice ??= state.input.then(async saved => {
    if (!saved || !entry.saveQueueManager || noticedEntries.has(entry)) return;
    noticedEntries.add(entry);
    const notice = new MessageList({ threadId: saved.threadId, resourceId: saved.resourceId });
    notice.add(
      createTotalTimeoutNoticeMessages({ error, threadId: saved.threadId, resourceId: saved.resourceId }),
      'response',
    );
    await entry.saveQueueManager.flushMessages(notice, saved.threadId, saved.memoryConfig, { throwOnError: true });
  });
  return state.notice;
}

/**
 * Save the timeout notice next to the run's input once `timeout.totalMs`
 * fires, so the next turn does not see the request as unanswered (#28735).
 * Saves only when the input was saved; an input save still running saves it
 * when it finishes.
 * @internal
 */
export async function persistDurableTimeoutNotice(
  runId: string,
  error: unknown,
  mastra: Mastra | undefined,
): Promise<void> {
  if (!isTotalTimeout(error)) return;
  const entry = getRunRegistryEntry(runId, mastra);
  const state = entry && timeoutNoticeStates.get(entry);
  if (state) await saveTimeoutNotice(entry, state, error);
}

/**
 * Save the run's accepted input to memory through its in-process registry
 * entry, before the run starts. No-op when the entry lacks memory or a message
 * list, the thread is unknown, memory is read-only, or an input processor
 * tripped the run.
 *
 * `entry` overrides the registry lookup, for a caller that captured it before
 * the run could be cleaned up. With `assertOwnership: false` the save skips the
 * execution ownership check and relies on the run fence in scope, for a caller
 * already writing under a claim that replaced the execution's own.
 * @internal
 */
export async function persistDurableRunInput(
  runId: string,
  workflowInput: Pick<DurableAgenticWorkflowInput, 'agentId' | 'state' | 'options'>,
  mastra: Mastra | undefined,
  options: { entry?: RunRegistryEntry; assertOwnership?: boolean } = {},
): Promise<void> {
  const entry = options.entry ?? getRunRegistryEntry(runId, mastra);
  const state = workflowInput.state;
  if (
    !entry?.saveQueueManager ||
    !entry.memory ||
    !entry.messageList ||
    !state?.threadId ||
    !state.resourceId ||
    state.memoryConfig?.readOnly ||
    entry.tripwire
  ) {
    return;
  }

  const requestContext = entry.requestContext;
  await authorizeDurableMemory(getDurableMemoryAuthorizationChecks(entry), {
    mastra,
    user: requestContext?.get('user'),
    threadId: state.threadId,
    resourceId: state.resourceId,
    agentId: workflowInput.agentId,
    requestContext,
    permission: MastraFGAPermissions.MEMORY_WRITE,
    actor: workflowInput.options?.actor,
  });
  // Input membership is also used by OM and tool context, not just persistence.
  // Save a copy so later consumers still see the accepted request; saves upsert by ID.
  const save = entry.saveQueueManager.flushMessages(entry.messageList.clone(), state.threadId, state.memoryConfig, {
    throwOnError: true,
    beforePersist: async () => {
      if (options.assertOwnership === false) return;
      try {
        await assertExecutionOwned({
          runId,
          agentId: workflowInput.agentId,
          mastra,
          requestContext,
        });
      } catch (error) {
        // The request was accepted before the deadline, so the deadline alone
        // must not drop it. Any other ownership loss still blocks the save.
        if (error instanceof DurableExecutionFenceError && error.id === EXECUTION_TIMED_OUT_ERROR_ID) return;
        throw error;
      }
    },
  });
  const { threadId, resourceId, memoryConfig } = state;
  const noticeState: TimeoutNoticeState = {
    input: save.then(
      () => ({ threadId, resourceId, memoryConfig }),
      () => undefined,
    ),
  };
  timeoutNoticeStates.set(entry, noticeState);
  await save;
  // A deadline that fired before or during the save has already looked for the input.
  const reason = entry.abortSignal?.reason;
  if (isTotalTimeout(reason)) await saveTimeoutNotice(entry, noticeState, reason);
}
