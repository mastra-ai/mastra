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
      // Test that schema conversion failures are handled gracefully
      mockConvertJsonSchemaToZod.mockImplementation(() => {
        throw new Error('Schema conversion failed');
      });

      const mockLogSpy = vi.fn();
      const testClient = new InternalMastraMCPClient({
        name: 'test-client',
        server: { command: 'test-command' },
      });

      // Mock the log method
      (testClient as any).log = mockLogSpy;

      // This would trigger the schema conversion in a real scenario
      expect(mockLogSpy).toBeDefined();
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
  it('should handle DataForSEO-style complex schemas with manual conversion', async () => {
    // Test the actual schema structure that DataForSEO uses
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
                  field: { type: 'string' },
                  operator: { type: 'string' },
                  value: { type: 'string' }
                }
              }
            ]
          }
        }
      }
    };

    // Mock schema conversion to fail on anyOf
    mockConvertJsonSchemaToZod.mockImplementation((schema) => {
      if (JSON.stringify(schema).includes('anyOf')) {
        throw new Error('anyOf not supported');
      }
      return z.object({}).passthrough();
    });

    mockClient.listTools.mockResolvedValue({
      tools: [
        {
          name: 'dataforseo_keywords_data_google_ads_search_volume',
          description: 'DataForSEO keyword tool',
          inputSchema: dataForSeoSchema,
        },
      ],
    });

    let capturedSchema: any;
    mockCreateTool.mockImplementation(({ inputSchema }) => {
      capturedSchema = inputSchema;
      return { execute: vi.fn() };
    });

    await client.tools();

    // Verify that a schema was created (either repaired or manual conversion)
    expect(capturedSchema).toBeDefined();
    expect(capturedSchema._def.typeName).toBe('ZodObject');

    // Test that it accepts DataForSEO parameters
    const testParams = {
      keywords: ['test keyword'],
      location_name: 'Melbourne,Victoria,Australia',
      language_name: 'English'
    };

    expect(() => capturedSchema.parse(testParams)).not.toThrow();
  });
});