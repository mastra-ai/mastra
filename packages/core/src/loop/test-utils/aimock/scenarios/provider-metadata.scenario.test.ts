/**
 * AIMock Scenario: Provider Options Passthrough
 *
 * Tests that `providerOptions` can be forwarded through `agent.stream()` and
 * coexist with model settings that ARE observable on the wire.
 *
 * Important controller limitation: the OpenAI v5 provider does not serialize
 * `providerOptions` (e.g. `openai.store`, `openai.user`) into the
 * chat-completions request body that AIMock captures — they are carried through
 * a separate provider channel. So we cannot assert those keys directly on the
 * captured request body.
 *
 * To keep these tests falsifiable, each one pairs `providerOptions` with a
 * `modelSettings` value (temperature) that DOES land in the request body. We
 * assert that:
 *   1. the observable setting reaches the body (proving the request was built
 *      from our options, not silently dropped), and
 *   2. passing `providerOptions` alongside it does not break loop execution.
 * A regression that drops model settings during request building fails (1);
 * a regression where `providerOptions` throws fails (2).
 */

import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

describeForAllEngines(
  'AIMock loop scenario: provider options passthrough',
  engine => {
    const getMock = useLoopScenarioAimock();

    it('forwards providerOptions while observable model settings reach the body', async () => {
      const { output, requests } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Hello with metadata.',
        stopWhen: stepCountIs(1),
        modelSettings: { temperature: 0.42 },
        providerOptions: {
          openai: {
            prediction: { type: 'content', content: 'Hello with metadata.' },
            store: true,
          },
        },
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { content: 'Response received.' });
        },
      });

      expect(requests).toHaveLength(1);

      // The observable setting reached the request body, proving the request was
      // assembled from our options rather than silently dropped.
      expect((requests[0]?.body as { temperature?: number })?.temperature).toBe(0.42);

      // The loop completed with providerOptions present.
      expect(await output.text).toBe('Response received.');
    });

    it('forwards multiple provider option namespaces without breaking the loop', async () => {
      const { output, requests } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Request with multiple provider options.',
        stopWhen: stepCountIs(1),
        modelSettings: { temperature: 0.13 },
        providerOptions: {
          openai: {
            parallel_tool_calls: false,
            user: 'test-user-123',
          },
          anthropic: {
            cache_control: { type: 'ephemeral' },
          },
        },
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { content: 'Response with metadata.' });
        },
      });

      expect(requests).toHaveLength(1);
      expect((requests[0]?.body as { temperature?: number })?.temperature).toBe(0.13);
      expect(await output.text).toBe('Response with metadata.');
    });
  },
);
