import { createServer } from 'http';
import type { Server } from 'http';
import { describe, it, beforeAll, beforeEach, afterAll, expect } from 'vitest';
import { MCPTool } from './mcp-tool';

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('MCPTool.execute', () => {
  let server: Server;
  let mcpTool: MCPTool;
  let baseUrl: string;
  let lastRequest: {
    method?: string;
    body?: any;
  } = {};

  beforeAll(async () => {
    server = createServer((req, res) => {
      let data = '';
      req.on('data', chunk => {
        data += chunk;
      });
      req.on('end', () => {
        lastRequest.method = req.method;
        lastRequest.body = data ? JSON.parse(data) : undefined;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'success' }));
      });
    });

    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Server address is invalid');
    }

    baseUrl = `http://127.0.0.1:${address.port}`;
    // Give a brief tick to ensure server fully ready
    await wait(10);

    mcpTool = new MCPTool({ baseUrl }, 'test-server', 'test-tool');
  });

  beforeEach(() => {
    lastRequest = {};
  });

  afterAll(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  it('should not include payload fields when params object is empty', async () => {
    // Act: Execute tool with empty params
    await mcpTool.execute({});

    // Assert: Verify no payload fields are present
    expect(lastRequest.body).toBeUndefined();
  });

  it('should use POST method when making API call', async () => {
    // Act: Execute tool with empty params
    await mcpTool.execute({});

    // Assert: Verify POST method was used
    expect(lastRequest.method).toBe('POST');
  });

  it('should include data in request body when params.data is provided', async () => {
    // Arrange: Create test data object
    const testData = {
      input: 'test input',
      options: {
        flag: true,
        count: 42,
      },
    };

    // Act: Execute tool with test data
    await mcpTool.execute({ data: testData });
    await wait(10);

    // Assert: Verify data in request body
    expect(lastRequest.body).toBeDefined();
    expect(lastRequest.body).toEqual({ data: testData });
  });

  it('should include runtimeContext in request body when params.runtimeContext is provided', async () => {
    // Arrange: Create test runtime context
    const testContext = {
      timeout: 5000,
      maxRetries: 3,
      environment: 'test',
    };

    // Act: Execute tool with runtime context
    await mcpTool.execute({ runtimeContext: testContext });
    await wait(10);

    // Assert: Verify runtime context in request body
    expect(lastRequest.body).toBeDefined();
    expect(lastRequest.body).toEqual({ runtimeContext: testContext });
  });

  it('should include both data and runtimeContext in request body when both params are provided', async () => {
    // Arrange: Create test data and runtime context with distinct values
    const testData = {
      input: 'test input value',
      parameters: {
        option1: true,
        option2: 123,
      },
    };

    const testContext = {
      timeout: 30000,
      environment: 'staging',
      configuration: {
        retries: 3,
        logLevel: 'debug',
      },
    };

    // Act: Execute tool with both data and runtime context
    await mcpTool.execute({
      data: testData,
      runtimeContext: testContext,
    });
    await wait(10);

    // Assert: Verify both fields are present with correct values and structure
    expect(lastRequest.body).toBeDefined();
    expect(Object.keys(lastRequest.body)).toHaveLength(2);
    expect(lastRequest.body).toEqual({
      data: testData,
      runtimeContext: testContext,
    });
  });
});
