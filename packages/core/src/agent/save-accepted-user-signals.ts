import { isMastraGatewayModel } from '../llm/model/gateways/gateway-helpers';
import type { MastraLanguageModel } from '../llm/model/shared.types';
import type { IMastraLogger } from '../logger';
import type { MastraMemory } from '../memory/memory';
import { normalizeMessageHistoryConfig } from '../memory/message-history-config';
import { isObservationalMemoryEnabled } from '../memory/types';
import type { MemoryConfigInternal } from '../memory/types';
import type { OutputProcessorOrWorkflow } from '../processors';
import { isProcessorWorkflow } from '../processors/is-processor-workflow';
import { filterMessagesForPersistence } from './filter-messages-for-persistence';
import type { MastraDBMessage, MessageList } from './message-list';
import { isUserAuthoredMessage } from './signals';

export type SaveAcceptedUserSignals = (messages: MastraDBMessage[], model: MastraLanguageModel) => Promise<void>;

/**
 * Saves messages a person sent (`user` signals) to the thread before the model request that
 * reads them, so a chat reloaded mid-run shows them; the turn's own save later overwrites the
 * rows by id. Undefined unless memory itself saves the turn to its own storage: a configured
 * MessageHistory or observational memory processor may save elsewhere. Skipped for a Mastra
 * gateway model under observational memory, which leaves the turn to the gateway.
 *
 * Best effort: a failure is logged and stops further early saves, and the turn's save still
 * writes the messages with its own checks.
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
  /** The run's configured output processors, resolved once for the run. */
  configuredOutputProcessors: OutputProcessorOrWorkflow[];
  messageList: MessageList;
  authorizeWrite: () => Promise<void>;
  logger: IMastraLogger;
  runId: string;
}): SaveAcceptedUserSignals | undefined {
  const config = memory.getMergedThreadConfig(memoryConfig);
  if (config.readOnly) return;
  const hasConfiguredSaver = configuredOutputProcessors.some(
    p => !isProcessorWorkflow(p) && (p.id === 'message-history' || p.id === 'observational-memory'),
  );
  if (hasConfiguredSaver) return;
  const observationalMemorySavesTurn = isObservationalMemoryEnabled(config.observationalMemory);
  const memorySavesTurn =
    observationalMemorySavesTurn || normalizeMessageHistoryConfig(config.lastMessages, config.messageHistory).enabled;
  if (!memorySavesTurn) return;

  const savedIds = new Set<string>();
  let failed = false;
  return async (messages, model) => {
    if (failed || (observationalMemorySavesTurn && isMastraGatewayModel(model))) return;
    const unsaved = filterMessagesForPersistence(
      messages.filter(m => m.role === 'signal' && isUserAuthoredMessage(m) && !savedIds.has(m.id)),
    );
    if (unsaved.length === 0) return;
    for (const message of unsaved) savedIds.add(message.id);
    try {
      await authorizeWrite();
      // The store directly, as MessageHistory writes: memory.saveMessages would also index the
      // message for semantic recall, which the turn's save does under the message id.
      const store = await memory.storage.getStore('memory');
      await store?.saveMessages({ messages: messageList.transformMessagesForTranscript(unsaved) });
    } catch (error) {
      failed = true;
      logger.warn('Could not save sent messages before the model request; the turn saves them', { error, runId });
    }
  };
}
