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

// Shared pubsub instance for all tests
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

    // Create a regular Mastra Agent
    const agent = new Agent({
      id: `${config.id}-${testId}`,
      name: config.name || config.id,
      instructions: config.instructions,
      model: config.model,
      tools: config.tools,
    });

    // Wrap with evented durable execution
    const eventedAgent = createEventedAgent({
      agent,
      pubsub: sharedPubSub,
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
