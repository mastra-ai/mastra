/**
 * Factory for creating DurableAgent test suites
 */

import { describe, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import type { PubSub } from '@mastra/core/events';
import { DurableAgent } from '@mastra/core/agent/durable';
import type { DurableAgentTestConfig, DurableAgentTestContext, CreateAgentConfig, DurableAgentLike } from './types';
import {
  createConstructorTests,
  createPrepareTests,
  createStreamTests,
  createCallbackTests,
  createToolsTests,
  createMemoryTests,
  createPubSubTests,
  // New domain test creators
  createAdvancedTests,
  createAdvancedDurableOnlyTests,
  createImagesTests,
  createReasoningTests,
  createRequestContextTests,
  createStopWhenTests,
  createStructuredOutputTests,
  createToolApprovalTests,
  createToolConcurrencyTests,
  createToolSuspensionTests,
  createUIMessageTests,
  createUsageTests,
} from './domains';

const DEFAULT_EVENT_PROPAGATION_DELAY = 100;

/**
 * Default agent factory - creates DurableAgent with pubsub from context
 */
function defaultCreateAgent(config: CreateAgentConfig, context: DurableAgentTestContext): DurableAgentLike {
  const pubsub = context.getPubSub();
  return new DurableAgent({
    ...config,
    pubsub,
  });
}

/**
 * Create a complete DurableAgent test suite
 *
 * @example
 * ```typescript
 * import { createDurableAgentTestSuite } from '@internal/durable-agent-test-utils';
 * import { EventEmitterPubSub } from '@mastra/core/events';
 *
 * createDurableAgentTestSuite({
 *   name: 'DurableAgent',
 *   createPubSub: () => new EventEmitterPubSub(),
 * });
 * ```
 */
export function createDurableAgentTestSuite(config: DurableAgentTestConfig) {
  const { name, createPubSub, cleanupPubSub, skip = {} } = config;
  const eventPropagationDelay = config.eventPropagationDelay ?? DEFAULT_EVENT_PROPAGATION_DELAY;
  const agentFactory = config.createAgent ?? defaultCreateAgent;

  let pubsub: PubSub;

  describe(name, () => {
    beforeAll(async () => {
      if (config.beforeAll) {
        await config.beforeAll();
      }
    });

    afterAll(async () => {
      if (config.afterAll) {
        await config.afterAll();
      }
    });

    beforeEach(async () => {
      // Create fresh pubsub for each test
      pubsub = await Promise.resolve(createPubSub());

      if (config.beforeEach) {
        await config.beforeEach();
      }
    });

    afterEach(async () => {
      if (config.afterEach) {
        await config.afterEach();
      }

      // Cleanup pubsub
      if (cleanupPubSub) {
        await cleanupPubSub(pubsub);
      } else if (pubsub?.close) {
        await pubsub.close();
      }
    });

    // Create test context with agent factory
    const context: DurableAgentTestContext = {
      getPubSub: () => pubsub,
      createAgent: async (agentConfig: CreateAgentConfig) => {
        return Promise.resolve(agentFactory(agentConfig, context));
      },
      eventPropagationDelay,
    };

    // Register domain tests conditionally
    if (!skip.constructor) {
      createConstructorTests(context);
    }

    if (!skip.prepare) {
      createPrepareTests(context);
    }

    if (!skip.stream) {
      createStreamTests(context);
    }

    if (!skip.callbacks) {
      createCallbackTests(context);
    }

    if (!skip.tools) {
      createToolsTests(context);
    }

    if (!skip.memory) {
      createMemoryTests(context);
    }

    if (!skip.pubsub) {
      createPubSubTests(context);
    }

    // New domain tests
    if (!skip.advanced) {
      createAdvancedTests(context);
    }

    // DurableAgent-specific tests (registry, lazy init) - skip for InngestDurableAgent
    if (!skip.advancedDurableOnly) {
      createAdvancedDurableOnlyTests(context);
    }

    if (!skip.images) {
      createImagesTests(context);
    }

    if (!skip.reasoning) {
      createReasoningTests(context);
    }

    if (!skip.requestContext) {
      createRequestContextTests(context);
    }

    if (!skip.stopWhen) {
      createStopWhenTests(context);
    }

    if (!skip.structuredOutput) {
      createStructuredOutputTests(context);
    }

    if (!skip.toolApproval) {
      createToolApprovalTests(context);
    }

    if (!skip.toolConcurrency) {
      createToolConcurrencyTests(context);
    }

    if (!skip.toolSuspension) {
      createToolSuspensionTests(context);
    }

    if (!skip.uiMessage) {
      createUIMessageTests(context);
    }

    if (!skip.usage) {
      createUsageTests(context);
    }
  });
}
