import { anthropic } from '@ai-sdk/anthropic-v5';
import { openai } from '@ai-sdk/openai-v6';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { noopLogger } from '../../logger';
import { SpanType } from '../../observability';
import type { AnySpan } from '../../observability';
import { RequestContext } from '../../request-context';
import { createTool } from '../../tools';
import { isProviderDefinedTool, isVercelTool } from '../toolchecks';
import { CoreToolBuilder } from './builder';

describe('CoreToolBuilder FGA', () => {
  it('executes tools without FGA when only auth/server config is present', async () => {
    const execute = vi.fn().mockResolvedValue({ result: 'ok' });
    const testTool = createTool({
      id: 'search',
      description: 'Search',
      inputSchema: z.object({ query: z.string() }),
      execute,
    });
    const requestContext = new RequestContext();
    requestContext.set('user', { id: 'user-1' });

    const builder = new CoreToolBuilder({
      originalTool: testTool,
      options: {
        name: 'search',
        logger: {
          debug: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          trackException: vi.fn(),
        } as any,
        requestContext,
        mastra: {
          getServer: () => ({ auth: {} }),
        } as any,
      },
    });

    const builtTool = builder.build();
    await expect(builtTool.execute!({ query: 'docs' }, { toolCallId: 'call-1', messages: [] })).resolves.toEqual({
      result: 'ok',
    });
    expect(execute).toHaveBeenCalledWith(
      { query: 'docs' },
      expect.objectContaining({
        mastra: expect.any(Object),
        requestContext,
      }),
    );
  });

  it('checks tool execution FGA before executing a tool', async () => {
    const execute = vi.fn().mockResolvedValue({ result: 'ok' });
    const testTool = createTool({
      id: 'search',
      description: 'Search',
      inputSchema: z.object({ query: z.string() }),
      execute,
    });
    const user = { id: 'user-1' };
    const requestContext = new RequestContext();
    requestContext.set('user', user);
    const fgaProvider = {
      require: vi.fn().mockResolvedValue(undefined),
    };

    const builder = new CoreToolBuilder({
      originalTool: testTool,
      options: {
        name: 'search',
        agentId: 'agent-1',
        agentName: 'Agent 1',
        runId: 'run-1',
        threadId: 'thread-1',
        resourceId: 'tenant-1',
        logger: {
          debug: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          trackException: vi.fn(),
        } as any,
        requestContext,
        mastra: {
          getServer: () => ({ fga: fgaProvider }),
        } as any,
      },
    });

    const builtTool = builder.build();
    await builtTool.execute!({ query: 'docs' }, { toolCallId: 'call-1', messages: [] });

    expect(fgaProvider.require).toHaveBeenCalledWith(user, {
      resource: { type: 'tool', id: 'agent-1:search' },
      permission: 'tools:execute',
      context: expect.objectContaining({
        resourceId: 'tenant-1',
        requestContext,
        metadata: expect.objectContaining({
          toolName: 'search',
          agentId: 'agent-1',
          agentName: 'Agent 1',
          runId: 'run-1',
          threadId: 'thread-1',
          executionResourceId: 'tenant-1',
        }),
      }),
    });
    expect(execute).toHaveBeenCalled();
  });

  it('fails closed when FGA is configured and a tool executes without a user', async () => {
    const execute = vi.fn().mockResolvedValue({ result: 'ok' });
    const testTool = createTool({
      id: 'search',
      description: 'Search',
      inputSchema: z.object({ query: z.string() }),
      execute,
    });
    const fgaProvider = {
      require: vi.fn().mockResolvedValue(undefined),
    };

    const builder = new CoreToolBuilder({
      originalTool: testTool,
      options: {
        name: 'search',
        logger: {
          debug: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          trackException: vi.fn(),
        } as any,
        requestContext: new RequestContext(),
        mastra: {
          getServer: () => ({ fga: fgaProvider }),
        } as any,
      },
    });

    const builtTool = builder.build();
    await expect(builtTool.execute!({ query: 'docs' }, { toolCallId: 'call-1', messages: [] })).rejects.toThrow(
      'authenticated user is required',
    );
    expect(fgaProvider.require).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it('bypasses membership resolution for a tenant-scoped trusted actor', async () => {
    const execute = vi.fn().mockResolvedValue({ result: 'ok' });
    const testTool = createTool({
      id: 'search',
      description: 'Search',
      inputSchema: z.object({ query: z.string() }),
      execute,
    });
    const requestContext = new RequestContext();
    requestContext.set('organizationId', 'org-1');
    const fgaProvider = {
      require: vi.fn().mockResolvedValue(undefined),
    };

    const builder = new CoreToolBuilder({
      originalTool: testTool,
      options: {
        name: 'search',
        logger: {
          debug: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          trackException: vi.fn(),
        } as any,
        requestContext,
        mastra: {
          getServer: () => ({ fga: fgaProvider }),
        } as any,
      },
    });

    const actor = { actorKind: 'system', sourceWorkflow: 'nightly-workflow' } as const;
    const builtTool = builder.build();
    await builtTool.execute!(
      { query: 'docs' },
      {
        toolCallId: 'call-1',
        messages: [],
        actor,
      },
    );

    expect(fgaProvider.require).not.toHaveBeenCalled();
    expect(execute).toHaveBeenCalledWith(
      { query: 'docs' },
      expect.objectContaining({
        actor,
      }),
    );
  });
});

describe('MCP Tool Tracing', () => {
  it('should use MCP_TOOL_CALL span type when tool has mcpMetadata', async () => {
    const testTool = createTool({
      id: 'mcp-server_list-files',
      description: 'List files in a directory',
      inputSchema: z.object({ path: z.string() }),
      mcpMetadata: {
        serverName: 'filesystem-server',
        serverVersion: '1.2.0',
      },
      execute: async inputData => ({ files: [inputData.path] }),
    });

    const mockToolSpan = {
      end: vi.fn(),
      error: vi.fn(),
    };

    const mockAgentSpan = {
      createChildSpan: vi.fn().mockReturnValue(mockToolSpan),
    } as unknown as AnySpan;

    const builder = new CoreToolBuilder({
      originalTool: testTool,
      options: {
        name: 'mcp-server_list-files',
        logger: {
          debug: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          trackException: vi.fn(),
        } as any,
        description: 'List files in a directory',
        requestContext: new RequestContext(),
        tracingContext: { currentSpan: mockAgentSpan },
      },
    });

    const builtTool = builder.build();
    await builtTool.execute!({ path: '/tmp' }, { toolCallId: 'test-call-id', messages: [] });

    expect(mockAgentSpan.createChildSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        type: SpanType.MCP_TOOL_CALL,
        name: "mcp_tool: 'mcp-server_list-files' on 'filesystem-server'",
        input: { path: '/tmp' },
        attributes: {
          mcpServer: 'filesystem-server',
          serverVersion: '1.2.0',
          toolDescription: 'List files in a directory',
        },
      }),
    );

    expect(mockToolSpan.end).toHaveBeenCalledWith({ attributes: { success: true }, output: { files: ['/tmp'] } });
  });

  it('should use TOOL_CALL span type for tools without mcpMetadata', async () => {
    const testTool = createTool({
      id: 'regular-tool',
      description: 'A regular tool',
      inputSchema: z.object({ value: z.string() }),
      execute: async inputData => ({ result: inputData.value }),
    });

    const mockToolSpan = {
      end: vi.fn(),
      error: vi.fn(),
    };

    const mockAgentSpan = {
      createChildSpan: vi.fn().mockReturnValue(mockToolSpan),
    } as unknown as AnySpan;

    const builder = new CoreToolBuilder({
      originalTool: testTool,
      options: {
        name: 'regular-tool',
        logger: {
          debug: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          trackException: vi.fn(),
        } as any,
        description: 'A regular tool',
        requestContext: new RequestContext(),
        tracingContext: { currentSpan: mockAgentSpan },
      },
    });

    const builtTool = builder.build();
    await builtTool.execute!({ value: 'test' }, { toolCallId: 'test-call-id', messages: [] });

    expect(mockAgentSpan.createChildSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        type: SpanType.TOOL_CALL,
        name: "tool: 'regular-tool'",
        input: { value: 'test' },
        attributes: {
          toolDescription: 'A regular tool',
          toolType: 'tool',
        },
      }),
    );
  });

  it('should handle mcpMetadata with missing serverVersion', async () => {
    const testTool = createTool({
      id: 'mcp_read-resource',
      description: 'Read a resource',
      inputSchema: z.object({ uri: z.string() }),
      mcpMetadata: {
        serverName: 'my-mcp-server',
      },
      execute: async inputData => ({ data: inputData.uri }),
    });

    const mockToolSpan = {
      end: vi.fn(),
      error: vi.fn(),
    };

    const mockAgentSpan = {
      createChildSpan: vi.fn().mockReturnValue(mockToolSpan),
    } as unknown as AnySpan;

    const builder = new CoreToolBuilder({
      originalTool: testTool,
      options: {
        name: 'mcp_read-resource',
        logger: {
          debug: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          trackException: vi.fn(),
        } as any,
        description: 'Read a resource',
        requestContext: new RequestContext(),
        tracingContext: { currentSpan: mockAgentSpan },
      },
    });

    const builtTool = builder.build();
    await builtTool.execute!({ uri: 'file:///test' }, { toolCallId: 'test-call-id', messages: [] });

    const spanArgs = (mockAgentSpan.createChildSpan as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(spanArgs.type).toBe(SpanType.MCP_TOOL_CALL);
    expect(spanArgs.attributes).toEqual({
      mcpServer: 'my-mcp-server',
      serverVersion: undefined,
      toolDescription: 'Read a resource',
    });
    expect(spanArgs.name).toBe("mcp_tool: 'mcp_read-resource' on 'my-mcp-server'");
  });

  it('should not use MCP_TOOL_CALL for Vercel tools even with mcpMetadata-like properties', async () => {
    const vercelTool = {
      description: 'A vercel tool',
      parameters: z.object({ input: z.string() }),
      mcpMetadata: { serverName: 'fake' },
      execute: async (args: any) => ({ output: args.input }),
    };

    const mockToolSpan = {
      end: vi.fn(),
      error: vi.fn(),
    };

    const mockAgentSpan = {
      createChildSpan: vi.fn().mockReturnValue(mockToolSpan),
    } as unknown as AnySpan;

    const builder = new CoreToolBuilder({
      originalTool: vercelTool as any,
      options: {
        name: 'vercel-tool',
        logger: {
          debug: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          trackException: vi.fn(),
        } as any,
        description: 'A vercel tool',
        requestContext: new RequestContext(),
        tracingContext: { currentSpan: mockAgentSpan },
      },
    });

    const builtTool = builder.build();
    await builtTool.execute!({ input: 'test' }, { toolCallId: 'test-call-id', messages: [] });

    expect(mockAgentSpan.createChildSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        type: SpanType.TOOL_CALL,
        name: "tool: 'vercel-tool'",
      }),
    );

    const spanArgs = (mockAgentSpan.createChildSpan as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(spanArgs.attributes).not.toHaveProperty('mcpServer');
    expect(spanArgs.attributes).not.toHaveProperty('serverVersion');
  });

  describe('requireApproval Handling', () => {
    it('should correctly handle function in this.options.requireApproval', () => {
      const needsApprovalFn = (input: any) => input.value === 'secret';
      const testTool = {
        id: 'test-tool',
        description: 'A test tool',
        inputSchema: z.object({ value: z.string() }),
        execute: async (input: any) => input,
      };

      const builder = new CoreToolBuilder({
        originalTool: testTool as any,
        options: {
          name: 'test-tool',
          requireApproval: needsApprovalFn,
        },
      });

      const builtTool = builder.build();

      // requireApproval should be true to trigger logic in tool-call-step
      expect(builtTool.requireApproval).toBe(true);
      // needsApprovalFn should be correctly assigned from options
      expect((builtTool as any).needsApprovalFn).toBe(needsApprovalFn);
    });

    it('should correctly handle boolean in this.options.requireApproval', () => {
      const testTool = {
        id: 'test-tool',
        description: 'A test tool',
        inputSchema: z.object({ value: z.string() }),
        execute: async (input: any) => input,
      };

      const builder = new CoreToolBuilder({
        originalTool: testTool as any,
        options: {
          name: 'test-tool',
          requireApproval: true,
        },
      });

      const builtTool = builder.build();
      expect(builtTool.requireApproval).toBe(true);
      expect((builtTool as any).needsApprovalFn).toBeUndefined();
    });

    it('should preserve a needsApprovalFn attached directly to the tool instance (MCP shape)', () => {
      // MCP tools wrap a server-level requireToolApproval function and attach it as
      // `needsApprovalFn` on the tool while keeping `requireApproval` as a boolean.
      const needsApprovalFn = (args: any) => args.value === 'secret';
      const testTool = {
        id: 'mcp-test-tool',
        description: 'An MCP-style test tool',
        inputSchema: z.object({ value: z.string() }),
        execute: async (input: any) => input,
        requireApproval: true,
        needsApprovalFn,
      };

      const builder = new CoreToolBuilder({
        originalTool: testTool as any,
        options: {
          name: 'mcp-test-tool',
          // Mirrors the agent passing the tool's boolean requireApproval into options.
          requireApproval: true,
        },
      });

      const builtTool = builder.build();

      // requireApproval stays true so tool-call-step evaluates the function.
      expect(builtTool.requireApproval).toBe(true);
      // The directly-attached function must survive conversion.
      expect((builtTool as any).needsApprovalFn).toBe(needsApprovalFn);
    });

    it('should not override an options-derived needsApprovalFn with the instance one', () => {
      const optionsFn = (input: any) => input.value === 'fromOptions';
      const instanceFn = (input: any) => input.value === 'fromInstance';
      const testTool = {
        id: 'precedence-tool',
        description: 'A tool with both function sources',
        inputSchema: z.object({ value: z.string() }),
        execute: async (input: any) => input,
        needsApprovalFn: instanceFn,
      };

      const builder = new CoreToolBuilder({
        originalTool: testTool as any,
        options: {
          name: 'precedence-tool',
          requireApproval: optionsFn,
        },
      });

      const builtTool = builder.build();

      expect(builtTool.requireApproval).toBe(true);
      // Options-derived function wins; the instance fallback only fills gaps.
      expect((builtTool as any).needsApprovalFn).toBe(optionsFn);
    });
  });
});

describe('Provider-defined Tool Handling', () => {
  it('should not crash when autoResumeSuspendedTools is enabled with openai.tools.webSearch()', () => {
    const webSearchTool = openai.tools.webSearch({});

    // Verify this is actually a provider-defined tool (v5 uses 'provider-defined', v6 uses 'provider')
    expect(['provider-defined', 'provider']).toContain(webSearchTool.type);
    expect(webSearchTool.id).toBe('openai.web_search');

    // Verify isProviderDefinedTool detects it correctly
    expect(isProviderDefinedTool(webSearchTool)).toBe(true);
    // Verify isVercelTool does NOT match (so the schema extension code path would be entered without the fix)
    expect(isVercelTool(webSearchTool as any)).toBe(false);

    // This should not throw - previously it crashed with:
    // TypeError: Cannot read properties of undefined (reading 'jsonSchema')
    // because provider-defined tools have a lazy inputSchema that doesn't conform to standard schemas
    expect(() => {
      new CoreToolBuilder({
        originalTool: webSearchTool,
        options: {
          name: 'web_search',
          logger: {
            debug: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            trackException: vi.fn(),
          } as any,
          description: 'Search the web',
          requestContext: new RequestContext(),
        },
        autoResumeSuspendedTools: true,
      });
    }).not.toThrow();
  });
});

describe('CoreToolBuilder strict', () => {
  it('should pass through strict when building a tool', () => {
    const strictTool = createTool({
      id: 'strict-tool',
      description: 'A tool with strict input generation',
      strict: true,
      inputSchema: z.object({ city: z.string() }),
      execute: async ({ city }) => ({ result: city }),
    });

    const builder = new CoreToolBuilder({
      originalTool: strictTool,
      options: {
        name: 'strict-tool',
        logger: console as any,
        description: 'A tool with strict input generation',
        requestContext: new RequestContext(),
        tracingContext: {},
      },
    });

    const builtTool = builder.build();

    expect(builtTool.strict).toBe(true);
  });

  it('should pass through strict via buildV5()', () => {
    const strictTool = createTool({
      id: 'strict-tool-v5',
      description: 'A tool with strict input generation for V5',
      strict: true,
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }) => ({ result: query }),
    });

    const builder = new CoreToolBuilder({
      originalTool: strictTool,
      options: {
        name: 'strict-tool-v5',
        logger: console as any,
        description: 'A tool with strict input generation for V5',
        requestContext: new RequestContext(),
        tracingContext: {},
      },
    });

    const builtTool = builder.buildV5();

    expect((builtTool as any).strict).toBe(true);
  });

  it('should preserve provider name in buildV5() for versioned provider-defined tools', () => {
    // Uses the real Anthropic V5 webSearch tool where the ID is versioned
    // ("anthropic.web_search_20250305") but the model-facing name is "web_search".
    // Without the fix, buildV5() would derive "web_search_20250305" from the ID,
    // which breaks V6 provider bidirectional tool name mapping.
    const providerTool = anthropic.tools.webSearch_20250305({});

    const builder = new CoreToolBuilder({
      originalTool: providerTool as any,
      options: {
        name: 'search',
        logger: console as any,
        description: providerTool.description ?? 'Search the web',
        requestContext: new RequestContext(),
        tracingContext: {},
      },
    });

    const builtTool = builder.buildV5();

    expect((builtTool as any).name).toBe('web_search');
    expect((builtTool as any).id).toBe('anthropic.web_search_20250305');
  });
});

describe('CoreToolBuilder background task schema injection', () => {
  it('does not crash re-building a tool whose inputSchema has a refinement (zod v4)', () => {
    const refinedTool = createTool({
      id: 'refined_tool',
      description: 'tool whose input schema carries a .refine()',
      inputSchema: z
        .object({ a: z.string().optional(), b: z.string().optional() })
        .refine(d => !!d.a || !!d.b, { message: 'pass a or b' }),
      execute: async () => ({ ok: true }),
    });

    const build = () =>
      new CoreToolBuilder({
        originalTool: refinedTool,
        options: { name: 'refined_tool', requestContext: new RequestContext() },
        backgroundTaskEnabled: true,
      }).build();

    // The builder mutates originalTool.inputSchema, so the second build re-injects
    // `_background` onto the already-refined schema. With `.extend()` Zod v4 threw
    // "Cannot overwrite keys on object schemas containing refinements"; safeExtend fixes it.
    expect(() => build()).not.toThrow();
    expect(() => build()).not.toThrow();
    expect((refinedTool.inputSchema as z.ZodTypeAny).safeParse({}).success).toBe(false);
  });
});

describe('CoreToolBuilder requestContext merge', () => {
  it('preserves requestContext identity when closure and exec contexts are the same instance', async () => {
    const sharedRC = new RequestContext();
    sharedRC.set('initial-key', 'initial-value');

    const receivedCtx: { requestContext?: RequestContext } = {};
    const execute = vi.fn().mockImplementation((_args: unknown, ctx: any) => {
      receivedCtx.requestContext = ctx.requestContext;
      ctx.requestContext.set('tool-write-key', 'tool-write-value');
      return { result: 'ok' };
    });

    const testTool = createTool({
      id: 'test_tool',
      description: 'Test',
      inputSchema: z.object({}),
      execute,
    });

    const builder = new CoreToolBuilder({
      originalTool: testTool,
      options: {
        name: 'test_tool',
        logger: noopLogger,
        requestContext: sharedRC,
      },
    });

    const builtTool = builder.build();
    await builtTool.execute!({}, { toolCallId: 'call-1', messages: [], requestContext: sharedRC });

    expect(receivedCtx.requestContext).toBe(sharedRC);
    expect(sharedRC.get('tool-write-key')).toBe('tool-write-value');
  });

  it('preserves non-serializable closure requestContext values when exec RC is also present', async () => {
    // Simulates what happens when the evented workflow engine deserialises requestContext:
    // the 'controller' key (containing functions) is lost because JSON.stringify drops functions
    // and may throw on objects with circular references.
    const controllerCtx = {
      controllerId: 'c-1',
      getState: () => ({ tasks: [] }),
      setState: vi.fn(),
      updateState: vi.fn(),
    };

    const closureRC = new RequestContext();
    closureRC.set('controller', controllerCtx);
    closureRC.set('serializable-key', 'from-closure');

    // The evented engine's RC — reconstructed from toJSON(), missing 'controller'
    const execRC = new RequestContext();
    execRC.set('serializable-key', 'from-exec');
    execRC.set('workflow-only-key', 42);

    const receivedCtx: { requestContext?: RequestContext } = {};
    const execute = vi.fn().mockImplementation((_args: unknown, ctx: any) => {
      receivedCtx.requestContext = ctx.requestContext;
      return { result: 'ok' };
    });

    const testTool = createTool({
      id: 'task_write',
      description: 'Write tasks',
      inputSchema: z.object({ tasks: z.array(z.string()) }),
      execute,
    });

    const builder = new CoreToolBuilder({
      originalTool: testTool,
      options: {
        name: 'task_write',
        logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), trackException: vi.fn() } as any,
        requestContext: closureRC,
      },
    });

    const builtTool = builder.build();
    await builtTool.execute!({ tasks: ['a'] }, { toolCallId: 'call-1', messages: [], requestContext: execRC });

    const merged = receivedCtx.requestContext!;
    // Non-serializable key from closure is preserved
    expect(merged.get('controller')).toBe(controllerCtx);
    expect((merged.get('controller') as any).updateState).toBe(controllerCtx.updateState);
    // Closure value wins for shared keys
    expect(merged.get('serializable-key')).toBe('from-closure');
    // Exec-only key is preserved
    expect(merged.get('workflow-only-key')).toBe(42);
  });

  it('falls back to closure RC when exec RC is empty', async () => {
    const closureRC = new RequestContext();
    closureRC.set('controller', { controllerId: 'c-1' });

    const receivedCtx: { requestContext?: RequestContext } = {};
    const execute = vi.fn().mockImplementation((_args: unknown, ctx: any) => {
      receivedCtx.requestContext = ctx.requestContext;
      return { result: 'ok' };
    });

    const testTool = createTool({
      id: 'test_tool',
      description: 'Test',
      inputSchema: z.object({}),
      execute,
    });

    const builder = new CoreToolBuilder({
      originalTool: testTool,
      options: {
        name: 'test_tool',
        logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), trackException: vi.fn() } as any,
        requestContext: closureRC,
      },
    });

    const builtTool = builder.build();
    await builtTool.execute!({}, { toolCallId: 'call-1', messages: [] });

    // With no exec RC, closure RC is used directly
    expect(receivedCtx.requestContext!.get('controller')).toEqual({ controllerId: 'c-1' });
  });

  // Same public API as RequestContext but a different prototype — simulates an
  // RC constructed by a duplicate @mastra/core copy (bundlers, monorepos),
  // where `instanceof RequestContext` is false (#19772).
  class ForeignRequestContext {
    private map = new Map<string, unknown>();
    set(key: string, value: unknown) {
      this.map.set(key, value);
    }
    get(key: string) {
      return this.map.get(key);
    }
    has(key: string) {
      return this.map.has(key);
    }
    entries() {
      return this.map.entries();
    }
    size() {
      return this.map.size;
    }
  }

  it('uses a foreign-copy exec requestContext when no closure requestContext is provided', async () => {
    const foreignRC = new ForeignRequestContext();
    foreignRC.set('exec-key', 'exec-value');
    expect(foreignRC instanceof RequestContext).toBe(false);

    const receivedCtx: { requestContext?: RequestContext } = {};
    const execute = vi.fn().mockImplementation((_args: unknown, ctx: any) => {
      receivedCtx.requestContext = ctx.requestContext;
      return { result: 'ok' };
    });

    const testTool = createTool({
      id: 'test_tool',
      description: 'Test',
      inputSchema: z.object({}),
      execute,
    });

    const builder = new CoreToolBuilder({
      originalTool: testTool,
      options: {
        name: 'test_tool',
        logger: noopLogger,
      },
    });

    const builtTool = builder.build();
    await builtTool.execute!({}, { toolCallId: 'call-1', messages: [], requestContext: foreignRC as any });

    expect(receivedCtx.requestContext!.get('exec-key')).toBe('exec-value');
  });

  it('merges a foreign-copy exec requestContext with the closure requestContext', async () => {
    const closureRC = new RequestContext();
    closureRC.set('shared-key', 'from-closure');
    closureRC.set('closure-only-key', 'closure-only');

    const foreignRC = new ForeignRequestContext();
    foreignRC.set('shared-key', 'from-exec');
    foreignRC.set('exec-only-key', 42);
    expect(foreignRC instanceof RequestContext).toBe(false);

    const receivedCtx: { requestContext?: RequestContext } = {};
    const execute = vi.fn().mockImplementation((_args: unknown, ctx: any) => {
      receivedCtx.requestContext = ctx.requestContext;
      return { result: 'ok' };
    });

    const testTool = createTool({
      id: 'test_tool',
      description: 'Test',
      inputSchema: z.object({}),
      execute,
    });

    const builder = new CoreToolBuilder({
      originalTool: testTool,
      options: {
        name: 'test_tool',
        logger: noopLogger,
        requestContext: closureRC,
      },
    });

    const builtTool = builder.build();
    await builtTool.execute!({}, { toolCallId: 'call-1', messages: [], requestContext: foreignRC as any });

    const merged = receivedCtx.requestContext!;
    // Exec-only entries from the foreign copy are preserved
    expect(merged.get('exec-only-key')).toBe(42);
    // Closure value wins for shared keys (merge semantics unchanged)
    expect(merged.get('shared-key')).toBe('from-closure');
    expect(merged.get('closure-only-key')).toBe('closure-only');
  });

  it('passes a same-copy exec requestContext through by identity when no closure RC exists', async () => {
    const execRC = new RequestContext();
    execRC.set('exec-key', 'exec-value');

    const receivedCtx: { requestContext?: RequestContext } = {};
    const execute = vi.fn().mockImplementation((_args: unknown, ctx: any) => {
      receivedCtx.requestContext = ctx.requestContext;
      return { result: 'ok' };
    });

    const testTool = createTool({
      id: 'test_tool',
      description: 'Test',
      inputSchema: z.object({}),
      execute,
    });

    const builder = new CoreToolBuilder({
      originalTool: testTool,
      options: {
        name: 'test_tool',
        logger: noopLogger,
      },
    });

    const builtTool = builder.build();
    await builtTool.execute!({}, { toolCallId: 'call-1', messages: [], requestContext: execRC });

    expect(receivedCtx.requestContext).toBe(execRC);
  });
});
