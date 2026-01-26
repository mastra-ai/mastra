/**
 * Test the DurableAgent test suite with EventEmitterPubSub
 *
 * This serves as both:
 * 1. A verification that the test suite works correctly
 * 2. An example of how to use the factory
 */

import { EventEmitterPubSub } from '@mastra/core/events';
import { createDurableAgentTestSuite } from './factory';

// Run the full test suite with EventEmitterPubSub
createDurableAgentTestSuite({
  name: 'DurableAgent (EventEmitter)',
  createPubSub: () => new EventEmitterPubSub(),
});
