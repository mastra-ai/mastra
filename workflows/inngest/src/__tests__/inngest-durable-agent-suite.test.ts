/**
 * InngestAgent test suite using the shared factory
 *
 * This runs the same comprehensive test suite that DurableAgent uses,
 * but configured for InngestAgent with Inngest infrastructure.
 */

import { createDurableAgentTestSuite } from '@internal/workflow-test-utils';
import type { CreateAgentConfig, DurableAgentLike } from '@internal/workflow-test-utils';
import { Agent } from '@mastra/core/agent';
import { DurableStepIds } from '@mastra/core/agent/durable';
import { vi } from 'vitest';

import { createInngestAgent } from '../durable-agent';
import { InngestPubSub } from '../pubsub';
import {
  getSharedInngest,
  getSharedMastra,
  setupSharedTestInfrastructure,
  teardownSharedTestInfrastructure,
  generateTestId,
} from './durable-agent.test.utils';

// Set longer timeouts for Inngest tests
vi.setConfig({ testTimeout: 120_000, hookTimeout: 60_000 });

createDurableAgentTestSuite({
  name: 'InngestAgent',

  // Create InngestPubSub for streaming
  createPubSub: () => {
    const inngest = getSharedInngest();
    return new InngestPubSub(inngest, DurableStepIds.AGENTIC_LOOP);
  },

  // Create InngestAgent instances using createInngestAgent factory
  createAgent: async (config: CreateAgentConfig): Promise<DurableAgentLike> => {
    const inngest = getSharedInngest();
    const mastra = getSharedMastra();
    const testId = generateTestId();

    // Create a regular Mastra Agent
    const agent = new Agent({
      id: `${config.id}-${testId}`,
      name: config.name || config.id,
      instructions: config.instructions,
      model: config.model,
      tools: config.tools,
    });

    // Wrap with Inngest durable execution
    const inngestAgent = createInngestAgent({ agent, inngest });

    // Register with Mastra so workflow can look it up
    mastra.addAgent(inngestAgent);

    return inngestAgent as unknown as DurableAgentLike;
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
  // Inngest events go through: client -> Inngest API -> workflow execution -> realtime -> WebSocket -> subscriber
  // This round-trip typically takes ~3.5-4s, so we need a generous delay
  eventPropagationDelay: 6000,

  // Skip domains that don't apply to InngestAgent
  skip: {
    // PubSub tests are implementation-specific (EventEmitterPubSub vs InngestPubSub)
    pubsub: true,
    // DurableAgent-specific tests (runRegistry, lazy init) - not available in InngestAgent
    advancedDurableOnly: true,
    // Model fallback runtime tests require mock model instances in registry (not serializable for Inngest)
    modelFallbackRuntime: true,
    // Workspace tests use core createDurableAgent (not InngestAgent) with getPubSub().
    // The core DurableAgent runs locally and publishes to InngestPubSub which has no
    // publishFn outside Inngest context, causing `for await (textStream)` to hang.
    workspace: true,
  },
});
