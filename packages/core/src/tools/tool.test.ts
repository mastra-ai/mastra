import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod/v4';

import { RequestContext } from '../request-context';
import { createTool, Tool } from './tool';

const mockFindUser = vi.fn().mockImplementation(async nameS => {
  const list = [
    { name: 'Dero Israel', email: 'dero@mail.com' },
    { name: 'Ife Dayo', email: 'dayo@mail.com' },
    { name: 'Tao Feeq', email: 'feeq@mail.com' },
  ];
  const userInfo = list?.find(({ name }) => name === nameS);
  if (!userInfo) return { message: 'User not found' };
  return userInfo;
});

describe('createTool', () => {
  const testTool = createTool({
    id: 'Test tool',
    description: 'This is a test tool that returns the name and email',
    inputSchema: z.object({
      name: z.string(),
    }),
    execute: (input, _context) => {
      return mockFindUser(input.name) as Promise<Record<string, any>>;
    },
  });

  it('should call mockFindUser', async () => {
    await testTool.execute?.(
      { name: 'Dero Israel' },
      {
        requestContext: new RequestContext(),
        toolCallId: '123',
        messages: [],
        writableStream: undefined,
        suspend: async () => {},
        resumeData: {},
      },
    );

    expect(mockFindUser).toHaveBeenCalledTimes(1);
    expect(mockFindUser).toHaveBeenCalledWith('Dero Israel');
  });

  it("should return an object containing 'Dero Israel' as name and 'dero@mail.com' as email", async () => {
    const user = await testTool.execute?.(
      { name: 'Dero Israel' },
      {
        requestContext: new RequestContext(),
        toolCallId: '123',
        messages: [],
        writableStream: undefined,
        suspend: async () => {},
        resumeData: {},
      },
    );

    expect(user).toStrictEqual({ name: 'Dero Israel', email: 'dero@mail.com' });
  });

  it("should return an object containing 'User not found' message", async () => {
    const user = await testTool.execute?.(
      { name: 'Taofeeq Oluderu' },
      {
        requestContext: new RequestContext(),
        toolCallId: '123',
        messages: [],
        writableStream: undefined,
        suspend: async () => {},
        resumeData: {},
      },
    );
    expect(user).toStrictEqual({ message: 'User not found' });
  });
});

describe('createTool with providerOptions', () => {
  it('should preserve providerOptions when creating a tool', () => {
    const toolWithProviderOptions = createTool({
      id: 'cache-control-tool',
      description: 'A tool with cache control settings',
      inputSchema: z.object({
        city: z.string(),
      }),
      providerOptions: {
        anthropic: {
          cacheControl: { type: 'ephemeral' },
        },
      },
      execute: async ({ city }) => {
        return { attractions: `Attractions in ${city}` };
      },
    });

    expect(toolWithProviderOptions.providerOptions).toEqual({
      anthropic: {
        cacheControl: { type: 'ephemeral' },
      },
    });
  });

  it('should support multiple provider options', () => {
    const toolWithMultipleProviders = createTool({
      id: 'multi-provider-tool',
      description: 'A tool with multiple provider options',
      inputSchema: z.object({
        query: z.string(),
      }),
      providerOptions: {
        anthropic: {
          cacheControl: { type: 'ephemeral' },
        },
        openai: {
          someOption: 'value',
        },
      },
      execute: async ({ query }) => {
        return { result: query };
      },
    });

    expect(toolWithMultipleProviders.providerOptions).toEqual({
      anthropic: {
        cacheControl: { type: 'ephemeral' },
      },
      openai: {
        someOption: 'value',
      },
    });
  });

  it('should work without providerOptions', () => {
    const toolWithoutProviderOptions = createTool({
      id: 'no-provider-options-tool',
      description: 'A tool without provider options',
      inputSchema: z.object({
        input: z.string(),
      }),
      execute: async ({ input }) => {
        return { output: input };
      },
    });

    expect(toolWithoutProviderOptions.providerOptions).toBeUndefined();
  });

  it('should preserve providerOptions through Tool class constructor', () => {
    const tool = new Tool({
      id: 'direct-tool',
      description: 'Tool created directly with constructor',
      inputSchema: z.object({ value: z.string() }),
      providerOptions: {
        anthropic: {
          cacheControl: { type: 'ephemeral' },
        },
      },
      execute: async ({ value }) => ({ result: value }),
    });

    expect(tool.providerOptions).toEqual({
      anthropic: {
        cacheControl: { type: 'ephemeral' },
      },
    });
  });
});

describe('createTool with strict mode', () => {
  it('should preserve strict when creating a tool', () => {
    const strictTool = createTool({
      id: 'strict-tool',
      description: 'A tool with strict input generation',
      strict: true,
      inputSchema: z.object({
        city: z.string(),
      }),
      execute: async ({ city }) => ({ result: city }),
    });

    expect(strictTool.strict).toBe(true);
  });

  it('should preserve strict through Tool class constructor', () => {
    const tool = new Tool({
      id: 'strict-direct-tool',
      description: 'Tool created directly with strict mode',
      strict: true,
      inputSchema: z.object({ value: z.string() }),
      execute: async ({ value }) => ({ result: value }),
    });

    expect(tool.strict).toBe(true);
  });
});

describe('AgentToolExecutionContext', () => {
  it('should include agentId in context.agent when flat agent context is reorganized', async () => {
    let capturedContext: any;

    const tool = createTool({
      id: 'agent-id-test',
      description: 'Test tool for agentId propagation',
      inputSchema: z.object({ message: z.string() }),
      execute: async (_input, context) => {
        capturedContext = context;
        return { success: true };
      },
    });

    await tool.execute(
      { message: 'hello' },
      {
        requestContext: new RequestContext(),
        agentId: 'test-agent',
        toolCallId: 'call-123',
        messages: [],
        suspend: async () => {},
      },
    );

    expect(capturedContext.agent).toBeDefined();
    expect(capturedContext.agent.agentId).toBe('test-agent');
    expect(capturedContext.agent.toolCallId).toBe('call-123');
  });

  it('should include agentId when context.agent is already structured', async () => {
    let capturedContext: any;

    const tool = createTool({
      id: 'agent-id-structured-test',
      description: 'Test tool for pre-structured agentId',
      inputSchema: z.object({ message: z.string() }),
      execute: async (_input, context) => {
        capturedContext = context;
        return { success: true };
      },
    });

    await tool.execute(
      { message: 'hello' },
      {
        requestContext: new RequestContext(),
        agent: {
          agentId: 'structured-agent',
          toolCallId: 'call-456',
          messages: [],
          suspend: async () => {},
        },
      },
    );

    expect(capturedContext.agent).toBeDefined();
    expect(capturedContext.agent.agentId).toBe('structured-agent');
  });

  it('should default agentId to empty string when not provided in flat context', async () => {
    let capturedContext: any;

    const tool = createTool({
      id: 'agent-id-default-test',
      description: 'Test tool for agentId default',
      inputSchema: z.object({ message: z.string() }),
      execute: async (_input, context) => {
        capturedContext = context;
        return { success: true };
      },
    });

    await tool.execute(
      { message: 'hello' },
      {
        requestContext: new RequestContext(),
        toolCallId: 'call-789',
        messages: [],
        suspend: async () => {},
      },
    );

    expect(capturedContext.agent).toBeDefined();
    expect(capturedContext.agent.agentId).toBe('');
  });
});
