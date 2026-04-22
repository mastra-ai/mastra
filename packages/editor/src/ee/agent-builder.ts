import type { AgentBuilderOptions, IAgentBuilder } from '@mastra/core/agent-builder/ee';

/**
 * Concrete implementation of the Agent Builder EE feature.
 * Instantiated by MastraEditor.resolveBuilder() when builder config is enabled.
 */
export class EditorAgentBuilder implements IAgentBuilder {
  private readonly options: AgentBuilderOptions;

  constructor(options?: AgentBuilderOptions) {
    this.options = options ?? {};
  }

  get enabled(): boolean {
    return this.options.enabled !== false;
  }

  getFeatures(): AgentBuilderOptions['features'] {
    return this.options.features;
  }

  getConfiguration(): AgentBuilderOptions['configuration'] {
    return this.options.configuration;
  }
}
