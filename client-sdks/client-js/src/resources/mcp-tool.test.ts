import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import type { SpyInstance } from 'vitest';
import type { ClientOptions } from '../types';
import { BaseResource } from './base';
import { MCPTool } from './mcp-tool';

describe('MCPTool.execute', () => {
  let mcpTool: MCPTool;
  let requestSpy: SpyInstance;
  const endpoint = '/api/mcp/server-123/tools/tool-456/execute';

  const expectExecuteCalledWith = (body?: unknown) => {
    expect(requestSpy).toHaveBeenCalledTimes(1);
    expect(requestSpy).toHaveBeenCalledWith(endpoint, { method: 'POST', body });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    const options: ClientOptions = { baseUrl: 'http://test.com' };
    mcpTool = new MCPTool(options, 'server-123', 'tool-456');
    requestSpy = vi.spyOn(BaseResource.prototype, 'request').mockResolvedValue({} as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should make POST request with undefined body when no parameters provided', async () => {
    // Arrange: create empty params object
    const params = {};

    // Act: execute tool without data or runtimeContext
    await mcpTool.execute(params);

    // Assert: verify request parameters
    expectExecuteCalledWith(undefined);
  });

  it('should include data in request body when provided', async () => {
    // Arrange: create params with test data
    const testData = { key: 'value' };
    const params = { data: testData };

    // Act: execute tool with data
    await mcpTool.execute(params);

    // Assert: verify request parameters
    expectExecuteCalledWith({ data: testData });
  });

  it('should include runtimeContext in request body when runtimeContext is provided', async () => {
    // Arrange: create params with test runtimeContext
    const testRuntimeContext = { env: 'test', region: 'us-west' };
    const params = { runtimeContext: testRuntimeContext };

    // Act: execute tool with runtimeContext
    await mcpTool.execute(params);

    // Assert: verify request parameters
    expectExecuteCalledWith({ runtimeContext: testRuntimeContext });
  });

  it('should include both data and runtimeContext in request body when both are provided', async () => {
    // Arrange: create params with test data and runtimeContext
    const testData = { input: 'test-value', count: 42 };
    const testRuntimeContext = { env: 'staging', region: 'us-east-1' };
    const params = {
      data: testData,
      runtimeContext: testRuntimeContext,
    };

    // Act: execute tool with both data and runtimeContext
    await mcpTool.execute(params);

    // Assert: verify request was made with both properties
    expectExecuteCalledWith({
      data: testData,
      runtimeContext: testRuntimeContext,
    });
  });
});
