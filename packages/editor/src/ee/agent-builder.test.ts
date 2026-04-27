import { describe, it, expect } from 'vitest';
import { EditorAgentBuilder } from './agent-builder';

describe('EditorAgentBuilder', () => {
  describe('enabled', () => {
    it('returns true when options.enabled is omitted', () => {
      const builder = new EditorAgentBuilder({});
      expect(builder.enabled).toBe(true);
    });

    it('returns true when options.enabled is true', () => {
      const builder = new EditorAgentBuilder({ enabled: true });
      expect(builder.enabled).toBe(true);
    });

    it('returns false when options.enabled is false', () => {
      const builder = new EditorAgentBuilder({ enabled: false });
      expect(builder.enabled).toBe(false);
    });

    it('returns true when options is empty', () => {
      const builder = new EditorAgentBuilder();
      expect(builder.enabled).toBe(true);
    });
  });

  describe('getFeatures', () => {
    it('returns undefined when features not set', () => {
      const builder = new EditorAgentBuilder({});
      expect(builder.getFeatures()).toBeUndefined();
    });

    it('returns features object unchanged', () => {
      const features = { agent: { tools: true, memory: false } };
      const builder = new EditorAgentBuilder({ features });
      expect(builder.getFeatures()).toBe(features);
    });

    it('returns features with all toggles', () => {
      const features = {
        agent: {
          tools: true,
          agents: true,
          workflows: false,
          scorers: true,
          skills: false,
          memory: true,
          variables: false,
        },
      };
      const builder = new EditorAgentBuilder({ features });
      expect(builder.getFeatures()).toEqual(features);
    });
  });

  describe('getConfiguration', () => {
    it('returns undefined when configuration not set', () => {
      const builder = new EditorAgentBuilder({});
      expect(builder.getConfiguration()).toBeUndefined();
    });

    it('returns configuration object unchanged', () => {
      const configuration = { agent: { someKey: 'value' } };
      const builder = new EditorAgentBuilder({ configuration });
      expect(builder.getConfiguration()).toBe(configuration);
    });
  });

  describe('getAgent', () => {
    it('returns the pre-built builder agent', () => {
      const builder = new EditorAgentBuilder({});
      const agent = builder.getAgent();
      expect(agent).toBeDefined();
      expect(agent.id).toBe('agent-builder');
    });
  });
});
