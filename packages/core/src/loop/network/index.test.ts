import { it, describe, expect, vi } from 'vitest';
import { z } from 'zod';
import type { MessageListInput } from '../../agent/message-list';
import { getLastMessage, getRoutingAgent } from './index';
import { createTool } from '../../tools';
import { createWorkflow } from '../../workflows';
import { RequestContext } from '../../request-context';

describe('getLastMessage', () => {
  it('returns string directly', () => {
    expect(getLastMessage('hello')).toBe('hello');
  });

  it('returns empty string for empty input', () => {
    expect(getLastMessage('')).toBe('');
    expect(getLastMessage([] as unknown as MessageListInput)).toBe('');
  });

  it('extracts from array of strings', () => {
    expect(getLastMessage(['first', 'second', 'last'])).toBe('last');
  });

  it('extracts from message with string content', () => {
    expect(getLastMessage([{ role: 'user', content: 'hello' }] as MessageListInput)).toBe('hello');
  });

  it('extracts from message with content array', () => {
    const messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'first part' },
          { type: 'text', text: 'last part' },
        ],
      },
    ] as MessageListInput;
    expect(getLastMessage(messages)).toBe('last part');
  });

  it('extracts from message with parts array', () => {
    const messages = [
      {
        id: 'test-id',
        role: 'user',
        parts: [{ type: 'text', text: 'Tell me about Spirited Away' }],
      },
    ] as MessageListInput;
    expect(getLastMessage(messages)).toBe('Tell me about Spirited Away');
  });

  it('extracts last part from multiple parts', () => {
    const messages = [
      {
        role: 'user',
        parts: [
          { type: 'text', text: 'first' },
          { type: 'text', text: 'second' },
        ],
      },
    ] as MessageListInput;
    expect(getLastMessage(messages)).toBe('second');
  });

  it('returns last message from multiple messages', () => {
    const messages = [
      { role: 'user', content: 'first message' },
      { role: 'assistant', content: 'response' },
      { role: 'user', content: 'last message' },
    ] as MessageListInput;
    expect(getLastMessage(messages)).toBe('last message');
  });

  it('handles single message object (not array)', () => {
    expect(getLastMessage({ role: 'user', content: 'single' } as MessageListInput)).toBe('single');
  });

  it('returns empty string for non-text parts', () => {
    const messages = [
      { role: 'user', parts: [{ type: 'image', url: 'http://example.com' }] },
    ] as unknown as MessageListInput;
    expect(getLastMessage(messages)).toBe('');
  });
});

describe('getRoutingAgent', () => {
  // Helper to create a mock agent with specific workflows and tools
  function createMockAgent({
    workflows = {},
    tools = {},
    agents = {},
  }: {
    workflows?: Record<string, any>;
    tools?: Record<string, any>;
    agents?: Record<string, any>;
  }) {
    return {
      id: 'test-agent',
      getInstructions: vi.fn().mockResolvedValue('Test instructions'),
      listAgents: vi.fn().mockResolvedValue(agents),
      listWorkflows: vi.fn().mockResolvedValue(workflows),
      listTools: vi.fn().mockResolvedValue(tools),
      getModel: vi.fn().mockResolvedValue('openai/gpt-4o-mini'),
      getMemory: vi.fn().mockResolvedValue({
        listTools: vi.fn().mockResolvedValue({}),
      }),
    } as any;
  }

  it('should handle workflow with undefined inputSchema without throwing', async () => {
    // Create a workflow without inputSchema (simulating the bug scenario)
    const workflowWithoutInputSchema = createWorkflow({
      id: 'test-workflow-no-schema',
      // Intentionally NOT providing inputSchema
      outputSchema: z.object({ result: z.string() }),
    })
      .then({
        id: 'step1',
        outputSchema: z.object({ result: z.string() }),
        execute: async () => ({ result: 'done' }),
      })
      .commit();

    const mockAgent = createMockAgent({
      workflows: {
        'test-workflow': workflowWithoutInputSchema,
      },
    });

    const requestContext = new RequestContext();

    // This should NOT throw - currently it throws:
    // TypeError: Cannot read properties of undefined (reading '_def')
    await expect(
      getRoutingAgent({
        agent: mockAgent,
        requestContext,
      }),
    ).resolves.toBeDefined();
  });

  it('should handle workflow with explicit inputSchema correctly', async () => {
    const workflowWithInputSchema = createWorkflow({
      id: 'test-workflow-with-schema',
      inputSchema: z.object({ name: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    })
      .then({
        id: 'step1',
        outputSchema: z.object({ result: z.string() }),
        execute: async () => ({ result: 'done' }),
      })
      .commit();

    const mockAgent = createMockAgent({
      workflows: {
        'test-workflow': workflowWithInputSchema,
      },
    });

    const requestContext = new RequestContext();

    // This should work fine
    await expect(
      getRoutingAgent({
        agent: mockAgent,
        requestContext,
      }),
    ).resolves.toBeDefined();
  });

  it('should handle tool with undefined inputSchema without throwing', async () => {
    // Create a tool without inputSchema (like numberTool in the user's example)
    const toolWithoutInputSchema = createTool({
      id: 'number-tool',
      description: 'Generates a random number',
      // Intentionally NOT providing inputSchema
      outputSchema: z.number(),
      execute: async () => Math.floor(Math.random() * 10),
    });

    const mockAgent = createMockAgent({
      tools: {
        'number-tool': toolWithoutInputSchema,
      },
    });

    const requestContext = new RequestContext();

    // This should NOT throw - currently it throws because:
    // 'inputSchema' in tool returns true (property exists on Tool class)
    // but tool.inputSchema is undefined
    await expect(
      getRoutingAgent({
        agent: mockAgent,
        requestContext,
      }),
    ).resolves.toBeDefined();
  });

  it('should handle tool with explicit inputSchema correctly', async () => {
    const toolWithInputSchema = createTool({
      id: 'setting-tool',
      description: 'Generates settings',
      inputSchema: z.object({
        theme: z.string(),
      }),
      outputSchema: z.object({
        location: z.string(),
      }),
      execute: async () => ({ location: 'space' }),
    });

    const mockAgent = createMockAgent({
      tools: {
        'setting-tool': toolWithInputSchema,
      },
    });

    const requestContext = new RequestContext();

    // This should work fine
    await expect(
      getRoutingAgent({
        agent: mockAgent,
        requestContext,
      }),
    ).resolves.toBeDefined();
  });

  it('should handle a mix of tools and workflows with and without inputSchema', async () => {
    // This simulates the user's actual scenario with astroForge agent
    const toolWithoutInputSchema = createTool({
      id: 'number-tool',
      description: 'Generates a random number',
      outputSchema: z.number(),
      execute: async () => 2,
    });

    const toolWithInputSchema = createTool({
      id: 'setting-tool',
      description: 'Generates settings',
      inputSchema: z.object({ theme: z.string() }),
      outputSchema: z.object({ location: z.string() }),
      execute: async () => ({ location: 'space' }),
    });

    const workflowWithoutInputSchema = createWorkflow({
      id: 'workflow-no-schema',
      outputSchema: z.object({ result: z.string() }),
    })
      .then({
        id: 'step1',
        outputSchema: z.object({ result: z.string() }),
        execute: async () => ({ result: 'done' }),
      })
      .commit();

    const mockAgent = createMockAgent({
      tools: {
        'number-tool': toolWithoutInputSchema,
        'setting-tool': toolWithInputSchema,
      },
      workflows: {
        'workflow-no-schema': workflowWithoutInputSchema,
      },
    });

    const requestContext = new RequestContext();

    // This should NOT throw
    await expect(
      getRoutingAgent({
        agent: mockAgent,
        requestContext,
      }),
    ).resolves.toBeDefined();
  });
});
