import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { SpanType } from '../../observability';
import type { AnySpan } from '../../observability';
import { RequestContext } from '../../request-context';
import { createTool } from '../../tools';
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

    expect(mockAgentSpan.createChildSpan).toHaveBeenCalledWith({
      type: SpanType.MCP_TOOL_CALL,
      name: "mcp_tool: 'mcp-server_list-files' on 'filesystem-server'",
      input: { path: '/tmp' },
      entityType: 'tool',
      entityId: 'mcp-server_list-files',
      entityName: 'mcp-server_list-files',
      attributes: {
        mcpServer: 'filesystem-server',
        serverVersion: '1.2.0',
      },
      tracingPolicy: undefined,
    });

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

    expect(mockAgentSpan.createChildSpan).toHaveBeenCalledWith({
      type: SpanType.TOOL_CALL,
      name: "tool: 'regular-tool'",
      input: { value: 'test' },
      entityType: 'tool',
      entityId: 'regular-tool',
      entityName: 'regular-tool',
      attributes: {
        toolDescription: 'A regular tool',
        toolType: 'tool',
      },
      tracingPolicy: undefined,
    });
  });

  it('should include MCP attributes in span for MCP tools', async () => {
    const testTool = createTool({
      id: 'mcp_read-resource',
      description: 'Read a resource',
      inputSchema: z.object({ uri: z.string() }),
      mcpMetadata: {
        serverName: 'my-mcp-server',
        // serverVersion intentionally omitted
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

    const spanArgs = mockAgentSpan.createChildSpan.mock.calls[0][0];
    expect(spanArgs.attributes).toEqual({
      mcpServer: 'my-mcp-server',
      serverVersion: undefined,
    });
    expect(spanArgs.name).toBe("mcp_tool: 'mcp_read-resource' on 'my-mcp-server'");
  });

  it('should not use MCP_TOOL_CALL for Vercel tools even if they have mcpMetadata-like properties', async () => {
    // Vercel tools are detected by having 'parameters' instead of 'inputSchema'
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

    // Should use TOOL_CALL, not MCP_TOOL_CALL
    expect(mockAgentSpan.createChildSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        type: SpanType.TOOL_CALL,
        name: "tool: 'vercel-tool'",
      }),
    );
  });
});
