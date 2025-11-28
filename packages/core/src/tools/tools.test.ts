import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';

import { RequestContext } from '../request-context';
import { createTool } from './tool';

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

describe('dynamic tool description', () => {
  it('should support static description (backward compatibility)', async () => {
    const tool = createTool({
      id: 'test',
      description: 'Static description',
      execute: async () => ({}),
    });

    const desc = await tool.getDescription();
    expect(desc).toBe('Static description');
  });

  it('should support dynamic description with requestContext', async () => {
    const tool = createTool({
      id: 'test',
      description: ({ requestContext }) => {
        return `Tool for ${requestContext.get('tenant')}`;
      },
      execute: async () => ({}),
    });

    const requestContext = new RequestContext();
    requestContext.set('tenant', 'acme');

    const desc = await tool.getDescription({ requestContext });
    expect(desc).toBe('Tool for acme');
  });

  it('should support async dynamic description', async () => {
    const tool = createTool({
      id: 'test',
      description: async ({ requestContext }) => {
        // Simulate async lookup
        await new Promise(r => setTimeout(r, 10));
        return `Async: ${requestContext.get('value')}`;
      },
      execute: async () => ({}),
    });

    const requestContext = new RequestContext();
    requestContext.set('value', 'test');

    const desc = await tool.getDescription({ requestContext });
    expect(desc).toBe('Async: test');
  });

  it('should have access to mastra instance', async () => {
    const tool = createTool({
      id: 'test',
      description: ({ mastra }) => {
        return mastra ? 'Has mastra' : 'No mastra';
      },
      execute: async () => ({}),
    });

    const mockMastra = {} as any;
    const desc = await tool.getDescription({ mastra: mockMastra });
    expect(desc).toBe('Has mastra');
  });

  it('should throw error when accessing description getter on dynamic tool', () => {
    const tool = createTool({
      id: 'test',
      description: () => 'Dynamic',
      execute: async () => ({}),
    });

    expect(() => tool.description).toThrow('Dynamic description requires requestContext. Use getDescription()');
  });

  it('should allow accessing description getter on static tool', () => {
    const tool = createTool({
      id: 'test',
      description: 'Static description',
      execute: async () => ({}),
    });

    expect(tool.description).toBe('Static description');
  });

  it('should handle requestContext values correctly', async () => {
    const tool = createTool({
      id: 'test',
      description: ({ requestContext }) => {
        const org = requestContext.get('org');
        const user = requestContext.get('user');
        return `${org}/${user} tool`;
      },
      execute: async () => ({}),
    });

    const requestContext = new RequestContext();
    requestContext.set('org', 'mastra');
    requestContext.set('user', 'ash');

    const desc = await tool.getDescription({ requestContext });
    expect(desc).toBe('mastra/ash tool');
  });

  it('should handle dynamic description in CoreToolBuilder without throwing', async () => {
    // Regression test for issue where CoreToolBuilder.getResolvedDescription()
    // would throw when accessing .description getter on a Tool with dynamic description
    const tool = createTool({
      id: 'test',
      description: ({ requestContext }) => `Dynamic: ${requestContext.get('value')}`,
      execute: async () => ({}),
    });

    const requestContext = new RequestContext();
    requestContext.set('value', 'test123');

    // Resolve the description first (as Agent does)
    const resolvedDescription = await tool.getDescription({ requestContext });

    // Now pass it to makeCoreTool with resolved description in options
    const { makeCoreTool } = await import('../utils');
    const coreTool = makeCoreTool(tool, {
      name: 'test-tool',
      requestContext,
      tracingContext: {},
      description: resolvedDescription,
    });

    expect(coreTool.description).toBe('Dynamic: test123');
  });

  it('should handle dynamic description in CoreToolBuilder with missing options.description gracefully', async () => {
    // Test the fallback path in CoreToolBuilder.getResolvedDescription()
    // where options.description is undefined and it needs to safely access originalTool.description
    const tool = createTool({
      id: 'test',
      description: ({ requestContext }) => `Dynamic: ${requestContext.get('value')}`,
      execute: async () => ({}),
    });

    const requestContext = new RequestContext();
    requestContext.set('value', 'test123');

    // Call makeCoreTool WITHOUT providing description in options
    // This tests the fallback behavior - should return undefined gracefully
    const { makeCoreTool } = await import('../utils');
    const coreTool = makeCoreTool(tool, {
      name: 'test-tool',
      requestContext,
      tracingContext: {},
      // description is NOT provided - triggers fallback path
    });

    // When description is not resolved, it should be undefined (not throw)
    expect(coreTool.description).toBeUndefined();
  });

  it('should handle dynamic description on raw ToolAction object (not Tool class)', async () => {
    // Regression test: raw ToolAction objects (not wrapped in Tool class) can have dynamic descriptions
    // These should be resolved by resolveToolDescription in Agent
    const rawToolAction = {
      id: 'raw-tool',
      description: ({ requestContext }: { requestContext: any; mastra?: any }) =>
        `Raw ToolAction: ${requestContext.get('tenant')}`,
      execute: async () => ({ success: true }),
    };

    const requestContext = new RequestContext();
    requestContext.set('tenant', 'acme-corp');

    // Simulate what Agent.resolveToolDescription does with raw ToolAction objects
    let resolvedDescription: string | undefined;
    if (typeof rawToolAction.description === 'function') {
      resolvedDescription = await rawToolAction.description({ requestContext });
    }

    expect(resolvedDescription).toBe('Raw ToolAction: acme-corp');
  });

  it('should handle empty string descriptions correctly', async () => {
    // Regression test: empty strings are valid descriptions (meaning "no description")
    // and should not be treated as falsy, falling through to originalTool.description
    const tool = createTool({
      id: 'test',
      description: 'Original description',
      execute: async () => ({}),
    });

    const requestContext = new RequestContext();

    // Pass empty string explicitly via options
    const { makeCoreTool } = await import('../utils');
    const coreTool = makeCoreTool(tool, {
      name: 'test-tool',
      requestContext,
      tracingContext: {},
      description: '', // Intentional empty string
    });

    // Should use the empty string from options, not fall back to "Original description"
    expect(coreTool.description).toBe('');
  });
});
