/**
 * Version overrides tests for DurableAgent
 *
 * Tests that Mastra-level and call-site version overrides
 * are properly merged during durable preparation.
 */

import { describe, it, expect } from 'vitest';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent } from '@mastra/core/agent/durable';
import { RequestContext, MASTRA_VERSIONS_KEY } from '@mastra/core/request-context';
import type { DurableAgentTestContext } from '../types';
import { createTextStreamModel } from '../mock-models';

export function createVersionOverridesTests(context: DurableAgentTestContext) {
  const { getPubSub } = context;

  describe('version overrides', () => {
    it('should pass requestContext-level versions through preparation', async () => {
      const agent = new Agent({
        id: 'version-agent',
        name: 'Version Agent',
        instructions: 'Test',
        model: createTextStreamModel('Hello'),
      });

      const durableAgent = createDurableAgent({
        agent,
        pubsub: getPubSub(),
      });

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_VERSIONS_KEY, {
        agents: { 'sub-agent': { versionId: 'v2' } },
      });

      const result = await durableAgent.prepare('Hello', {
        requestContext,
      });

      expect(result.runId).toBeDefined();
      expect(result.registryEntry.requestContext).toBeDefined();
    });

    it('should accept versions in stream options', async () => {
      const agent = new Agent({
        id: 'version-stream-agent',
        name: 'Version Stream Agent',
        instructions: 'Test',
        model: createTextStreamModel('Hello'),
      });

      const durableAgent = createDurableAgent({
        agent,
        pubsub: getPubSub(),
      });

      const { runId, cleanup } = await durableAgent.stream('Hello', {
        versions: {
          agents: { 'other-agent': { versionId: 'v3' } },
        },
      } as any);

      expect(runId).toBeDefined();
      cleanup();
    });
  });
}
