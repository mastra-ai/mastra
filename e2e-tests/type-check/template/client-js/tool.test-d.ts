/**
 * Type tests for @mastra/client-js Tool resource
 * Tests getTool, execute, and tool response types
 */
import { expectTypeOf, describe, it } from 'vitest';
import { MastraClient } from '@mastra/client-js';
import type { GetToolResponse } from '@mastra/client-js';

// Create a client instance for testing
const client = new MastraClient({ baseUrl: 'http://localhost:3000' });

describe('Tool resource', () => {
  describe('Agent tool operations', () => {
    it('should accept tool execution params', async () => {
      const agent = client.getAgent('test-agent');
      const result = agent.executeTool('my-tool', {
        data: { input: 'test' },
      });

      expectTypeOf(result).toExtend<Promise<any>>();
    });

    it('should accept requestContext in tool execution', async () => {
      const agent = client.getAgent('test-agent');
      const result = agent.executeTool('my-tool', {
        data: { input: 'test' },
        requestContext: { userId: 'user-123' },
      });

      expectTypeOf(result).toExtend<Promise<any>>();
    });
  });
});
