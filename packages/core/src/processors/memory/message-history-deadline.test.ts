import { describe, expect, it } from 'vitest';
import { isProcessorWorkflow } from '..';
import type { OutputResult } from '..';
import type { MastraDBMessage } from '../../agent';
import { Agent, MessageList } from '../../agent';
import { noopLogger } from '../../logger';
import type { MemoryRuntimeContext } from '../../memory';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import { ProcessorRunner } from '../runner';
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

/**
 * Runs the output pass for a turn whose provider never produced output and that ended with an error.
 * `viaAgentWorkflow` runs it the way an agent does: chained with another processor inside the
 * generated processor workflow.
 */
async function saveInputOnlyFailedTurn({ viaAgentWorkflow = false } = {}) {
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
  };
  if (viaAgentWorkflow) {
    const agent = new Agent({
      id: 'deadline-agent',
      name: 'deadline-agent',
      instructions: 'test',
      model: 'openai/gpt-4o-mini',
      outputProcessors: [{ id: 'passthrough', processOutputResult: ({ messages }) => messages }, processor],
    });
    const outputProcessors = await (
      agent as unknown as { listResolvedOutputProcessors: () => Promise<unknown[]> }
    ).listResolvedOutputProcessors();
    expect(outputProcessors).toHaveLength(1);
    expect(isProcessorWorkflow(outputProcessors[0] as never)).toBe(true);
    const runner = new ProcessorRunner({
      outputProcessors: outputProcessors as never,
      logger: noopLogger,
      agentName: 'deadline-agent',
    });
    await runner.runOutputProcessors(messageList, undefined, requestContext, 0, undefined, result);
    const { messages } = await memoryStore.listMessages({ threadId: THREAD });
    return messages;
  }
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
  it('keeps the input when the provider errored before any output', async () => {
    const saved = await saveInputOnlyFailedTurn();
    expect(saved.map(message => [message.role, message.id])).toEqual([['user', 'msg-user']]);
  });

  it('keeps the input when run inside the agent processor workflow', async () => {
    const saved = await saveInputOnlyFailedTurn({ viaAgentWorkflow: true });
    expect(saved.map(message => [message.role, message.id])).toEqual([['user', 'msg-user']]);
  });
});
