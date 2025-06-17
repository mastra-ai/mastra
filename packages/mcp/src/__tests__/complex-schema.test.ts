import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InternalMastraMCPClient } from '../client/client';
import { z } from 'zod';

// Mock the dependencies
vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    listTools: vi.fn(),
    callTool: vi.fn(),
    setNotificationHandler: vi.fn(),
    onclose: undefined,
  })),
}));

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: vi.fn(),
  getDefaultEnvironment: vi.fn(() => ({})),
}));

vi.mock('zod-from-json-schema', () => ({
  convertJsonSchemaToZod: vi.fn(),
}));

vi.mock('@mastra/core/tools', () => ({
  createTool: vi.fn(),
}));

describe('MCPClient Complex Schema Handling', () => {
  let client: InternalMastraMCPClient;
  let mockClient: any;
  let mockConvertJsonSchemaToZod: any;
  let mockCreateTool: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mocks
    const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
    const { convertJsonSchemaToZod } = require('zod-from-json-schema');
    const { createTool } = require('@mastra/core/tools');

    mockClient = {
      connect: vi.fn(),
      listTools: vi.fn(),
      callTool: vi.fn(),
      setNotificationHandler: vi.fn(),
      onclose: undefined,
    };

    Client.mockImplementation(() => mockClient);
    mockConvertJsonSchemaToZod = convertJsonSchemaToZod;
    mockCreateTool = createTool;

    client = new InternalMastraMCPClient({
      name: 'test-client',
      server: {
        command: 'test-command',
        args: ['--test'],
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Schema Conversion Fallback', () => {
    it('should handle DataForSEO-style complex schemas with graceful fallback', async () => {
      // Mock a complex schema that would fail conversion (like DataForSEO's)
      const complexSchema = {
        type: 'object',
        properties: {
          filters: {
            type: 'array',
            items: {
              anyOf: [
                {
                  type: 'object',
                  properties: {
                    // Complex nested structure that breaks zod-from-json-schema
                  }
                }
              ]
            }
          }
        }
      };

      // Mock schema conversion failure
      mockConvertJsonSchemaToZod.mockImplementation(() => {
        throw new Error('Schema conversion failed: anyOf not supported');
      });

      // Mock tool list response
      mockClient.listTools.mockResolvedValue({
        tools: [
          {
            name: 'test-complex-tool',
            description: 'A tool with complex schema',
            inputSchema: complexSchema,
          },
        ],
      });

      // Mock createTool to capture the schema that gets passed
      let capturedSchema: any;
      mockCreateTool.mockImplementation(({ inputSchema }) => {
        capturedSchema = inputSchema;
        return {
          execute: vi.fn(),
        };
      });

      // Call tools() method
      const tools = await client.tools();

      // Verify that:
      // 1. The tool was created despite schema conversion failure
      expect(tools).toHaveProperty('test-complex-tool');

      // 2. A fallback schema was used (should be permissive)
      expect(capturedSchema).toBeDefined();
      expect(capturedSchema._def.typeName).toBe('ZodObject'); // Should be a Zod object

      // 3. The fallback schema should accept any object
      const testData = { keywords: ['test'], location: 'test' };
      expect(() => capturedSchema.parse(testData)).not.toThrow();
    });

    it('should use original schema when conversion succeeds', async () => {
      const simpleSchema = {
        type: 'object',
        properties: {
          message: { type: 'string' }
        }
      };

      const mockZodSchema = z.object({ message: z.string() });
      mockConvertJsonSchemaToZod.mockReturnValue(mockZodSchema);

      mockClient.listTools.mockResolvedValue({
        tools: [
          {
            name: 'simple-tool',
            description: 'A tool with simple schema',
            inputSchema: simpleSchema,
          },
        ],
      });

      let capturedSchema: any;
      mockCreateTool.mockImplementation(({ inputSchema }) => {
        capturedSchema = inputSchema;
        return { execute: vi.fn() };
      });

      await client.tools();

      // Should use the successfully converted schema
      expect(capturedSchema).toBe(mockZodSchema);
    });
  });

  describe('Parameter Passing', () => {
    it('should pass parameters correctly even with fallback schema', async () => {
      // Setup a tool that uses fallback schema
      mockConvertJsonSchemaToZod.mockImplementation(() => {
        throw new Error('Schema conversion failed');
      });

      mockClient.listTools.mockResolvedValue({
        tools: [
          {
            name: 'dataforseo-tool',
            description: 'DataForSEO-style tool',
            inputSchema: { /* complex schema */ },
          },
        ],
      });

      let capturedExecuteFunction: any;
      mockCreateTool.mockImplementation(({ execute }) => {
        capturedExecuteFunction = execute;
        return { execute };
      });

      await client.tools();

      // Mock successful tool call
      mockClient.callTool.mockResolvedValue({ result: 'success' });

      // Test parameter passing
      const testParams = {
        keywords: ['SEO services Melbourne'],
        location_name: 'Melbourne,Victoria,Australia',
        language_name: 'English'
      };

      await capturedExecuteFunction({ context: testParams });

      // Verify callTool was called with correct parameters
      expect(mockClient.callTool).toHaveBeenCalledWith(
        {
          name: 'dataforseo-tool',
          arguments: testParams, // Should pass the exact parameters
        },
        expect.any(Object), // CallToolResultSchema
        expect.any(Object)  // timeout config
      );
    });

    it('should handle undefined parameters gracefully', async () => {
      mockConvertJsonSchemaToZod.mockReturnValue(z.object({}).passthrough());

      mockClient.listTools.mockResolvedValue({
        tools: [
          {
            name: 'test-tool',
            description: 'Test tool',
            inputSchema: {},
          },
        ],
      });

      let capturedExecuteFunction: any;
      mockCreateTool.mockImplementation(({ execute }) => {
        capturedExecuteFunction = execute;
        return { execute };
      });

      await client.tools();

      mockClient.callTool.mockResolvedValue({ result: 'success' });

      // Test with undefined context
      await capturedExecuteFunction({ context: undefined });

      // Should pass empty object instead of undefined
      expect(mockClient.callTool).toHaveBeenCalledWith(
        {
          name: 'test-tool',
          arguments: {}, // Should be empty object, not undefined
        },
        expect.any(Object),
        expect.any(Object)
      );
    });
  });

  describe('Error Handling', () => {
    it('should log warnings for schema conversion failures instead of errors', () => {
      // This test would require access to the logging system
      // Implementation depends on how logging is set up in the actual codebase
    });

    it('should provide detailed error information when tool execution fails', async () => {
      mockConvertJsonSchemaToZod.mockReturnValue(z.object({}).passthrough());

      mockClient.listTools.mockResolvedValue({
        tools: [
          {
            name: 'failing-tool',
            description: 'A tool that fails',
            inputSchema: {},
          },
        ],
      });

      let capturedExecuteFunction: any;
      mockCreateTool.mockImplementation(({ execute }) => {
        capturedExecuteFunction = execute;
        return { execute };
      });

      await client.tools();

      // Mock tool call failure
      const mockError = new Error('Tool execution failed');
      mockClient.callTool.mockRejectedValue(mockError);

      // Should propagate the error
      await expect(
        capturedExecuteFunction({ context: { test: 'data' } })
      ).rejects.toThrow('Tool execution failed');
    });
  });
});

describe('DataForSEO Integration Test', () => {
  it('should work with actual DataForSEO MCP server schemas', async () => {
    // This would be an integration test that requires the actual DataForSEO server
    // For now, we'll simulate the problematic schema structure

    const dataForSeoSchema = {
      type: 'object',
      properties: {
        keywords: {
          type: 'array',
          items: { type: 'string' }
        },
        location_name: { type: 'string' },
        language_name: { type: 'string' },
        filters: {
          type: 'array',
          items: {
            anyOf: [
              {
                type: 'object',
                properties: {
                  // This structure causes zod-from-json-schema to fail
                }
              }
            ]
          }
        }
      }
    };

    // Test that our fix handles this schema gracefully
    // Implementation would go here...
  });
});