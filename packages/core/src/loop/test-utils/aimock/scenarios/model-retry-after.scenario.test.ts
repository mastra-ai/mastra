import { it, expect } from 'vitest';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Cross-engine port of the maxRetries precedence rules from
 * packages/core/src/agent/__tests__/model-retry-after.test.ts (#19885).
 *
 * The source suite drives a MockLanguageModelV2 with fake timers to also pin
 * the Retry-After *timing* contract. Fake timers cannot cross the AIMock HTTP
 * boundary, so this port pins the engine-sensitive half: how many model calls
 * are made under each maxRetries configuration. That is exactly the part that
 * must survive durable serialization — an agent-level `maxRetries` and a
 * call-time `modelSettings.maxRetries` both have to reach the llm-execution
 * step with correct precedence on every engine.
 *
 * AIMock's 429 responses carry `Retry-After: 1` (its default), so each retry
 * waits ~1s of real time; the request counts below are the source suite's
 * expectations verbatim.
 */

const RATE_LIMITED = {
  error: { message: 'rate limited', type: 'rate_limit_error', code: 'rate_limit_exceeded' },
  status: 429,
} as const;

describeForAllEngines('AIMock loop scenario: model-call retry maxRetries precedence', engine => {
  const getMock = useLoopScenarioAimock();

  it('does not retry when neither the agent nor the call configures retries', async () => {
    const { requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'hi',
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, RATE_LIMITED);
      },
    });

    expect(requests).toHaveLength(1);
  });

  it('honors call-time modelSettings.maxRetries when the agent retry count is implicit', async () => {
    const { requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'hi',
      modelSettings: { maxRetries: 2 },
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, RATE_LIMITED);
      },
    });

    expect(requests).toHaveLength(3);
  }, 20_000);

  it('keeps a non-zero explicit agent maxRetries over call-time modelSettings', async () => {
    const { requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'hi',
      maxRetries: 1,
      modelSettings: { maxRetries: 5 },
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, RATE_LIMITED);
      },
    });

    expect(requests).toHaveLength(2);
  }, 20_000);

  it('keeps an explicit zero agent maxRetries over call-time modelSettings', async () => {
    const { requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'hi',
      maxRetries: 0,
      modelSettings: { maxRetries: 2 },
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, RATE_LIMITED);
      },
    });

    expect(requests).toHaveLength(1);
  });
});
