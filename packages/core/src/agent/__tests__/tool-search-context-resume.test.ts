import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MockMemory } from '../../memory/mock';
import { ToolSearchProcessor } from '../../processors/processors/tool-search';
import { RequestContext } from '../../request-context';
import { createTool } from '../../tools';
import { Agent } from '../agent';

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
});
