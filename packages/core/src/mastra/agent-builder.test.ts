import { describe, expect, it } from 'vitest';
import type { IMastraAgentBuilder } from '../agent-builder/ee';
import { Mastra } from './index';

function makeFakeAgentBuilder(): IMastraAgentBuilder {
  return {
    enabledSections: ['tools'],
    marketplace: { enabled: true, showAgents: true, showSkills: true },
    configure: { allowSkillCreation: true, allowAppearance: true },
    recents: { maxItems: 5 },
    getEnabledSections() {
      return this.enabledSections as IMastraAgentBuilder['enabledSections'];
    },
    getMarketplaceConfig() {
      return this.marketplace;
    },
    getConfigureConfig() {
      return this.configure;
    },
    getRecentsConfig() {
      return this.recents;
    },
  };
}

describe('Mastra agentBuilder wiring', () => {
  it('returns undefined when no agentBuilder is configured', () => {
    const mastra = new Mastra({});
    expect(mastra.getAgentBuilder()).toBeUndefined();
  });

  it('exposes the agentBuilder instance when configured', () => {
    const builder = makeFakeAgentBuilder();
    const mastra = new Mastra({ agentBuilder: builder });
    expect(mastra.getAgentBuilder()).toBe(builder);
    expect(mastra.getAgentBuilder()?.getEnabledSections()).toEqual(['tools']);
  });
});
