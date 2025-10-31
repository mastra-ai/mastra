import type { ToolAction } from '../tools';

import type { AgentConfig } from './types';
import { Agent as BaseAgent } from './index';

/**
 * @deprecated Please import Agent from "@mastra/core/agent" instead of "@mastra/core"
 *
 * This import path has restricted types and may cause type errors with provider-defined tools.
 */
export class Agent<
  TAgentId extends string = string,
  TTools extends Record<string, ToolAction<any, any, any>> = Record<string, ToolAction<any, any, any>>,
> extends BaseAgent<TAgentId, TTools> {
  constructor(config: AgentConfig<TAgentId, TTools>) {
    super(config);

    this.logger.warn('Please import Agent from "@mastra/core/agent" instead of "@mastra/core"');
  }
}
