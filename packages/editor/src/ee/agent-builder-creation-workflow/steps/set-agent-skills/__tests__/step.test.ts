import type { Mastra } from '@mastra/core';
import { describe, it, expect } from 'vitest';

import type { Config, UserOutcome } from '../../../types';
import { createSetSkillsStep } from '../index';

const userOutcome: UserOutcome = {
  goal: 'Help users',
  audience: 'everyone',
  capabilities: [],
  tone: 'friendly',
  successCriteria: [],
};

// A mastra stub whose access throws — proves the step short-circuited.
const throwingMastra = {
  getEditor: () => {
    throw new Error('mastra should not be touched when the capability is disabled');
  },
} as unknown as Mastra;

function runStep(config: Config, mastra: Mastra) {
  const step = createSetSkillsStep({ model: 'openai/gpt-5.5' });
  return (step.execute as (args: { inputData: Config; mastra: Mastra }) => Promise<Config>)({ inputData: config, mastra });
}

describe('set-agent-skills step gating', () => {
  it('no-ops without touching mastra when the skills capability is disabled', async () => {
    const config: Config = { userOutcome, featureCapabilities: { skills: false } as Config['featureCapabilities'] };
    await expect(runStep(config, throwingMastra)).resolves.toEqual(config);
  });

  it('no-ops when featureCapabilities is absent', async () => {
    const config: Config = { userOutcome };
    await expect(runStep(config, throwingMastra)).resolves.toEqual(config);
  });
});
