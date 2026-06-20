/**
 * AIMock Scenario: Provider Options Passthrough
 *
 * Tests that providerOptions can be passed through the agent stream without errors.
 * This verifies the passthrough mechanism works, though actual provider SDK behavior
 * with these options is outside the scope of core loop tests.
 *
 * Note: Whether provider-specific options (like OpenAI's prediction or store) actually
 * affect the request depends on the provider SDK implementation. This test verifies
 * that the options flow through the Mastra agent.stream() call without errors.
 */

import { stepCountIs } from '@internal/ai-sdk-v5';
import { describe, it, expect } from 'vitest';
import { runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

describe('AIMock loop scenario: provider options passthrough', () => {
  const getMock = useLoopScenarioAimock();

  it('accepts providerOptions without errors', async () => {
    const { output, requests } = await runLoopScenario({
      llm: getMock(),
      prompt: 'Hello with metadata.',
      stopWhen: stepCountIs(1),
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat' },
          { content: 'Response received.' },
        );
      },
      // Pass provider-specific options that should flow through without errors
      providerOptions: {
        openai: {
          prediction: { type: 'content', content: 'Hello with metadata.' },
          store: true,
        },
      },
    });

    // Verify the request was made successfully
    expect(requests).toHaveLength(1);
    
    // Verify the output was received
    expect(output).toBeDefined();
  });

  it('accepts multiple provider options without errors', async () => {
    const { output, requests } = await runLoopScenario({
      llm: getMock(),
      prompt: 'Request with multiple provider options.',
      stopWhen: stepCountIs(1),
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat' },
          { content: 'Response with metadata.' },
        );
      },
      providerOptions: {
        openai: {
          parallel_tool_calls: false,
          user: 'test-user-123',
        },
        anthropic: {
          cache_control: { type: 'ephemeral' },
        },
      },
    });

    // Verify the request was made successfully
    expect(requests).toHaveLength(1);
    
    // Verify the output was received
    expect(output).toBeDefined();
  });
});
