import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MockMemory } from '../../memory/mock';
import { ToolSearchProcessor } from '../../processors/processors/tool-search';
import { RequestContext } from '../../request-context';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { getSingleDummyResponseModel } from './mock-model';

class StrictMemory extends MockMemory {
  override async recall(...args: Parameters<MockMemory['recall']>) {
    const [{ threadId }] = args;
    const thread = await this.getThreadById({ threadId });
    if (!thread) {
      throw new Error(`Thread ${threadId} not found`);
    }
    return super.recall(...args);
  }
}

class DelayedThreadCreationMemory extends StrictMemory {
  private missingThreadReads = 0;
  private allMissingThreadReadsFinished!: () => void;
  private readonly allMissingThreadReadsFinishedPromise = new Promise<void>(resolve => {
    this.allMissingThreadReadsFinished = resolve;
  });

  override async getThreadById(...args: Parameters<MockMemory['getThreadById']>) {
    const thread = await super.getThreadById(...args);
    if (!thread && ++this.missingThreadReads === 2) {
      this.allMissingThreadReadsFinished();
    }
    return thread;
  }

  override async createThread(...args: Parameters<MockMemory['createThread']>) {
    await this.allMissingThreadReadsFinishedPromise;
    return super.createThread(...args);
  }
}

class FailingRecallMemory extends MockMemory {
  override async recall(..._args: Parameters<MockMemory['recall']>): Promise<never> {
    throw new Error('storage unavailable');
  }
}

// Issue #24787: a resumed run (after a restart, run-registry expiry, or on another
// instance) rebuilds tools without a live processInputStep. With storage: 'context'
// the loaded set must come from the persisted thread messages.
describe('ToolSearchProcessor storage: context — resume tool rebuild', () => {
  const weather = createTool({
    id: 'weather',
    description: 'Get weather',
    inputSchema: z.object({ city: z.string() }),
    execute: async () => ({ temp: 20 }),
  });

  function createAgent(memory: MockMemory) {
    return new Agent({
      id: 'tool-search-agent',
      name: 'tool-search-agent',
      instructions: 'test',
      model: 'openai/gpt-4o-mini',
      memory,
      // A fresh processor instance models a new process: no same-process state.
      inputProcessors: [new ToolSearchProcessor({ tools: { weather }, storage: 'context' })],
    });
  }

  async function seedThread(memory: MockMemory, threadId: string, resourceId: string, withLoadResult: boolean) {
    await memory.saveThread({
      thread: { id: threadId, resourceId, title: 't', createdAt: new Date(), updatedAt: new Date() },
    });
    await memory.saveMessages({
      messages: [
        {
          id: 'u1',
          threadId,
          resourceId,
          role: 'user',
          createdAt: new Date(Date.now() - 1000),
          content: { format: 2, parts: [{ type: 'text', text: 'weather?' }] },
        },
        {
          id: 'a1',
          threadId,
          resourceId,
          role: 'assistant',
          createdAt: new Date(),
          content: {
            format: 2,
            parts: withLoadResult
              ? [
                  {
                    type: 'tool-invocation',
                    toolInvocation: {
                      state: 'result',
                      toolCallId: 'call-1',
                      toolName: 'load_tool',
                      args: { toolName: 'weather' },
                      result: { success: true, toolName: 'weather' },
                    },
                  },
                ]
              : [{ type: 'text', text: 'hi' }],
          },
        },
      ],
    });
  }

  it('restores search-loaded tools from persisted thread messages', async () => {
    const memory = new MockMemory();
    await seedThread(memory, 'thread-1', 'user-1', true);
    const agent = createAgent(memory);

    const tools = await agent.getToolsForExecution({
      threadId: 'thread-1',
      resourceId: 'user-1',
      requestContext: new RequestContext(),
    });

    expect(tools.weather).toBeDefined();
  });

  it('does not restore tools the thread never loaded', async () => {
    const memory = new MockMemory();
    await seedThread(memory, 'thread-2', 'user-1', false);
    const agent = createAgent(memory);

    const tools = await agent.getToolsForExecution({
      threadId: 'thread-2',
      resourceId: 'user-1',
      requestContext: new RequestContext(),
    });

    expect(tools.weather).toBeUndefined();
  });

  it('treats a nonexistent thread as an empty transcript during tool reconstruction', async () => {
    const memory = new StrictMemory();
    const agent = createAgent(memory);

    const tools = await agent.getToolsForExecution({
      threadId: 'new-thread',
      resourceId: 'user-1',
      requestContext: new RequestContext(),
    });

    expect(tools.weather).toBeUndefined();
  });

  it('completes the first turn when tool reconstruction reaches memory before thread creation', async () => {
    const memory = new DelayedThreadCreationMemory();
    const agent = new Agent({
      id: 'tool-search-agent',
      name: 'tool-search-agent',
      instructions: 'test',
      model: getSingleDummyResponseModel('v2'),
      memory,
      inputProcessors: [new ToolSearchProcessor({ tools: { weather }, storage: 'context' })],
    });

    const response = await agent.stream('hello', {
      memory: { thread: 'new-thread', resource: 'user-1' },
    });

    await expect(response.text).resolves.toBe('Dummy response');
    await expect(memory.getThreadById({ threadId: 'new-thread' })).resolves.toMatchObject({ id: 'new-thread' });
  });

  it('preserves tools loaded in runMessages when the thread does not exist', async () => {
    const memory = new StrictMemory();
    const agent = createAgent(memory);

    const tools = await agent.getToolsForExecution({
      threadId: 'new-thread',
      resourceId: 'user-1',
      requestContext: new RequestContext(),
      runMessages: [
        {
          id: 'a1',
          threadId: 'new-thread',
          resourceId: 'user-1',
          role: 'assistant',
          createdAt: new Date(),
          content: {
            format: 2,
            parts: [
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'result',
                  toolCallId: 'call-1',
                  toolName: 'load_tool',
                  args: { toolName: 'weather' },
                  result: { success: true, toolName: 'weather' },
                },
              },
            ],
          },
        },
      ],
    });

    expect(tools.weather).toBeDefined();
  });

  it('propagates recall failures unrelated to a missing thread', async () => {
    const memory = new FailingRecallMemory();
    const agent = createAgent(memory);
    await seedThread(memory, 'thread-3', 'user-1', false);

    await expect(
      agent.getToolsForExecution({
        threadId: 'thread-3',
        resourceId: 'user-1',
        requestContext: new RequestContext(),
      }),
    ).rejects.toThrow('storage unavailable');
  });
});
