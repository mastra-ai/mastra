import type { Agent } from '@mastra/core/agent';
import { describe, it, expect, vi } from 'vitest';

import { resolveInstructions } from '../handler';

function makeAgent(object: { instructions: string }) {
  const generate = vi.fn().mockResolvedValue({ object });
  return { agent: { generate } as unknown as Agent, generate };
}

describe('resolveInstructions', () => {
  it('returns explicit instructions verbatim without calling the agent', async () => {
    const { agent, generate } = makeAgent({ instructions: 'generated' });
    await expect(resolveInstructions(agent, 'Name', 'desc', 'Do exactly this.')).resolves.toBe('Do exactly this.');
    expect(generate).not.toHaveBeenCalled();
  });

  it('returns an explicit empty string verbatim (does not call the agent)', async () => {
    const { agent, generate } = makeAgent({ instructions: 'generated' });
    await expect(resolveInstructions(agent, 'Name', 'desc', '')).resolves.toBe('');
    expect(generate).not.toHaveBeenCalled();
  });

  it('generates a prompt via the agent when no explicit value', async () => {
    const { agent, generate } = makeAgent({ instructions: 'You are Support Hero...' });
    await expect(resolveInstructions(agent, 'Support Hero', 'helps customers')).resolves.toBe(
      'You are Support Hero...',
    );
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('generates when explicitInstructions is undefined', async () => {
    const { agent, generate } = makeAgent({ instructions: 'You are Bot.' });
    await expect(resolveInstructions(agent, 'Bot', 'does things', undefined)).resolves.toBe('You are Bot.');
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('passes a structured-output schema to the agent', async () => {
    const { agent, generate } = makeAgent({ instructions: 'x' });
    await resolveInstructions(agent, 'Name', 'desc');
    expect(generate.mock.calls[0]?.[1]).toMatchObject({ structuredOutput: { schema: expect.anything() } });
  });

  it('weaves the user outcome into the prompt', async () => {
    const { agent, generate } = makeAgent({ instructions: 'x' });
    const userOutcome = {
      goal: 'Triage support tickets fast',
      audience: 'Support agents',
      capabilities: ['Classify', 'Route'],
      tone: 'Friendly',
      successCriteria: ['Correct routing'],
    };
    await resolveInstructions(agent, 'Name', 'desc', undefined, userOutcome);
    expect(generate.mock.calls[0]?.[0]).toContain('Triage support tickets fast');
  });
});
