/**
 * MastraAgentBuilder — the attachable configuration for the end-user
 * Agent Builder surface inside Mastra Studio.
 *
 * This class is a plain configuration holder. All license enforcement
 * happens at server boot inside `@mastra/server`'s `ServerAdapter.init()`.
 *
 * @license Mastra Enterprise License — see ../../LICENSE.md
 */

import type {
  IMastraAgentBuilder,
  MastraAgentBuilderConfig,
  AgentBuilderEnabledSection,
  ResolvedAgentBuilderMarketplaceConfig,
  ResolvedAgentBuilderConfigureConfig,
  ResolvedAgentBuilderRecentsConfig,
} from '@mastra/core/agent-builder/ee';

const DEFAULT_ENABLED_SECTIONS: AgentBuilderEnabledSection[] = ['tools', 'memory', 'skills'];

const DEFAULT_MARKETPLACE: ResolvedAgentBuilderMarketplaceConfig = {
  enabled: true,
  showAgents: true,
  showSkills: true,
  allowStarring: true,
  allowSharing: true,
};

const DEFAULT_CONFIGURE: ResolvedAgentBuilderConfigureConfig = {
  allowSkillCreation: true,
  allowAppearance: true,
  allowAvatarUpload: true,
};

const DEFAULT_RECENTS: ResolvedAgentBuilderRecentsConfig = {
  maxItems: 5,
};

export class MastraAgentBuilder implements IMastraAgentBuilder {
  readonly enabledSections: AgentBuilderEnabledSection[];
  readonly marketplace: ResolvedAgentBuilderMarketplaceConfig;
  readonly configure: ResolvedAgentBuilderConfigureConfig;
  readonly recents: ResolvedAgentBuilderRecentsConfig;
  readonly defaultMemoryConfig: Record<string, unknown> | null;

  constructor(config: MastraAgentBuilderConfig = {}) {
    this.enabledSections = config.enabledSections ?? DEFAULT_ENABLED_SECTIONS;
    this.marketplace = { ...DEFAULT_MARKETPLACE, ...(config.marketplace ?? {}) };
    this.configure = { ...DEFAULT_CONFIGURE, ...(config.configure ?? {}) };
    this.recents = { ...DEFAULT_RECENTS, ...(config.recents ?? {}) };
    this.defaultMemoryConfig = config.defaultMemoryConfig ?? null;
  }

  getEnabledSections(): AgentBuilderEnabledSection[] {
    return this.enabledSections;
  }

  getMarketplaceConfig(): ResolvedAgentBuilderMarketplaceConfig {
    return this.marketplace;
  }

  getConfigureConfig(): ResolvedAgentBuilderConfigureConfig {
    return this.configure;
  }

  getRecentsConfig(): ResolvedAgentBuilderRecentsConfig {
    return this.recents;
  }

  getDefaultMemoryConfig(): Record<string, unknown> | null {
    return this.defaultMemoryConfig;
  }
}
