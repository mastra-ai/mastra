/**
 * EventedAgent test suite using the shared factory
 *
 * This runs the same comprehensive test suite that DurableAgent uses,
 * but configured for EventedAgent with the built-in evented workflow engine.
 *
 * This mirrors the Inngest test suite pattern exactly.
 */

import { createDurableAgentTestSuite } from './factory';
import type { CreateAgentConfig, DurableAgentLike } from './types';
import { Agent } from '@mastra/core/agent';
import { createEventedAgent } from '@mastra/core/agent/durable';
import { EventEmitterPubSub } from '@mastra/core/events';
import { Mastra } from '@mastra/core/mastra';
import { MockStore } from '@mastra/core/storage';

// Shared pubsub instance for all tests.
let sharedPubSub: EventEmitterPubSub;

// Test ID counter for unique agent IDs
let testIdCounter = 0;
function generateTestId(): string {
  return `test-${Date.now()}-${++testIdCounter}`;
}

createDurableAgentTestSuite({
  name: 'EventedAgent',

  // Create EventEmitterPubSub for streaming
  createPubSub: () => {
    sharedPubSub = new EventEmitterPubSub();
    return sharedPubSub;
  },

  // Create EventedAgent instances using createEventedAgent factory
  createAgent: async (config: CreateAgentConfig): Promise<DurableAgentLike> => {
    const testId = generateTestId();

    // Recovery tests re-create the "same" agent on a fresh host, so the id
    // must survive verbatim for run discovery to match the persisted
    // snapshot; other tests get a unique suffix for isolation.
    const agentId = config.exactId ? config.id : `${config.id}-${testId}`;

    // A recovered host gets its own bus (agent + Mastra host), mirroring a
    // real process restart where the crashed host's bus is gone.
    const pubsub = config.isolatedPubsub ? new EventEmitterPubSub() : sharedPubSub;

    // Create a regular Mastra Agent
    const agent = new Agent({
      id: agentId,
      name: config.name || config.id,
      instructions: config.instructions,
      model: config.model,
      tools: config.tools,
      ...(config.memory ? { memory: config.memory } : {}),
      ...(config.outputProcessors ? { outputProcessors: config.outputProcessors } : {}),
    });

    // Wrap with evented durable execution
    const eventedAgent = createEventedAgent({
      agent,
      pubsub,
    });

    // Always wire up Mastra so the evented engine has a host instance, and
    // share the suite's pubsub so engine-published events reach the agent's
    // stream listeners (the engine publishes on mastra.pubsub, not the
    // pubsub passed to the agent). A caller-supplied store is shared across
    // hosts (crash-recovery tests build a second host over the crashed
    // host's storage).
    new Mastra({
      logger: false,
      storage: config.storage ?? new MockStore(),
      pubsub,
      agents: { [agentId]: eventedAgent as any },
    });

    return eventedAgent as unknown as DurableAgentLike;
  },

  // Slightly longer event propagation delay for async execution
  eventPropagationDelay: 200,

  // Skip domains that don't apply to EventedAgent
  skip: {
    // DurableAgent-specific tests (runRegistry, lazy init) - not available in EventedAgent
    advancedDurableOnly: true,
    // Model fallback runtime tests have timing issues in shared suite (pass in core)
    modelFallbackRuntime: true,
  },
});
