import type { Mastra } from '@mastra/core';
import { describe, it, expect } from 'vitest';

import type { Config, UserOutcome } from '../../../types';
import { createSetBrowserEnabledStep } from '../index';

const userOutcome: UserOutcome = {
  goal: 'Help users',
  audience: 'everyone',
  capabilities: [],
  tone: 'friendly',
  successCriteria: [],
};

const throwingMastra = {
  getEditor: () => {
    throw new Error('mastra should not be touched when the browser capability is disabled');
  },
} as unknown as Mastra;

function runStep(config: Config, mastra: Mastra) {
  const step = createSetBrowserEnabledStep({ model: 'openai/gpt-5.5' });
  return (step.execute as (args: { inputData: Config; mastra: Mastra }) => Promise<unknown>)({
    inputData: config,
    mastra,
  });
}

describe('set-agent-browser-enabled step gating', () => {
  it('forces browserEnabled false and finalizes output without touching mastra when disabled', async () => {
    const config: Config = {
      userOutcome,
      name: 'Helper',
      description: 'A helper',
      instructions: 'Do things',
      featureCapabilities: { browser: false } as Config['featureCapabilities'],
    };
    await expect(runStep(config, throwingMastra)).resolves.toMatchObject({
      name: 'Helper',
      description: 'A helper',
      instructions: 'Do things',
      browserEnabled: false,
    });
  });

  it('forces browserEnabled false when featureCapabilities is absent', async () => {
    const config: Config = { userOutcome, name: 'Helper', description: 'A helper', instructions: 'Do things' };
    await expect(runStep(config, throwingMastra)).resolves.toMatchObject({ browserEnabled: false });
  });
});
