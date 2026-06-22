import type { InputProcessorOrWorkflow } from '@mastra/core/processors';
import { SignalProvider } from '@mastra/core/signals';

import { AgentConnectionRegistry, type AgentConnectionRegistryOptions } from './registry.js';
import { AgentConnectionsStateProcessor } from './state-processor.js';
import { createAgentConnectionTools } from './tools.js';

export interface AgentConnectionsSignalProviderOptions extends AgentConnectionRegistryOptions {}

export class AgentConnectionsSignalProvider extends SignalProvider<'agent-connections'> {
  readonly id = 'agent-connections';

  readonly #registry: AgentConnectionRegistry;
  readonly #processor: AgentConnectionsStateProcessor;

  constructor(options: AgentConnectionsSignalProviderOptions = {}) {
    super();
    this.#registry = new AgentConnectionRegistry(options);
    this.#processor = new AgentConnectionsStateProcessor(options);
  }

  getInputProcessors(): InputProcessorOrWorkflow[] {
    return [this.#processor];
  }

  getTools() {
    return createAgentConnectionTools({
      registry: this.#registry,
      getAgent: () => this.agent,
    });
  }
}
