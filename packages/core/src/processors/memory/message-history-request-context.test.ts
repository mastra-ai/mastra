/**
 * A `MessageHistory({ storage })` output processor with no Memory instance, where the thread lives
 * only in the request context (`requestContext.set('MastraMemory', ...)`) — no `memory.thread` and no
 * `threadId` argument. The processor resolves that thread itself, so the run must write it to
 * storage, authorize a memory write for it, and undo the save when a later processor trips.
 */
import { describe, expect, it } from 'vitest';
import type { OutputResult } from '..';
import type { MastraDBMessage } from '../../agent';
import { MessageList } from '../../agent';
import type { MemoryRuntimeContext } from '../../memory';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import { MessageHistory } from './message-history';

const THREAD = 'thread-reqctx';
const RESOURCE = 'resource-reqctx';

/** A turn whose thread exists only in the request context. */
function requestContextWithThread() {
  const requestContext = new RequestContext();
  requestContext.set('MastraMemory', { thread: { id: THREAD }, resourceId: RESOURCE } satisfies MemoryRuntimeContext);
  return requestContext;
}

function userMessage(): MastraDBMessage {
  return {
    id: 'msg-user',
    role: 'user',
    content: { format: 2, parts: [{ type: 'text', text: 'Hello' }] },
    createdAt: new Date(),
  };
}

function assistantMessage(): MastraDBMessage {
  return {
    id: 'msg-assistant',
    role: 'assistant',
    content: { format: 2, parts: [{ type: 'text', text: 'Hi there!' }] },
    createdAt: new Date(),
  };
}

const stopResult: OutputResult = {
  text: 'Hi there!',
  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
  finishReason: 'stop',
  steps: [],
};

// processOutputResult runs the output pass the way the runner does, minus span plumbing.
function runOutputResult(
  processor: MessageHistory,
  messageList: MessageList,
  requestContext: RequestContext,
  messages: MastraDBMessage[],
) {
  return processor.processOutputResult({
    messageList,
    messages,
    result: stopResult,
    abort: ((reason?: string) => {
      throw new Error(reason);
    }) as (reason?: string) => never,
    requestContext,
  });
}

describe('MessageHistory with a request-context thread and no Memory instance', () => {
  it('stores the turn under the request-context thread', async () => {
    const memoryStore = (await new InMemoryStore().getStore('memory'))!;
    const processor = new MessageHistory({ storage: memoryStore });

    const user = userMessage();
    const assistant = assistantMessage();
    // The MessageList carries no thread: only the request context names one.
    const messageList = new MessageList().add([user], 'input').add([assistant], 'response');

    await runOutputResult(processor, messageList, requestContextWithThread(), [user, assistant]);

    const { messages } = await memoryStore.listMessages({ threadId: THREAD });
    expect(messages.map(message => [message.role, message.id])).toEqual([
      ['user', 'msg-user'],
      ['assistant', 'msg-assistant'],
    ]);
    expect(messages.map(message => message.threadId)).toEqual([THREAD, THREAD]);
    expect(messages.map(message => message.resourceId)).toEqual([RESOURCE, RESOURCE]);
  });
});
