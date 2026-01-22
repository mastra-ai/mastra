/**
 * Factory for creating DurableAgent test suites
 */

import { describe, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import type { PubSub } from '@mastra/core/events';
import type { DurableAgentTestConfig, DurableAgentTestContext } from './types';
import {
  createConstructorTests,
  createPrepareTests,
  createRegistryTests,
  createWorkflowTests,
  createStreamTests,
  createCallbackTests,
  createToolsTests,
  createMemoryTests,
  createPubSubTests,
  // New domain test creators
  createAdvancedTests,
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

    // Create test context
    const context: DurableAgentTestContext = {
      getPubSub: () => pubsub,
      eventPropagationDelay,
    };

    // Register domain tests conditionally
    if (!skip.constructor) {
      createConstructorTests(context);
    }

    if (!skip.prepare) {
      createPrepareTests(context);
    }

    if (!skip.registry) {
      createRegistryTests(context);
    }

    if (!skip.workflow) {
      createWorkflowTests(context);
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
