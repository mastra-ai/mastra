import { createHash } from 'node:crypto';
import type { MastraMemory } from '../../memory/memory';
import type { MastraDBMessage } from '../message-list';
import type { SerializableDurableState } from './types';

export class TerminalErrorHistorySaveError extends Error {
  constructor(error: Error, saveError: unknown) {
    super(`${error.message} The failure could not be saved: ${String(saveError)}`, { cause: saveError });
    this.name = 'TerminalErrorHistorySaveError';
  }
}

/** Saves framework failure data, never the unvalidated streamed answer. */
export async function persistTerminalError({
  agentId,
  runId,
  state,
  memory,
  error,
  assertOwned,
}: {
  agentId: string;
  runId: string;
  state: SerializableDurableState | undefined;
  memory: MastraMemory | undefined;
  error: Error;
  assertOwned?: () => void;
}): Promise<void> {
  if (!memory || !state?.threadId || !state.resourceId) return;
  const memoryConfig = memory.getMergedThreadConfig(state.memoryConfig);
  if (memoryConfig.readOnly) return;
  // Observational memory owns response persistence. This separate framework
  // data record contains no response text or observations to flush or embed.
  const thread = await memory.getThreadById({ threadId: state.threadId });
  if (!thread || thread.resourceId !== state.resourceId) {
    throw new Error('Cannot save the run failure without its owned thread.');
  }
  const id = createHash('sha256')
    .update(JSON.stringify(['mastra-terminal-error', agentId, runId, state.resourceId, state.threadId]))
    .digest('hex');
  const message: MastraDBMessage = {
    id,
    role: 'assistant',
    threadId: state.threadId,
    resourceId: state.resourceId,
    createdAt: new Date(),
    content: {
      format: 2,
      parts: [{ type: 'data-error', data: { message: error.message } }],
      metadata: { runId, stopReason: 'error', errorMessage: error.message },
    },
  };
  assertOwned?.();
  const saved = await memory.saveMessages({ messages: [message], memoryConfig });
  assertOwned?.();
  if (!saved.messages.some(row => row.id === id && row.content.metadata?.errorMessage === error.message)) {
    throw new Error('Memory did not retain the run failure.');
  }
}
