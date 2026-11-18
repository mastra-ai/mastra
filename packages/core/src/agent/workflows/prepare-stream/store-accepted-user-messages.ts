import { MastraFGAPermissions } from '../../../auth/ee';
import type { MastraFGAPermissionInput } from '../../../auth/ee';
import type { IMastraLogger } from '../../../logger';
import type { MastraMemory, MemoryConfigInternal } from '../../../memory';
import { normalizeMessageHistoryConfig } from '../../../memory/message-history-config';
import { isObservationalMemoryEnabled, parseMemoryRequestContext } from '../../../memory/types';
import type { OutputProcessorOrWorkflow } from '../../../processors';
import { hasConfiguredProcessor } from '../../../processors/has-configured-processor';
import { MessageHistory } from '../../../processors/memory/message-history';
import type { RequestContext } from '../../../request-context';
import type { MessageList } from '../../message-list';
import { isUserAuthoredMessage } from '../../signals';

export type StoreAcceptedUserMessages = (args: { messageList: MessageList; model: unknown }) => Promise<void>;

export type AcceptedUserMessageStore = {
  store: StoreAcceptedUserMessages;
  /** Removes the rows this run stored early. Used when an output processor blocks the turn, which stores nothing. */
  undo: () => Promise<void>;
};

/** Gateway-managed memory is the gateway's to store. Same answer the observational memory processor gives. */
async function isGatewayMemoryManaged(model: unknown): Promise<boolean> {
  if (typeof model !== 'object' || model === null) return false;
  const check = (model as { isGatewayMemoryManaged?: () => Promise<boolean> }).isGatewayMemoryManaged;
  if (typeof check === 'function') return Boolean(await check.call(model));
  return (model as { gatewayId?: unknown }).gatewayId === 'mastra';
}

/**
 * Builds the run's early save for user messages. The loop calls it before each model request, once
 * every input processor has accepted the messages, so a transcript reloaded from storage shows them
 * while the model is still answering. Each row keeps its message id, so the turn save later upserts
 * the same row; each message is written once per run.
 *
 * Only built when memory's own MessageHistory is the turn save this runs ahead of — the same rule
 * memory uses to add it — so it never stores what the turn would not: message history off, replaced
 * by a configured `message-history` processor, observational memory (it saves its own steps), or
 * read-only memory. The write itself does no semantic-recall indexing; the turn save indexes once.
 * Gateway-managed memory and a denied MEMORY_WRITE skip the write. A failure is logged; the turn save
 * still stores the message.
 */
export function createStoreAcceptedUserMessages({
  memory,
  memoryConfig,
  threadId,
  resourceId,
  configuredOutputProcessors,
  requestContext,
  authorizeMemory,
  logger,
}: {
  memory?: MastraMemory;
  memoryConfig?: MemoryConfigInternal;
  threadId?: string;
  resourceId?: string;
  configuredOutputProcessors: OutputProcessorOrWorkflow[];
  requestContext?: RequestContext;
  authorizeMemory: (permission: MastraFGAPermissionInput, threadId: string) => Promise<void>;
  logger?: IMastraLogger;
}): AcceptedUserMessageStore | undefined {
  if (!memory || !threadId) return undefined;
  const runtimeConfig = parseMemoryRequestContext(requestContext)?.memoryConfig;
  const config = memory.getMergedThreadConfig(runtimeConfig ?? memoryConfig);
  if (
    config.readOnly ||
    !normalizeMessageHistoryConfig(config.lastMessages, config.messageHistory).enabled ||
    isObservationalMemoryEnabled(config.observationalMemory) ||
    hasConfiguredProcessor(
      configuredOutputProcessors,
      processor => processor.id === 'message-history' || processor.id === 'observational-memory',
    )
  ) {
    return undefined;
  }

  const stored = new Set<string>();
  const store: StoreAcceptedUserMessages = async ({ messageList, model }) => {
    const ids = new Set(
      messageList.get.input
        .db()
        .filter(message => !stored.has(message.id) && isUserAuthoredMessage(message))
        .map(message => message.id),
    );
    if (ids.size === 0) return;

    try {
      if (await isGatewayMemoryManaged(model)) return;
      await authorizeMemory(MastraFGAPermissions.MEMORY_WRITE, threadId);
      const storage = await memory.storage.getStore('memory');
      if (!storage) return;

      const persistenceList = messageList.cloneForPersistence();
      const rows = persistenceList.transformMessagesForTranscript(
        persistenceList.get.input.db().filter(message => ids.has(message.id)),
      );
      await new MessageHistory({ storage }).persistMessages({ messages: rows, threadId, resourceId });
      for (const id of ids) stored.add(id);
    } catch (error) {
      logger?.warn('Could not store a sent message before the model request; the turn save will store it', {
        error,
        threadId,
      });
    }
  };
  const undo = async () => {
    if (stored.size === 0) return;
    try {
      await memory.deleteMessages([...stored]);
      stored.clear();
    } catch (error) {
      logger?.error('Could not remove a sent message stored before a blocked turn', { error, threadId });
    }
  };
  return { store, undo };
}
