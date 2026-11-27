import { MastraFGAPermissions } from '../../auth/ee';
import type { Mastra } from '../../mastra';
import { assertExecutionOwned } from './execution-fence';
import { authorizeDurableMemory, getDurableMemoryAuthorizationChecks } from './memory-fga';
import { getRunMessageRefs, releaseRunMessageRefs } from './run-message-refs';
import { getRunRegistryEntry } from './run-registry';
import type { DurableAgenticWorkflowInput } from './types';

/**
 * Save the run's accepted input to memory through its in-process registry
 * entry, before the run starts. No-op when the entry lacks memory or a message
 * list, the thread is unknown, memory is read-only, or an input processor
 * tripped the run. `beforeSave` runs once the save is authorized, right before it.
 * @internal
 */
export async function persistDurableRunInput(
  runId: string,
  workflowInput: Pick<DurableAgenticWorkflowInput, 'agentId' | 'state' | 'options'>,
  mastra: Mastra | undefined,
  beforeSave?: () => Promise<void>,
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
  if (beforeSave) {
    // The run row it writes makes the run recoverable, so a lost execution must not write it.
    await assertExecutionOwned({ runId, agentId: workflowInput.agentId, mastra, requestContext });
    await beforeSave();
  }
  // Input membership is also used by OM and tool context, not just persistence.
  // Save a copy so later consumers still see the accepted request; saves upsert by ID.
  const inputCopy = entry.messageList.clone();
  // Runs that store refs record this save so their snapshots reference the input; no step has
  // created the run's entry yet (#31237).
  if (state.fixedMemory) getRunMessageRefs(runId);
  try {
    await entry.saveQueueManager.flushMessages(inputCopy, state.threadId, state.memoryConfig, {
      throwOnError: true,
      beforePersist: () =>
        assertExecutionOwned({
          runId,
          agentId: workflowInput.agentId,
          mastra,
          requestContext,
        }),
    });
  } catch (error) {
    // The run does not start, so nothing else releases the entry.
    if (state.fixedMemory) releaseRunMessageRefs(runId);
    throw error;
  }
  // The save embedded the input on the copy. Carry that onto the live list so the finalize step
  // (the SemanticRecall processor, then the final flush) does not embed it again. A finalize on
  // another worker (evented, Inngest) never sees this list; it embeds the input once more into
  // the same rows, because row ids come from the message id.
  const embedded = entry.messageList.getEmbeddedMessages();
  for (const [messageId, textHash] of inputCopy.getEmbeddedMessages()) {
    embedded.set(messageId, textHash);
  }
}
