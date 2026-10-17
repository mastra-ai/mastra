import type { IMastraLogger } from '../../../../logger';
import type { MastraMemory } from '../../../../memory/memory';
import type { MemoryConfig } from '../../../../memory/types';
import { MessageList } from '../../../message-list';
import type { DurableToolCallOutput } from '../../types';
import { commitDurableToolResults } from './commit-tool-results';

/** Finished tool-call outputs of a suspended step's siblings, read from the suspended run result. */
function collectFinishedSiblings(result: { steps?: Record<string, unknown> }): DurableToolCallOutput[] {
  const finished: DurableToolCallOutput[] = [];
  for (const stepResult of Object.values(result.steps ?? {})) {
    const step = stepResult as { status?: string; suspendPayload?: { __workflow_meta?: { foreachOutput?: unknown } } };
    if (step?.status !== 'suspended') continue;
    const foreachOutput = step.suspendPayload?.__workflow_meta?.foreachOutput;
    if (!Array.isArray(foreachOutput)) continue;
    for (const entry of foreachOutput as Array<{ status?: string; output?: DurableToolCallOutput }>) {
      if (entry?.status === 'success' && entry.output?.toolCallId && entry.output.toolName) {
        finished.push(entry.output);
      }
    }
  }
  return finished;
}

/**
 * When a durable step suspends, the steps that commit tool results never run
 * for it, so the results of sibling calls that finished stay `call` in memory
 * and drop out of the next prompt (#26514). Commit them to the thread from the
 * suspended run result, the same way the llm-mapping step would.
 */
export async function commitSuspendedDurableSiblings({
  result,
  memory,
  threadId,
  resourceId,
  memoryConfig,
  tools,
  logger,
}: {
  result: { steps?: Record<string, unknown> };
  memory?: MastraMemory;
  threadId?: string;
  resourceId?: string;
  memoryConfig?: MemoryConfig;
  tools?: Record<string, unknown>;
  logger?: IMastraLogger;
}): Promise<void> {
  if (!memory || !threadId || memoryConfig?.readOnly) return;
  const finished = collectFinishedSiblings(result);
  if (!finished.length) return;

  const { messages } = await memory.recall({ threadId, resourceId, perPage: false });
  const messageList = new MessageList({ threadId, resourceId }).add(messages, 'memory');
  const ids = new Set(finished.map(output => output.toolCallId));
  const owners = () =>
    messageList.get.all
      .db()
      .filter(message =>
        message.content.parts?.some(part => part.type === 'tool-invocation' && ids.has(part.toolInvocation.toolCallId)),
      );
  // Snapshot before committing so only messages the commit changed are saved.
  const before = new Map(owners().map(message => [message.id, JSON.stringify(message.content)]));
  if (!before.size) return;

  await commitDurableToolResults(messageList, finished, { tools });

  const changed = owners().filter(message => before.get(message.id) !== JSON.stringify(message.content));
  if (!changed.length) return;
  await memory.saveMessages({ messages: changed, memoryConfig });
  logger?.debug('Committed finished sibling tool results of a suspended step', {
    threadId,
    toolCallIds: [...ids],
  });
}
