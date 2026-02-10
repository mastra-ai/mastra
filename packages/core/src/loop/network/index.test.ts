import { it, describe, expect, vi } from 'vitest';
import { z } from 'zod';
import type { MessageListInput, MastraDBMessage } from '../../agent/message-list';
import type { Processor } from '../../processors';
import { RequestContext } from '../../request-context';
import { createTool } from '../../tools';
import { createWorkflow } from '../../workflows';
import { getLastMessage, getRoutingAgent, filterMessagesForSubAgent } from './index';

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
    configuredInputProcessors = [],
    configuredOutputProcessors = [],
  }: {
    workflows?: Record<string, any>;
    tools?: Record<string, any>;
    agents?: Record<string, any>;
    configuredInputProcessors?: any[];
    configuredOutputProcessors?: any[];
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
        getInputProcessors: vi.fn().mockResolvedValue([]),
        getOutputProcessors: vi.fn().mockResolvedValue([]),
      }),
      // New methods for configured-only processors
      listConfiguredInputProcessors: vi.fn().mockResolvedValue(configuredInputProcessors),
      listConfiguredOutputProcessors: vi.fn().mockResolvedValue(configuredOutputProcessors),
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

  it('should pass through configured input processors from the parent agent', async () => {
    // Create a mock input processor (e.g., token limiter)
    const mockInputProcessor: Processor = {
      id: 'test-token-limiter',
      name: 'Test Token Limiter',
      processInput: vi.fn().mockImplementation(({ messages }) => messages),
    };

    const mockAgent = createMockAgent({
      configuredInputProcessors: [mockInputProcessor],
    });

    const requestContext = new RequestContext();

    const routingAgent = await getRoutingAgent({
      agent: mockAgent,
      requestContext,
    });

    // Verify that listConfiguredInputProcessors was called (not listInputProcessors)
    expect(mockAgent.listConfiguredInputProcessors).toHaveBeenCalledWith(requestContext);

    // The routing agent should have input processors configured
    const routingAgentInputProcessors = await routingAgent.listInputProcessors(requestContext);
    expect(routingAgentInputProcessors.length).toBeGreaterThan(0);
  });

  it('should pass through configured output processors from the parent agent', async () => {
    // Create a mock output processor
    const mockOutputProcessor: Processor = {
      id: 'test-output-processor',
      name: 'Test Output Processor',
      processOutputResult: vi.fn().mockImplementation(({ messages }) => messages),
    };

    const mockAgent = createMockAgent({
      configuredOutputProcessors: [mockOutputProcessor],
    });

    const requestContext = new RequestContext();

    const routingAgent = await getRoutingAgent({
      agent: mockAgent,
      requestContext,
    });

    // Verify that listConfiguredOutputProcessors was called (not listOutputProcessors)
    expect(mockAgent.listConfiguredOutputProcessors).toHaveBeenCalledWith(requestContext);

    // The routing agent should have output processors configured
    const routingAgentOutputProcessors = await routingAgent.listOutputProcessors(requestContext);
    expect(routingAgentOutputProcessors.length).toBeGreaterThan(0);
  });

  it('should not call listInputProcessors (which includes memory processors)', async () => {
    const mockAgent = createMockAgent({});
    // Add a spy for listInputProcessors to ensure it's NOT called
    mockAgent.listInputProcessors = vi.fn().mockResolvedValue([]);

    const requestContext = new RequestContext();

    await getRoutingAgent({
      agent: mockAgent,
      requestContext,
    });

    // listInputProcessors should NOT be called - only listConfiguredInputProcessors
    expect(mockAgent.listInputProcessors).not.toHaveBeenCalled();
    expect(mockAgent.listConfiguredInputProcessors).toHaveBeenCalled();
  });
});

describe('filterMessagesForSubAgent', () => {
  function makeDbMessage(overrides: Partial<MastraDBMessage> & { role: MastraDBMessage['role'] }): MastraDBMessage {
    return {
      id: 'msg-' + Math.random().toString(36).slice(2, 8),
      role: overrides.role,
      createdAt: new Date(),
      content: overrides.content ?? {
        format: 2,
        parts: [{ type: 'text', text: 'test message' }],
      },
      ...(overrides.threadId ? { threadId: overrides.threadId } : {}),
      ...(overrides.resourceId ? { resourceId: overrides.resourceId } : {}),
    } as MastraDBMessage;
  }

  it('includes regular user messages', () => {
    const userMsg = makeDbMessage({ role: 'user' });
    const result = filterMessagesForSubAgent([userMsg]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(userMsg);
  });

  it('includes regular assistant messages', () => {
    const assistantMsg = makeDbMessage({
      role: 'assistant',
      content: {
        format: 2,
        parts: [{ type: 'text', text: 'Hello, I can help with that.' }],
      },
    });
    const result = filterMessagesForSubAgent([assistantMsg]);
    expect(result).toHaveLength(1);
  });

  it('excludes assistant messages with isNetwork JSON', () => {
    const networkMsg = makeDbMessage({
      role: 'assistant',
      content: {
        format: 2,
        parts: [
          {
            type: 'text',
            text: JSON.stringify({
              isNetwork: true,
              primitiveId: 'agent-1',
              primitiveType: 'agent',
              input: 'do something',
              finalResult: { text: 'done', messages: [] },
            }),
          },
        ],
      },
    });
    const result = filterMessagesForSubAgent([networkMsg]);
    expect(result).toHaveLength(0);
  });

  it('excludes assistant messages with routing decision JSON', () => {
    const routingMsg = makeDbMessage({
      role: 'assistant',
      content: {
        format: 2,
        parts: [
          {
            type: 'text',
            text: JSON.stringify({
              primitiveId: 'agent-1',
              selectionReason: 'best fit for the task',
            }),
          },
        ],
      },
    });
    const result = filterMessagesForSubAgent([routingMsg]);
    expect(result).toHaveLength(0);
  });

  it('excludes assistant messages with mode=network metadata', () => {
    const networkMetaMsg = makeDbMessage({
      role: 'assistant',
      content: {
        format: 2,
        parts: [{ type: 'text', text: 'network feedback' }],
        metadata: { mode: 'network' },
      },
    });
    const result = filterMessagesForSubAgent([networkMetaMsg]);
    expect(result).toHaveLength(0);
  });

  it('excludes assistant messages with completionResult metadata', () => {
    const completionMsg = makeDbMessage({
      role: 'assistant',
      content: {
        format: 2,
        parts: [{ type: 'text', text: 'completion result' }],
        metadata: { completionResult: true },
      },
    });
    const result = filterMessagesForSubAgent([completionMsg]);
    expect(result).toHaveLength(0);
  });

  // --- Tests verifying source metadata on network messages ---

  it('routing-agent prompt message should include source metadata', () => {
    // The routing agent now creates MastraDBMessage format with metadata
    // identifying the message as coming from the routing agent
    const routingAgentPromptMsg: MastraDBMessage = {
      id: 'msg-routing-123',
      role: 'user',
      type: 'text',
      content: {
        parts: [{ type: 'text', text: 'Analyze the data using statistical methods' }],
        format: 2,
        metadata: {
          source: 'routing-agent',
          primitiveId: 'data-analyst',
          primitiveType: 'agent',
          selectionReason: 'best fit for data analysis',
        },
      },
      createdAt: new Date(),
      threadId: 'thread-1',
      resourceId: 'network-1',
    } as MastraDBMessage;

    expect(routingAgentPromptMsg.content.metadata).toBeDefined();
    expect(routingAgentPromptMsg.content.metadata!.source).toBe('routing-agent');
    expect(routingAgentPromptMsg.content.metadata!.primitiveId).toBe('data-analyst');
    expect(routingAgentPromptMsg.content.metadata!.primitiveType).toBe('agent');
    expect(routingAgentPromptMsg.content.metadata!.selectionReason).toBe('best fit for data analysis');

    // Should still pass through filterMessagesForSubAgent as a user message
    const result = filterMessagesForSubAgent([routingAgentPromptMsg]);
    expect(result).toHaveLength(1);
    expect(result[0]!.content.metadata!.source).toBe('routing-agent');
  });

  it('initial user message should include source=user metadata', () => {
    // User input messages now include source metadata
    const initialUserMsg: MastraDBMessage = {
      id: 'msg-test-123',
      type: 'text',
      role: 'user',
      content: {
        parts: [{ type: 'text', text: 'Hello, what can you do?' }],
        format: 2,
        metadata: { source: 'user' },
      },
      createdAt: new Date(),
      threadId: 'thread-1',
      resourceId: 'user-1',
    } as MastraDBMessage;

    expect(initialUserMsg.content.metadata).toBeDefined();
    expect(initialUserMsg.content.metadata!.source).toBe('user');
  });

  it('agent result message should always include primitiveId in metadata', () => {
    // Agent result messages now always include primitiveId/primitiveType metadata
    const agentResultMsg: MastraDBMessage = {
      id: 'msg-result-456',
      type: 'text',
      role: 'assistant',
      content: {
        parts: [
          {
            type: 'text',
            text: JSON.stringify({
              isNetwork: true,
              selectionReason: 'best fit for data analysis',
              primitiveType: 'agent',
              primitiveId: 'data-analyst',
              input: 'Analyze the data',
              finalResult: { text: 'Analysis complete', messages: [] },
            }),
          },
        ],
        format: 2,
        metadata: {
          mode: 'network',
          source: 'agent-network',
          primitiveId: 'data-analyst',
          primitiveType: 'agent',
        },
      },
      createdAt: new Date(),
      threadId: 'thread-1',
      resourceId: 'network-1',
    } as MastraDBMessage;

    expect(agentResultMsg.content.metadata).toBeDefined();
    expect(agentResultMsg.content.metadata!.source).toBe('agent-network');
    expect(agentResultMsg.content.metadata!.primitiveId).toBe('data-analyst');
    expect(agentResultMsg.content.metadata!.primitiveType).toBe('agent');
    expect(agentResultMsg.content.metadata!.mode).toBe('network');
  });

  it('can distinguish routing-agent messages from real user messages via metadata', () => {
    const realUserMsg = makeDbMessage({
      role: 'user',
      content: {
        format: 2,
        parts: [{ type: 'text', text: 'Tell me about the weather' }],
        metadata: { source: 'user' },
      },
    });

    const routingAgentMsg = makeDbMessage({
      role: 'user',
      content: {
        format: 2,
        parts: [{ type: 'text', text: 'Analyze weather patterns for the user' }],
        metadata: {
          source: 'routing-agent',
          primitiveId: 'weather-agent',
          primitiveType: 'agent',
        },
      },
    });

    const result = filterMessagesForSubAgent([realUserMsg, routingAgentMsg]);
    expect(result).toHaveLength(2);

    const fromUser = result.filter(m => m.content.metadata?.source === 'user');
    const fromRouting = result.filter(m => m.content.metadata?.source === 'routing-agent');

    expect(fromUser).toHaveLength(1);
    expect(fromRouting).toHaveLength(1);
    expect(fromRouting[0]!.content.metadata!.primitiveId).toBe('weather-agent');
  });

  it('workflow result message should include primitiveId metadata', () => {
    const workflowResultMsg: MastraDBMessage = {
      id: 'msg-wf-789',
      type: 'text',
      role: 'assistant',
      content: {
        parts: [{ type: 'text', text: 'workflow completed' }],
        format: 2,
        metadata: {
          mode: 'network',
          source: 'agent-network',
          primitiveId: 'data-pipeline',
          primitiveType: 'workflow',
        },
      },
      createdAt: new Date(),
      threadId: 'thread-1',
      resourceId: 'network-1',
    } as MastraDBMessage;

    expect(workflowResultMsg.content.metadata!.source).toBe('agent-network');
    expect(workflowResultMsg.content.metadata!.primitiveId).toBe('data-pipeline');
    expect(workflowResultMsg.content.metadata!.primitiveType).toBe('workflow');
  });

  it('tool result message should include primitiveId metadata', () => {
    const toolResultMsg: MastraDBMessage = {
      id: 'msg-tool-101',
      type: 'text',
      role: 'assistant',
      content: {
        parts: [
          {
            type: 'text',
            text: JSON.stringify({
              isNetwork: true,
              primitiveType: 'tool',
              primitiveId: 'search-tool',
              finalResult: { result: 'search results', toolCallId: 'tc-1' },
            }),
          },
        ],
        format: 2,
        metadata: {
          mode: 'network',
          source: 'agent-network',
          primitiveId: 'search-tool',
          primitiveType: 'tool',
        },
      },
      createdAt: new Date(),
      threadId: 'thread-1',
      resourceId: 'network-1',
    } as MastraDBMessage;

    expect(toolResultMsg.content.metadata!.source).toBe('agent-network');
    expect(toolResultMsg.content.metadata!.primitiveId).toBe('search-tool');
    expect(toolResultMsg.content.metadata!.primitiveType).toBe('tool');
  });
});
