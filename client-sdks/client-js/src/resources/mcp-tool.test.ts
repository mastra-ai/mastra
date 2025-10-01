import { describe, it, beforeEach, afterEach, vi, expect } from 'vitest';
import type { ClientOptions } from '../types';
import { BaseResource } from './base';
import { MCPTool } from './mcp-tool';

describe('MCPTool', () => {
  describe('execute', () => {
    let mcpTool: MCPTool;
    let requestSpy: ReturnType<typeof vi.spyOn>;
    const expectedPath = '/api/mcp/server-123/tools/tool-456/execute';

    const expectExecutePostCalledWith = (body: any) => {
      expect(requestSpy).toHaveBeenCalledTimes(1);
      expect(requestSpy).toHaveBeenCalledWith(expectedPath, {
        method: 'POST',
        body,
      });
    };

    beforeEach(() => {
      vi.clearAllMocks();
      const options: ClientOptions = {
        baseUrl: 'http://test.com',
      };
      mcpTool = new MCPTool(options, 'server-123', 'tool-456');
      requestSpy = vi.spyOn(BaseResource.prototype, 'request').mockResolvedValue({});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should make POST request with undefined body when called with an empty parameters object', async () => {
      // Act: Call execute with empty parameters object
      await mcpTool.execute({});

      // Assert: Verify request is made with POST method and undefined body
      expectExecutePostCalledWith(undefined);
    });

    it('should include data in request body when provided', async () => {
      // Arrange: Prepare test data object to be sent in request
      const testData = { key: 'value' };

      // Act: Call execute with test data in parameters
      await mcpTool.execute({ data: testData });

      // Assert: Verify request is made with POST method and body containing test data
      expectExecutePostCalledWith({ data: testData });
    });

    it('should include runtimeContext in request body when runtimeContext is provided but data is not', async () => {
      // Arrange: Create test runtime context
      const testRuntimeContext = {
        environment: 'staging',
        version: '1.2.3',
      };

      // Act: Call execute with only runtimeContext parameter
      await mcpTool.execute({ runtimeContext: testRuntimeContext });

      // Assert: Verify POST request is made with body containing only runtimeContext
      expectExecutePostCalledWith({ runtimeContext: testRuntimeContext });
    });

    it('should include both data and runtimeContext in request body when both parameters are provided', async () => {
      // Arrange: Create test data and runtime context
      const testData = { key: 'value' };
      const testRuntimeContext = {
        environment: 'production',
        version: '2.0.0',
      };

      // Act: Call execute with both data and runtimeContext parameters
      await mcpTool.execute({
        data: testData,
        runtimeContext: testRuntimeContext,
      });

      // Assert: Verify POST request is made with body containing both parameters
      expectExecutePostCalledWith({
        data: testData,
        runtimeContext: testRuntimeContext,
      });
    });
  });
});
