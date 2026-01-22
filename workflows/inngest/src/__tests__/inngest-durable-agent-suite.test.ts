/**
 * InngestDurableAgent test suite using the shared factory
 *
 * This runs the same comprehensive test suite that DurableAgent uses,
 * but configured for InngestDurableAgent with Inngest infrastructure.
 */

import { createDurableAgentTestSuite } from '@internal/durable-agent-test-utils';
import type { CreateAgentConfig, DurableAgentLike } from '@internal/durable-agent-test-utils';
import { vi } from 'vitest';

import { InngestDurableAgent } from '../durable-agent';
import { InngestPubSub } from '../pubsub';
import { DurableStepIds } from '@mastra/core/agent/durable';
import {
  getSharedInngest,
  registerTestAgent,
  setupSharedTestInfrastructure,
  teardownSharedTestInfrastructure,
  generateTestId,
} from './durable-agent.test.utils';

// Set longer timeouts for Inngest tests
vi.setConfig({ testTimeout: 120_000, hookTimeout: 60_000 });

createDurableAgentTestSuite({
  name: 'InngestDurableAgent',

  // Create InngestPubSub for streaming
  createPubSub: () => {
    const inngest = getSharedInngest();
    return new InngestPubSub(inngest, DurableStepIds.AGENTIC_LOOP);
  },

  // Create InngestDurableAgent instances
  createAgent: async (config: CreateAgentConfig): Promise<DurableAgentLike> => {
    const inngest = getSharedInngest();
    const testId = generateTestId();

    // Create the agent with unique ID to avoid conflicts
    const agent = new InngestDurableAgent({
      ...config,
      id: `${config.id}-${testId}`,
      name: config.name || config.id,
      inngest,
    });

    // Register with Mastra so workflow can look it up
    await registerTestAgent(agent);

    return agent as unknown as DurableAgentLike;
  },

  // Setup shared Inngest infrastructure
  beforeAll: async () => {
    await setupSharedTestInfrastructure();
  },

  // Teardown
  afterAll: async () => {
    await teardownSharedTestInfrastructure();
  },

  // Small delay between tests for Inngest stability
  beforeEach: async () => {
    await new Promise(resolve => setTimeout(resolve, 200));
  },

  // Longer event propagation delay for Inngest
  eventPropagationDelay: 2000,

  // Skip domains that don't apply to InngestDurableAgent
  skip: {
    // PubSub tests are implementation-specific (EventEmitterPubSub vs InngestPubSub)
    pubsub: true,
    // DurableAgent-specific tests (runRegistry, lazy init) - not available in InngestDurableAgent
    advancedDurableOnly: true,
  },
});
