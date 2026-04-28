import { describe, it, expect } from 'vitest';
import type { AgentBuilderOptions, AgentFeatures, IAgentBuilder } from './types';

describe('AgentBuilderOptions', () => {
  it('all fields are optional', () => {
    // Type-level assertion: this should compile
    const empty: AgentBuilderOptions = {};
    expect(empty).toBeDefined();
  });

  it('accepts complete options', () => {
    const opts: AgentBuilderOptions = {
      enabled: true,
      features: {
        agent: {
          tools: true,
          agents: false,
          workflows: true,
          scorers: false,
          skills: true,
          memory: false,
          variables: true,
          stars: true,
        },
      },
      configuration: {
        agent: { someKey: 'value' },
      },
    };
    expect(opts.enabled).toBe(true);
  });
});

describe('AgentFeatures', () => {
  it('all fields are optional', () => {
    const empty: AgentFeatures = {};
    expect(empty).toBeDefined();
  });

  it('accepts all boolean toggles', () => {
    const features: AgentFeatures = {
      tools: true,
      agents: true,
      workflows: true,
      scorers: true,
      skills: true,
      memory: true,
      variables: true,
      stars: true,
    };
    expect(features.tools).toBe(true);
    expect(features.stars).toBe(true);
  });

  it('stars accepts true | false | undefined', () => {
    const enabled: AgentFeatures = { stars: true };
    const disabled: AgentFeatures = { stars: false };
    const omitted: AgentFeatures = {};
    expect(enabled.stars).toBe(true);
    expect(disabled.stars).toBe(false);
    expect(omitted.stars).toBeUndefined();
  });
});

describe('IAgentBuilder', () => {
  it('has expected methods', () => {
    // Type-level assertion: this interface shape should be correct
    const builder: IAgentBuilder = {
      enabled: true,
      getFeatures: () => undefined,
      getConfiguration: () => undefined,
    };
    expect(typeof builder.enabled).toBe('boolean');
    expect(typeof builder.getFeatures).toBe('function');
    expect(typeof builder.getConfiguration).toBe('function');
  });
});
