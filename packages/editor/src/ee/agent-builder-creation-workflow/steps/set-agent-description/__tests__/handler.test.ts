import type { Agent } from '@mastra/core/agent';
import { describe, it, expect, vi } from 'vitest';

import { resolveDescription } from '../handler';

function makeAgent(object: { description: string }) {
  const generate = vi.fn().mockResolvedValue({ object });
  return { agent: { generate } as unknown as Agent, generate };
}

describe('resolveDescription', () => {
  it('returns the agent-produced description', async () => {
    const { agent, generate } = makeAgent({ description: 'Helps triage support tickets.' });
    await expect(resolveDescription(agent, 'a support triage agent')).resolves.toBe('Helps triage support tickets.');
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('trims the agent-produced description', async () => {
    const { agent } = makeAgent({ description: '  Padded sentence.  ' });
    await expect(resolveDescription(agent, 'an agent')).resolves.toBe('Padded sentence.');
  });

  it('passes a structured-output schema to the agent', async () => {
    const { agent, generate } = makeAgent({ description: 'x' });
    await resolveDescription(agent, 'an agent');
    expect(generate.mock.calls[0]?.[1]).toMatchObject({ structuredOutput: { schema: expect.anything() } });
  });

  it('weaves the user outcome into the prompt', async () => {
    const { agent, generate } = makeAgent({ description: 'x' });
  const userOutcome = {
    goal: 'Triage support tickets fast',
    audience: 'Support agents',
    capabilities: ['Classify', 'Route'],
    tone: 'Friendly',
    successCriteria: ['Correct routing'],
  };
    await resolveDescription(agent, 'an agent', userOutcome);
    expect(generate.mock.calls[0]?.[0]).toContain('Triage support tickets fast');
  });
});
