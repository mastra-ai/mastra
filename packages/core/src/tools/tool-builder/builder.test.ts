import { anthropic } from '@ai-sdk/anthropic-v5';
import { openai } from '@ai-sdk/openai-v6';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { SpanType } from '../../observability';
import type { AnySpan } from '../../observability';
import { RequestContext } from '../../request-context';
import { createTool } from '../../tools';
import { isProviderDefinedTool, isVercelTool } from '../toolchecks';
import { CoreToolBuilder } from './builder';

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
