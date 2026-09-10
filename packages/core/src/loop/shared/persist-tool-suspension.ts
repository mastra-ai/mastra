import type { MessageList } from '../../agent/message-list';

export class ToolSuspensionCancelledError extends Error {
  constructor() {
    super('Tool suspension cancelled');
    this.name = 'AbortError';
  }
}

export class ToolSuspensionPersistenceError extends Error {
  constructor(cause: unknown) {
    super('Could not persist tool suspension', { cause });
  }
}

/** Tool builders wrap errors; retain native suspension control through that wrapper. */
export function findToolSuspensionError(
  error: unknown,
): ToolSuspensionCancelledError | ToolSuspensionPersistenceError | undefined {
  const seen = new Set<Error>();
  while (error instanceof Error && !seen.has(error)) {
    if (error instanceof ToolSuspensionCancelledError || error instanceof ToolSuspensionPersistenceError) return error;
    seen.add(error);
    error = error.cause;
  }
  return undefined;
}

/** Persist a pending request before exposing it to a client. */
export async function persistToolSuspension({
  messageList,
  toolCallId,
  type,
  addMetadata,
  flush,
  isAborted,
  publish,
}: {
  messageList?: MessageList;
  toolCallId: string;
  type: 'approval' | 'suspension';
  addMetadata: () => void;
  flush: (onError: () => void) => Promise<void>;
  isAborted?: () => boolean;
  publish: () => void | Promise<void>;
}) {
  const key = type === 'approval' ? 'pendingToolApprovals' : 'suspendedTools';
  const previous = new Map(
    messageList?.get.all.db().map(message => [message.id, (message.content.metadata as any)?.[key]?.[toolCallId]]),
  );
  addMetadata();
  const inserted = new Map(
    messageList?.get.all.db().map(message => [message.id, (message.content.metadata as any)?.[key]?.[toolCallId]]),
  );
  const undoMetadata = () => {
    // Undo this attempt only. Parallel calls can share an assistant message;
    // never restore an old message or remove another call by tool name.
    for (const message of messageList?.get.all.db() ?? []) {
      const entries = (message.content.metadata as any)?.[key];
      const added = inserted.get(message.id);
      if (!added || added === previous.get(message.id) || entries?.[toolCallId] !== added) continue;
      const current = { ...entries };
      const prior = previous.get(message.id);
      if (prior === undefined) delete current[toolCallId];
      else current[toolCallId] = prior;
      messageList?.updateMessageMetadataByToolCallId(toolCallId, { [key]: current });
    }
  };
  try {
    await flush(undoMetadata);
    if (isAborted?.()) {
      undoMetadata();
      // The first save succeeded; persist removal before finishing cancellation.
      await flush(undoMetadata);
      throw new ToolSuspensionCancelledError();
    }
  } catch (error) {
    // Also handles failures before entering the queue, such as thread creation.
    undoMetadata();
    if (error instanceof ToolSuspensionCancelledError) throw error;
    throw new ToolSuspensionPersistenceError(error);
  }
  // Invoke publication in this continuation: returning to the caller first
  // would allow cancellation between the last signal check and the event.
  await publish();
}
