import { Agent } from '@mastra/core/agent';
import { ToolSearchProcessor } from '@mastra/core/processors';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Memory } from './index';

// Issue #26851: tool preparation runs in parallel with prepare-memory-step, which
// creates the thread. Restoring context-stored loaded tools must not fail with
// "No thread found" on a new thread's first message.
describe('input processor loaded tools on a new thread', () => {
  const weather = createTool({
    id: 'weather',
    description: 'Get weather',
    inputSchema: z.object({ city: z.string() }),
    execute: async () => ({ temp: 20 }),
  });

  function createAgent(memory: Memory) {
    return new Agent({
      id: 'tool-search-agent',
      name: 'tool-search-agent',
      instructions: 'test',
      model: 'openai/gpt-4o-mini',
      memory,
      inputProcessors: [new ToolSearchProcessor({ tools: { weather }, storage: 'context' })],
    });
  }

  it('resolves tools for a thread that does not exist yet', async () => {
    const agent = createAgent(new Memory({ storage: new InMemoryStore() }));

    const tools = await agent.getToolsForExecution({
      threadId: 'new-thread',
      resourceId: 'user-1',
      requestContext: new RequestContext(),
    });

    expect(tools.weather).toBeUndefined();
  });

  it('still rejects a thread owned by another resource', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    await memory.saveThread({
      thread: { id: 'owned-thread', resourceId: 'user-2', title: 't', createdAt: new Date(), updatedAt: new Date() },
    });
    const agent = createAgent(memory);

    await expect(
      agent.getToolsForExecution({
        threadId: 'owned-thread',
        resourceId: 'user-1',
        requestContext: new RequestContext(),
      }),
    ).rejects.toThrow('is for resource with id user-2');
  });
});
