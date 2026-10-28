import { MastraFGAPermissions } from '../../auth/ee';
import type { Mastra } from '../../mastra';
import { MessageList } from '../message-list';
import { assertExecutionOwned } from './execution-fence';
import { authorizeDurableMemory, getDurableMemoryAuthorizationChecks } from './memory-fga';
import { getRunRegistryEntry } from './run-registry';
import type { DurableAgenticWorkflowInput } from './types';

/**
 * Save the run's accepted input to memory through its in-process registry
 * entry. No-op when the entry lacks memory or a message list, the thread is
 * unknown, memory is read-only, or an input processor tripped the run.
 *
 * Pass `atDeadline` when the run just hit its total timeout: only the accepted
 * input is saved, never unfinished response steps, and the save skips the
 * ownership check that the deadline itself just revoked.
 * @internal
 */
export async function persistDurableRunInput(
  runId: string,
  workflowInput: Pick<DurableAgenticWorkflowInput, 'agentId' | 'state' | 'options'>,
  mastra: Mastra | undefined,
  { atDeadline = false }: { atDeadline?: boolean } = {},
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
  // Input membership is also used by OM and tool context, not just persistence.
  // Save a copy so later consumers still see the accepted request; saves upsert by ID.
  const messageList = atDeadline
    ? new MessageList({ threadId: state.threadId, resourceId: state.resourceId }).add(
        entry.messageList.get.input.db(),
        'input',
      )
    : entry.messageList.clone();
  await entry.saveQueueManager.flushMessages(messageList, state.threadId, state.memoryConfig, {
    throwOnError: true,
    beforePersist: atDeadline
      ? undefined
      : () =>
          assertExecutionOwned({
            runId,
            agentId: workflowInput.agentId,
            mastra,
            requestContext,
          }),
  });
}
