/**
 * Simple agent for service-mastra
 *
 * Demonstrates Mastra integration with distributed tracing.
 */

import { Agent } from '@mastra/core/agent';

export const greetingAgent = new Agent({
  name: 'Greeting Agent',
  instructions: 'You are a friendly greeting agent. Respond with a short, cheerful greeting.',
  model: 'openai/gpt-4o-mini',
});
