import { MastraFGAPermissions } from '../../auth/ee';
import type { Mastra } from '../../mastra';
import { filterMessagesForPersistence } from '../filter-messages-for-persistence';
import { assertExecutionOwned, DurableExecutionFenceError, EXECUTION_TIMED_OUT_ERROR_ID } from './execution-fence';
import { authorizeDurableMemory, getDurableMemoryAuthorizationChecks } from './memory-fga';
import { getRunRegistryEntry } from './run-registry';
import type { DurableAgenticWorkflowInput } from './types';

/**
 * Save the run's accepted input through its in-process registry entry, before
 * the run starts, wherever the finish path would save the turn. No-op when the
 * entry lacks memory or a message list, the thread is unknown, memory is
 * read-only, nothing saves the turn as history, or an input processor tripped
 * the run.
 * @internal
 */
export async function persistDurableRunInput(
  runId: string,
  workflowInput: Pick<DurableAgenticWorkflowInput, 'agentId' | 'state' | 'options'>,
  mastra: Mastra | undefined,
): Promise<void> {
  const entry = getRunRegistryEntry(runId, mastra);
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
  const writer = entry.historyWriter ?? { kind: 'memory' };
  if (writer.kind === 'none') return;

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
  const assertOwned = async () => {
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
  };
  // A configured MessageHistory may use its own storage; save where the finish path would.
  if (writer.kind === 'processor') {
    const input = filterMessagesForPersistence(entry.messageList.get.input.db());
    if (input.length === 0) return;
    await assertOwned();
    await writer.processor.persistMessages({
      messages: entry.messageList.transformMessagesForTranscript(input),
      threadId: state.threadId,
      resourceId: state.resourceId,
    });
    return;
  }
  // Input membership is also used by OM and tool context, not just persistence.
  // Save a copy so later consumers still see the accepted request; saves upsert by ID.
  await entry.saveQueueManager.flushMessages(entry.messageList.clone(), state.threadId, state.memoryConfig, {
    throwOnError: true,
    beforePersist: assertOwned,
  });
}
