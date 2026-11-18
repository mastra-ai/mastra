import type { MastraLanguageModel } from '../llm/model/shared.types';
import type { IMastraLogger } from '../logger';
import type { MastraMemory } from '../memory/memory';
import { memoryTurnSaver } from '../memory/turn-saver';
import type { MemoryConfigInternal } from '../memory/types';
import type { OutputProcessorOrWorkflow } from '../processors';
import { filterMessagesForPersistence } from './filter-messages-for-persistence';
import type { MastraDBMessage, MessageList } from './message-list';
import { isUserAuthoredMessage } from './signals';

export type SaveAcceptedUserSignals = (messages: MastraDBMessage[], model: MastraLanguageModel) => Promise<void>;

/** Same rule as the observational memory processor, which leaves the turn to the gateway when true. */
async function gatewayManagesMemory(model: MastraLanguageModel): Promise<boolean> {
  if ('isGatewayMemoryManaged' in model && typeof model.isGatewayMemoryManaged === 'function') {
    return Boolean(await model.isGatewayMemoryManaged());
  }
  return 'gatewayId' in model && model.gatewayId === 'mastra';
}

/**
 * Saves messages a person sent (`user` signals) to the thread before the model request that reads
 * them, so a chat reloaded mid-run shows them; the turn's own save later overwrites the rows by id.
 * Undefined unless memory adds the processor that saves the turn to its own store.
 *
 * Best effort: a failed save is logged and retried before the next model request.
 */
export function createAcceptedUserSignalSaver({
  memory,
  memoryConfig,
  configuredOutputProcessors,
  messageList,
  authorizeWrite,
  logger,
  runId,
}: {
  memory: MastraMemory;
  memoryConfig?: MemoryConfigInternal;
  configuredOutputProcessors: OutputProcessorOrWorkflow[];
  messageList: MessageList;
  authorizeWrite: () => Promise<void>;
  logger: IMastraLogger;
  runId: string;
}): SaveAcceptedUserSignals | undefined {
  const config = memory.getMergedThreadConfig(memoryConfig);
  if (config.readOnly) return;
  const saver = memoryTurnSaver(config, configuredOutputProcessors);
  if (!saver) return;

  const savedIds = new Set<string>();
  return async (messages, model) => {
    try {
      const unsaved = filterMessagesForPersistence(
        messages.filter(m => m.role === 'signal' && isUserAuthoredMessage(m) && !savedIds.has(m.id)),
      );
      if (unsaved.length === 0) return;
      if (saver === 'observational-memory' && (await gatewayManagesMemory(model))) return;
      await authorizeWrite();
      // Not memory.saveMessages, which embeds the message the turn's save embeds again, nor
      // MessageHistory.persistMessages, which marks the live thread stream as saved up to now.
      const store = await memory.storage.getStore('memory');
      await store?.saveMessages({ messages: messageList.transformMessagesForTranscript(unsaved) });
      for (const message of unsaved) savedIds.add(message.id);
    } catch (error) {
      logger.warn('Could not save sent messages before the model request; retried at the next request', {
        error,
        runId,
      });
    }
  };
}
