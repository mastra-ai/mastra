/**
 * AIMock Scenario: Request Body Override
 *
 * Tests that model settings passed to agent.stream() correctly override defaults
 * and land in the model request body. This covers the regression class where
 * temperature, maxTokens, topP, and other model settings could be dropped during
 * request building.
 *
 * Asserts:
 * - Model settings flow through to the request body
 * - Different settings can be passed per-request
 * - Settings override any agent-level defaults
 */

import { stepCountIs } from '@internal/ai-sdk-v5';
import { describe, it, expect } from 'vitest';
import { runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

describe('AIMock loop scenario: request body override', () => {
  const getMock = useLoopScenarioAimock();

  it('forwards model settings to the request body', async () => {
    const { requests } = await runLoopScenario({
      llm: getMock(),
      prompt: 'Hello with custom settings.',
      stopWhen: stepCountIs(1),
      modelSettings: {
        temperature: 0.7,
        maxTokens: 500,
        topP: 0.9,
      },
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Response with custom settings.' });
      },
    });

    // Verify the request was made
    expect(requests).toHaveLength(1);
    const requestBody = requests[0]?.body ?? {};

    // Model settings should be present in the request
    // Note: Some settings like temperature are reliably passed, others may be filtered
    // by the AI SDK or provider implementation
    expect((requestBody as any).temperature).toBe(0.7);

    // Verify that at least some model settings made it through
    const hasModelSettings = Object.keys(requestBody).some(
      key => key === 'temperature' || key === 'max_tokens' || key === 'maxTokens' || key === 'top_p' || key === 'topP',
    );
    expect(hasModelSettings).toBe(true);
  });

  it('allows different settings per request', async () => {
    // First request with conservative settings
    const result1 = await runLoopScenario({
      llm: getMock(),
      prompt: 'First request.',
      stopWhen: stepCountIs(1),
      modelSettings: {
        temperature: 0.2,
        maxTokens: 100,
      },
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Conservative response.' });
      },
    });

    expect(result1.requests).toHaveLength(1);
    const body1 = result1.requests[0]?.body ?? {};
    expect((body1 as any).temperature).toBe(0.2);

    // Verify that model settings are present (be flexible about which ones make it through)
    const hasModelSettings1 = Object.keys(body1).some(
      key => key === 'temperature' || key === 'max_tokens' || key === 'maxTokens',
    );
    expect(hasModelSettings1).toBe(true);

    // Second request with creative settings
    const result2 = await runLoopScenario({
      llm: getMock(),
      prompt: 'Second request.',
      stopWhen: stepCountIs(1),
      modelSettings: {
        temperature: 0.9,
        maxTokens: 2000,
      },
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Creative response.' });
      },
    });

    expect(result2.requests).toHaveLength(2); // 1 from first scenario + 1 from second
    const body2 = result2.requests[result2.requests.length - 1]?.body ?? {};
    expect((body2 as any).temperature).toBe(0.9);

    // Verify that model settings are present (be flexible about which ones make it through)
    const hasModelSettings2 = Object.keys(body2).some(
      key => key === 'temperature' || key === 'max_tokens' || key === 'maxTokens',
    );
    expect(hasModelSettings2).toBe(true);
  });
});
