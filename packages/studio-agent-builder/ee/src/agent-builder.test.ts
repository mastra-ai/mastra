import { describe, expect, it } from 'vitest';

import { MastraAgentBuilder } from './agent-builder';

describe('MastraAgentBuilder', () => {
  it('applies sensible defaults when no config is provided', () => {
    const builder = new MastraAgentBuilder();

    expect(builder.getEnabledSections()).toEqual(['tools', 'memory', 'skills']);
    expect(builder.getMarketplaceConfig()).toEqual({
      enabled: true,
      showAgents: true,
      showSkills: true,
    });
    expect(builder.getConfigureConfig()).toEqual({
      allowSkillCreation: true,
      allowAppearance: true,
    });
    expect(builder.getRecentsConfig()).toEqual({ maxItems: 5 });
  });

  it('merges user config over defaults without losing unspecified keys', () => {
    const builder = new MastraAgentBuilder({
      enabledSections: ['tools'],
      marketplace: { enabled: false },
      configure: { allowAppearance: false },
      recents: { maxItems: 3 },
    });

    expect(builder.getEnabledSections()).toEqual(['tools']);
    expect(builder.getMarketplaceConfig()).toEqual({
      enabled: false,
      showAgents: true,
      showSkills: true,
    });
    expect(builder.getConfigureConfig()).toEqual({
      allowSkillCreation: true,
      allowAppearance: false,
    });
    expect(builder.getRecentsConfig()).toEqual({ maxItems: 3 });
  });
});
