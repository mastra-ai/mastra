import { MastraFGAPermissions } from '../auth/ee';
import { checkThreadFGA } from '../memory/thread-fga';
import { parseMemoryRequestContext } from '../memory/types';
import type { Agent } from './agent';
import type { AgentExecutionOptions } from './agent.types';
import { filterMessagesForPersistence } from './filter-messages-for-persistence';
import type { MessageList } from './message-list';
import { isUserAuthoredMessage } from './signals';
import type { CreatedAgentSignal } from './signals';
import type { MastraDBMessage } from './types';

type SaveRows = (messages: MastraDBMessage[]) => Promise<unknown>;

/**
 * An acceptance write the run still has to account for. Settles to a writer when
 * the run should save the message itself (the write failed, or the thread row
 * didn't exist yet), or to `undefined` when nothing is left to do.
 */
const pendingStores = new Map<string, Promise<SaveRows | undefined>>();

/** Gateway-managed memory is the gateway's to store. Same answer the observational memory processor uses. */
async function isGatewayMemoryManaged(model: unknown): Promise<boolean> {
  if (typeof model !== 'object' || model === null) return false;
  const check = (model as { isGatewayMemoryManaged?: () => Promise<boolean> }).isGatewayMemoryManaged;
  if (typeof check === 'function') return Boolean(await check.call(model));
  return (model as { gatewayId?: unknown }).gatewayId === 'mastra';
}

/**
 * Stores a user message as soon as `sendSignal`/`queueSignal` accepts it, so a reloaded
 * transcript shows it before the run reaches the model. Never awaited by the sender:
 * the run waits for it in {@link settleAcceptedSignalStores} before its next model request.
 *
 * `admitted` delays the write until the runtime knows the signal joined a run here.
 */
export function storeAcceptedSignal({
  agent,
  signal,
  resourceId,
  threadId,
  streamOptions,
  admitted,
}: {
  agent: Agent<any, any, any, any>;
  signal: CreatedAgentSignal;
  resourceId: string;
  threadId: string;
  streamOptions?: AgentExecutionOptions<any>;
  admitted?: Promise<boolean>;
}): void {
  if (signal.transient) return;
  const row = signal.toDBMessage({ resourceId, threadId });
  if (!isUserAuthoredMessage(row)) return;

  const write = async (): Promise<SaveRows | undefined> => {
    if (admitted && !(await admitted)) return undefined;
    const requestContext = streamOptions?.requestContext;
    const memory = await agent.getMemory({ requestContext });
    if (!memory) return undefined;
    const config = memory.getMergedThreadConfig(streamOptions?.memory?.options);
    if (config.readOnly || parseMemoryRequestContext(requestContext)?.memoryConfig?.readOnly) return undefined;
    await checkThreadFGA({
      mastra: agent.getMastraInstance?.(),
      user: requestContext?.get('user') as Record<string, unknown> | undefined,
      threadId,
      resourceId,
      agentId: agent.id,
      requestContext,
      permission: MastraFGAPermissions.MEMORY_WRITE,
      actor: streamOptions?.actor,
    });
    const model = await agent.getModel({ requestContext });
    if (await isGatewayMemoryManaged(model)) return undefined;

    const store = await memory.storage.getStore('memory');
    if (!store) return undefined;
    const saveRows: SaveRows = messages => store.saveMessages({ messages });
    // pg and libsql refuse rows for a thread that doesn't exist yet; the run creates it first.
    if (!(await store.getThreadById({ threadId }))) return saveRows;
    try {
      await saveRows(filterMessagesForPersistence([row]));
    } catch (error) {
      agent.getMastraInstance?.()?.getLogger?.()?.warn('Could not store a sent message when it was accepted', {
        error,
        signalId: signal.id,
      });
      return saveRows;
    }
    return undefined;
  };

  const pending = write().catch(() => undefined);
  pendingStores.set(signal.id, pending);
  void pending.then(saveRows => {
    if (!saveRows && pendingStores.get(signal.id) === pending) pendingStores.delete(signal.id);
  });
}

/**
 * Waits for the acceptance writes of messages in this request, so no later save of the
 * same row can be overtaken by them, and saves the ones whose write didn't land.
 * A failure here is logged; the turn's normal save still stores the message.
 */
export async function settleAcceptedSignalStores(
  messageList: MessageList,
  logger?: { warn: (message: string, meta?: Record<string, unknown>) => void },
): Promise<void> {
  if (pendingStores.size === 0) return;
  const messages = messageList.get.all.db().filter(message => pendingStores.has(message.id));
  for (const message of messages) {
    const pending = pendingStores.get(message.id)!;
    const saveRows = await pending;
    pendingStores.delete(message.id);
    if (!saveRows) continue;
    try {
      await saveRows(filterMessagesForPersistence(messageList.transformMessagesForTranscript([message])));
    } catch (error) {
      logger?.warn('Could not store a sent message before the model request; the turn save will store it', {
        error,
        messageId: message.id,
      });
    }
  }
}
