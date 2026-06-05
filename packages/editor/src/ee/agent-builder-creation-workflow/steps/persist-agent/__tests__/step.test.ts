import type { Mastra } from '@mastra/core';
import { describe, it, expect, vi } from 'vitest';

import type { Config, UserOutcome } from '../../../types';
import { createPersistAgentStep } from '../index';

const userOutcome: UserOutcome = {
  goal: 'Help users',
  audience: 'everyone',
  capabilities: [],
  tone: 'friendly',
  successCriteria: [],
};

function runStep(config: Config, mastra: Mastra) {
  const step = createPersistAgentStep({ model: 'openai/gpt-5.5' });
  return (step.execute as (args: { inputData: Config; mastra: Mastra }) => Promise<any>)({
    inputData: config,
    mastra,
  });
}

describe('persist-agent step', () => {
  it('creates the stored agent with the mapped config and returns the result', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'created' });
    const mastra = {
      getEditor: () => ({
        agent: { create },
        // No builder ⇒ availability resolvers degrade gracefully.
      }),
      listGateways: () => undefined,
    } as unknown as Mastra;

    const config: Config = {
      userOutcome,
      name: 'Helper',
      description: 'A helper',
      instructions: 'Do things',
      model: { provider: 'openai', name: 'gpt-5.5' },
      tools: { t1: true },
    };

    const result = await runStep(config, mastra);

    expect(create).toHaveBeenCalledTimes(1);
    const createInput = create.mock.calls[0][0];
    expect(createInput).toMatchObject({
      name: 'Helper',
      description: 'A helper',
      instructions: 'Do things',
      visibility: 'private',
      model: { provider: 'openai', name: 'gpt-5.5' },
      tools: { t1: {} },
    });
    expect(typeof createInput.id).toBe('string');
    expect(createInput.requestContextSchema).toBeDefined();

    expect(result.id).toBe(createInput.id);
    expect(result.visibility).toBe('private');
    expect(result.config.name).toBe('Helper');
  });

  it('always persists a non-empty model when the config has none', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'created' });
    const mastra = {
      getEditor: () => ({ agent: { create } }),
      listGateways: () => undefined,
    } as unknown as Mastra;

    const config: Config = { userOutcome, name: 'Helper', instructions: 'Do things' };
    await runStep(config, mastra);

    const createInput = create.mock.calls[0][0];
    expect(createInput.model).toBeDefined();
    expect(typeof createInput.model.provider).toBe('string');
    expect(typeof createInput.model.name).toBe('string');
  });

  it('throws when the editor agent namespace is unavailable', async () => {
    const mastra = { getEditor: () => undefined } as unknown as Mastra;
    const config: Config = { userOutcome, name: 'Helper', instructions: 'Do things' };
    await expect(runStep(config, mastra)).rejects.toThrow(/editor agent namespace is unavailable/);
  });
});
