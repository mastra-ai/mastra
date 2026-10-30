import { describe, expect, it } from 'vitest';
import type { OutputResult } from '..';
import type { MastraDBMessage } from '../../agent';
import { MessageList } from '../../agent';
import { MastraTimeoutError } from '../../loop/timeout';
import type { MemoryRuntimeContext } from '../../memory';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import { MessageHistory } from './message-history';

const THREAD = 'thread-deadline';
const RESOURCE = 'resource-deadline';

async function setup() {
  const memoryStore = (await new InMemoryStore().getStore('memory'))!;
  await memoryStore.saveThread({
    thread: { id: THREAD, resourceId: RESOURCE, title: '', metadata: {}, createdAt: new Date(), updatedAt: new Date() },
  });
  const processor = new MessageHistory({ storage: memoryStore });
  const requestContext = new RequestContext();
  requestContext.set('MastraMemory', { thread: { id: THREAD }, resourceId: RESOURCE } satisfies MemoryRuntimeContext);
  return { memoryStore, processor, requestContext };
}

/** Runs the output pass for a turn whose provider never produced output, ending with `error`. */
async function saveInputOnlyFailedTurn(error: Error | undefined) {
  const { memoryStore, processor, requestContext } = await setup();
  const userMessage: MastraDBMessage = {
    id: 'msg-user',
    role: 'user',
    content: { format: 2, parts: [{ type: 'text', text: 'Look up my order.' }] },
    createdAt: new Date(),
    threadId: THREAD,
    resourceId: RESOURCE,
  };
  const messageList = new MessageList({ threadId: THREAD, resourceId: RESOURCE }).add([userMessage], 'input');
  const result: OutputResult = {
    text: '',
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    finishReason: 'error',
    steps: [],
    ...(error ? { error } : {}),
  };
  await processor.processOutputResult({
    messageList,
    messages: [userMessage],
    result,
    abort: ((reason?: string) => {
      throw new Error(reason);
    }) as (reason?: string) => never,
    requestContext,
  });
  const { messages } = await memoryStore.listMessages({ threadId: THREAD });
  return messages;
}

describe('MessageHistory input-only failed turn', () => {
  it('keeps the input when the run ended on its total deadline', async () => {
    const saved = await saveInputOnlyFailedTurn(new MastraTimeoutError({ timeoutType: 'total', timeoutMs: 800 }));
    expect(saved.map(message => [message.role, message.id])).toEqual([['user', 'msg-user']]);
  });

  it('drops the input when a single model call timed out', async () => {
    const saved = await saveInputOnlyFailedTurn(new MastraTimeoutError({ timeoutType: 'step', timeoutMs: 800 }));
    expect(saved).toEqual([]);
  });

  it('drops the input when the provider errored', async () => {
    const saved = await saveInputOnlyFailedTurn(new Error('provider exploded'));
    expect(saved).toEqual([]);
  });

  it('drops the input when the error is not known', async () => {
    const saved = await saveInputOnlyFailedTurn(undefined);
    expect(saved).toEqual([]);
  });
});
