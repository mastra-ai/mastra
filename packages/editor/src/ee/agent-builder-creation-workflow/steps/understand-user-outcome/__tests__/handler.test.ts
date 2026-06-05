import type { Agent } from '@mastra/core/agent';
import { describe, it, expect, vi } from 'vitest';

import { resolveUserOutcome } from '../handler';
import type { UserOutcome } from '../../../types';

function makeAgent(object: UserOutcome) {
  const generate = vi.fn().mockResolvedValue({ object });
  return { agent: { generate } as unknown as Agent, generate };
}

const outcome: UserOutcome = {
  goal: 'Help users triage support tickets quickly',
  audience: 'Customer support agents',
  capabilities: ['Classify tickets', 'Draft replies'],
  tone: 'Friendly and concise',
  successCriteria: ['Tickets routed correctly', 'Faster first response'],
};

describe('resolveUserOutcome', () => {
  it('asks the agent to interpret the prompt and returns the structured outcome', async () => {
    const { agent, generate } = makeAgent(outcome);
    await expect(resolveUserOutcome(agent, 'a support triage bot')).resolves.toEqual(outcome);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('passes the raw prompt to the agent', async () => {
    const { agent, generate } = makeAgent(outcome);
    await resolveUserOutcome(agent, 'a support triage bot');
    expect(generate.mock.calls[0]?.[0]).toContain('a support triage bot');
  });

  it('passes a structured-output schema to the agent', async () => {
    const { agent, generate } = makeAgent(outcome);
    await resolveUserOutcome(agent, 'anything');
    expect(generate.mock.calls[0]?.[1]).toMatchObject({ structuredOutput: { schema: expect.anything() } });
  });

  it('returns the agent object reference unchanged', async () => {
    const { agent } = makeAgent(outcome);
    await expect(resolveUserOutcome(agent, 'anything')).resolves.toBe(outcome);
  });
});
