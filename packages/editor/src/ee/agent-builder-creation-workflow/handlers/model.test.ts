import type { Agent } from '@mastra/core/agent';
import { describe, it, expect, vi } from 'vitest';

import { resolveModel } from './model';
import type { AgentModel } from './types';

function makeAgent(object: AgentModel) {
  const generate = vi.fn().mockResolvedValue({ object });
  return { agent: { generate } as unknown as Agent, generate };
}

const available: AgentModel[] = [
  { provider: 'openai', name: 'gpt-5.5' },
  { provider: 'anthropic', name: 'claude-sonnet-4-6' },
];

describe('resolveModel', () => {
  it('returns the explicit pair without calling the agent', async () => {
    const { agent, generate } = makeAgent({ provider: 'x', name: 'y' });
    await expect(resolveModel(agent, { provider: 'openai', name: 'gpt-5.5' })).resolves.toEqual({
      provider: 'openai',
      name: 'gpt-5.5',
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it('asks the agent to choose when no explicit model and candidates exist', async () => {
    const { agent, generate } = makeAgent({ provider: 'anthropic', name: 'claude-sonnet-4-6' });
    await expect(resolveModel(agent, undefined, available)).resolves.toEqual({
      provider: 'anthropic',
      name: 'claude-sonnet-4-6',
    });
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('returns undefined when the agent picks something not in the list', async () => {
    const { agent } = makeAgent({ provider: 'made-up', name: 'ghost' });
    await expect(resolveModel(agent, undefined, available)).resolves.toBeUndefined();
  });

  it('returns undefined when no model and no candidates', async () => {
    const { agent, generate } = makeAgent({ provider: 'x', name: 'y' });
    await expect(resolveModel(agent, undefined, [])).resolves.toBeUndefined();
    expect(generate).not.toHaveBeenCalled();
  });

  it('treats an invalid explicit model as absent and falls back to the agent', async () => {
    const { agent, generate } = makeAgent({ provider: 'openai', name: 'gpt-5.5' });
    await expect(resolveModel(agent, { provider: '', name: 'gpt-5.5' }, available)).resolves.toEqual({
      provider: 'openai',
      name: 'gpt-5.5',
    });
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('returns a fresh object rather than the input reference', async () => {
    const { agent } = makeAgent({ provider: 'x', name: 'y' });
    const input = { provider: 'openai', name: 'gpt-5.5' };
    const result = await resolveModel(agent, input);
    expect(result).not.toBe(input);
    expect(result).toEqual(input);
  });
});
