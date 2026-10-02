import type { InputProcessorOrWorkflow, OutputProcessorOrWorkflow } from '@mastra/core/processors';
import { SignalProvider } from '@mastra/core/signals';

import { CrossAgentMessagingExpectedReplyProcessor } from './messaging-processor.js';
import { AgentConnectionRegistry, type AgentConnectionRegistryOptions } from './registry.js';
import { AgentConnectionsStateProcessor } from './state-processor.js';
import { createAgentConnectionTools } from './tools.js';

export interface CrossAgentMessagingSignalProviderOptions extends AgentConnectionRegistryOptions {}
export interface AgentConnectionsSignalProviderOptions extends CrossAgentMessagingSignalProviderOptions {}

export class CrossAgentMessagingSignalProvider extends SignalProvider<'cross-agent-messaging'> {
  readonly id = 'cross-agent-messaging';

  readonly #registry: AgentConnectionRegistry;
  readonly #stateProcessor: AgentConnectionsStateProcessor;
  readonly #expectedReplyProcessor: CrossAgentMessagingExpectedReplyProcessor;

  constructor(options: CrossAgentMessagingSignalProviderOptions = {}) {
    super();
    this.#registry = new AgentConnectionRegistry(options);
    this.#stateProcessor = new AgentConnectionsStateProcessor({ ...options, getAgent: () => this.agent });
    this.#expectedReplyProcessor = new CrossAgentMessagingExpectedReplyProcessor();
  }

  getInputProcessors(): InputProcessorOrWorkflow[] {
    return [this.#stateProcessor];
  }

  getOutputProcessors(): OutputProcessorOrWorkflow[] {
    return [this.#expectedReplyProcessor];
  }

  getTools() {
    return createAgentConnectionTools({
      registry: this.#registry,
      getAgent: () => this.agent,
    });
  }
}

export class AgentConnectionsSignalProvider extends CrossAgentMessagingSignalProvider {}
