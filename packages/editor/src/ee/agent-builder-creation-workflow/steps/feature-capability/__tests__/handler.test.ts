import type { Mastra } from '@mastra/core';
import { describe, it, expect } from 'vitest';

import type { Config, UserOutcome } from '../../../types';
import { createFeatureCapabilityStep } from '../index';

const userOutcome: UserOutcome = {
  goal: 'Help users',
  audience: 'everyone',
  capabilities: [],
  tone: 'friendly',
  successCriteria: [],
};

function makeMastra(opts: { hasEditor?: boolean; features?: Record<string, unknown> } = {}): Mastra {
  const { hasEditor = true, features = { agent: {} } } = opts;
  const builder = {
    enabled: true,
    getFeatures: () => features,
    getConfiguration: () => ({ agent: {} }),
  };
  const editor = {
    resolveBuilder: async () => builder,
    hasEnabledBuilderConfig: () => true,
  };
  return {
    getEditor: () => (hasEditor ? editor : undefined),
  } as unknown as Mastra;
}

function runStep(mastra: Mastra) {
  const step = createFeatureCapabilityStep({ model: 'openai/gpt-5.5' });
  const inputData: Config = { userOutcome };
  return (step.execute as (args: { inputData: Config; mastra: Mastra }) => Promise<Config>)({ inputData, mastra });
}

describe('feature-capability step', () => {
  it('writes the resolved capability map into the config', async () => {
    const mastra = makeMastra({ features: { agent: { tools: true, skills: true, browser: true } } });
    const result = await runStep(mastra);

    expect(result.userOutcome).toEqual(userOutcome);
    expect(result.featureCapabilities).toEqual({
      tools: true,
      agents: false,
      workflows: false,
      scorers: false,
      skills: true,
      memory: false,
      variables: false,
      favorites: false,
      avatarUpload: false,
      browser: true,
      model: false,
    });
  });

  it('resolves an all-false map when no editor is available', async () => {
    const result = await runStep(makeMastra({ hasEditor: false }));

    expect(result.featureCapabilities).toEqual({
      tools: false,
      agents: false,
      workflows: false,
      scorers: false,
      skills: false,
      memory: false,
      variables: false,
      favorites: false,
      avatarUpload: false,
      browser: false,
      model: false,
    });
  });

  it('preserves the rest of the config', async () => {
    const mastra = makeMastra();
    const step = createFeatureCapabilityStep({ model: 'openai/gpt-5.5' });
    const inputData: Config = { userOutcome, name: 'Helper', description: 'A helper' };
    const result = await (step.execute as (args: { inputData: Config; mastra: Mastra }) => Promise<Config>)({
      inputData,
      mastra,
    });

    expect(result.name).toBe('Helper');
    expect(result.description).toBe('A helper');
  });
});
