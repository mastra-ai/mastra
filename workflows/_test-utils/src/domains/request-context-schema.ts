/**
 * Agent requestContextSchema validation
 *
 * Cross-engine pins modeled on
 * packages/core/src/agent/__tests__/request-context-schema.test.ts (stream
 * validation suite): an agent constructed with a requestContextSchema must
 * validate the requestContext passed to stream() *before* execution starts —
 * matching contexts pass, missing/invalid fields reject with the documented
 * error (including the agent id). Expressed through the DurableAgentLike
 * surface so every leg (DurableAgent, EventedAgent, plain Agent, Inngest)
 * exercises the same contract. The generate() suite is not portable —
 * generate is not part of the DurableAgentLike surface.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import { RequestContext } from '@mastra/core/request-context';
import type { DurableAgentTestContext } from '../types';
import { createTextStreamModel } from '../mock-models';

export function createRequestContextSchemaTests(context: DurableAgentTestContext) {
  const { createAgent } = context;

  const requestContextSchema = z.object({
    userId: z.string(),
    apiKey: z.string(),
  });

  describe('Agent requestContextSchema', () => {
    describe('stream validation', () => {
      it('should pass validation when requestContext matches schema', async () => {
        const agent = await createAgent({
          id: 'test-agent',
          name: 'Test Agent',
          instructions: 'You are a helpful assistant',
          model: createTextStreamModel('Hello! How can I help you?'),
          requestContextSchema,
        });

        const requestContext = new RequestContext<{ userId: string; apiKey: string }>();
        requestContext.set('userId', 'user-123');
        requestContext.set('apiKey', 'key-456');

        // If validation passes, stream() should not throw
        const result = await agent.stream('Hello', { requestContext });
        expect(result).toBeDefined();
        // Consume the stream
        for await (const _chunk of result.output.textStream) {
          void _chunk;
        }
        result.cleanup();
      });

      it('should throw validation error when requestContext is missing required fields', async () => {
        const agent = await createAgent({
          id: 'test-agent',
          name: 'Test Agent',
          instructions: 'You are a helpful assistant',
          model: createTextStreamModel('Hello! How can I help you?'),
          requestContextSchema,
        });

        const requestContext = new RequestContext<{ userId: string }>();
        requestContext.set('userId', 'user-123');
        // Missing apiKey

        await expect(agent.stream('Hello', { requestContext })).rejects.toThrow(
          /Request context validation failed for agent/,
        );
      });

      it('should throw validation error when requestContext has invalid field types', async () => {
        const agent = await createAgent({
          id: 'test-agent',
          name: 'Test Agent',
          instructions: 'You are a helpful assistant',
          model: createTextStreamModel('Hello! How can I help you?'),
          requestContextSchema,
        });

        const requestContext = new RequestContext();
        requestContext.set('userId', 123 as any); // Wrong type
        requestContext.set('apiKey', 'key-456');

        await expect(agent.stream('Hello', { requestContext })).rejects.toThrow(
          /Request context validation failed for agent/,
        );
      });

      it('should include agent ID in error message', async () => {
        const agent = await createAgent({
          id: 'my-special-agent',
          exactId: true,
          name: 'My Special Agent',
          instructions: 'You are a helpful assistant',
          model: createTextStreamModel('Hello! How can I help you?'),
          requestContextSchema,
        });

        const requestContext = new RequestContext();
        // Empty context

        await expect(agent.stream('Hello', { requestContext })).rejects.toThrow(/my-special-agent/);
      });
    });
  });
}
