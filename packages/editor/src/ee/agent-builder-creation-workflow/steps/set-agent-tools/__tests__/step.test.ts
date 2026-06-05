import type { Mastra } from '@mastra/core';
import { describe, it, expect } from 'vitest';

import type { Config, UserOutcome } from '../../../types';
import { createSetToolsStep } from '../index';

const userOutcome: UserOutcome = {
  goal: 'Help users',
  audience: 'everyone',
  capabilities: [],
  tone: 'friendly',
  successCriteria: [],
};

const throwingMastra = {
  getEditor: () => {
    throw new Error('mastra should not be touched when no tool capability is enabled');
  },
} as unknown as Mastra;

function runStep(config: Config, mastra: Mastra) {
  const step = createSetToolsStep({ model: 'openai/gpt-5.5' });
  return (step.execute as (args: { inputData: Config; mastra: Mastra }) => Promise<Config>)({ inputData: config, mastra });
}

describe('set-agent-tools step gating', () => {
  it('no-ops without touching mastra when tools/agents/workflows are all disabled', async () => {
    const config: Config = {
      userOutcome,
      featureCapabilities: { tools: false, agents: false, workflows: false } as Config['featureCapabilities'],
    };
    await expect(runStep(config, throwingMastra)).resolves.toEqual(config);
  });

  it('no-ops when featureCapabilities is absent', async () => {
    const config: Config = { userOutcome };
    await expect(runStep(config, throwingMastra)).resolves.toEqual(config);
  });
});
