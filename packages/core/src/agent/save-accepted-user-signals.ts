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

/** The turn's own save later overwrites these rows by id. */
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
      // Not memory.saveMessages (embeds ahead of the model call) or MessageHistory.persistMessages (marks the stream saved).
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
