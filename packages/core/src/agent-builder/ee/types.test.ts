import { describe, it, expect } from 'vitest';
import { BUILDER_FEATURE_DEFAULTS, resolveAgentFeatures } from './types';
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

describe('resolveAgentFeatures (default-on semantics)', () => {
  it('omitted input → all non-browser features default to true; browser depends on config', () => {
    const resolved = resolveAgentFeatures(undefined, { hasBrowserConfig: false });
    expect(resolved).toEqual({
      ...BUILDER_FEATURE_DEFAULTS,
      browser: false,
    });
  });

  it('empty input behaves identically to undefined input', () => {
    const a = resolveAgentFeatures(undefined, { hasBrowserConfig: false });
    const b = resolveAgentFeatures({}, { hasBrowserConfig: false });
    expect(a).toEqual(b);
  });

  it('explicit false overrides the default-on for any feature', () => {
    const resolved = resolveAgentFeatures({ tools: false, model: false, stars: false }, { hasBrowserConfig: false });
    expect(resolved.tools).toBe(false);
    expect(resolved.model).toBe(false);
    expect(resolved.stars).toBe(false);
    // siblings remain default-on
    expect(resolved.memory).toBe(true);
    expect(resolved.workflows).toBe(true);
  });

  it('explicit true is a no-op vs the default for non-browser features', () => {
    const resolved = resolveAgentFeatures({ tools: true, memory: true }, { hasBrowserConfig: false });
    expect(resolved.tools).toBe(true);
    expect(resolved.memory).toBe(true);
  });

  it('browser defaults to true when hasBrowserConfig is true', () => {
    const resolved = resolveAgentFeatures(undefined, { hasBrowserConfig: true });
    expect(resolved.browser).toBe(true);
  });

  it('browser stays false when hasBrowserConfig is false, regardless of explicit true', () => {
    // Caller (EditorAgentBuilder) is responsible for emitting a warning;
    // resolveAgentFeatures itself just downgrades silently.
    const resolved = resolveAgentFeatures({ browser: true }, { hasBrowserConfig: false });
    expect(resolved.browser).toBe(false);
  });

  it('explicit browser: false always wins, even when config is present', () => {
    const resolved = resolveAgentFeatures({ browser: false }, { hasBrowserConfig: true });
    expect(resolved.browser).toBe(false);
  });

  it('explicit browser: true with config → true', () => {
    const resolved = resolveAgentFeatures({ browser: true }, { hasBrowserConfig: true });
    expect(resolved.browser).toBe(true);
  });

  it('returns a fully-populated Required<AgentFeatures>', () => {
    const resolved = resolveAgentFeatures(undefined, { hasBrowserConfig: false });
    // Every key in AgentFeatures must be a boolean (no undefineds).
    for (const value of Object.values(resolved)) {
      expect(typeof value).toBe('boolean');
    }
  });
});
