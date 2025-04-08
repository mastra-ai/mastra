import type { Metric } from '../eval';
import type { ToolAction } from '../tools';

import type { AgentConfig } from './types';
import { Agent as BaseAgent } from './index';

export class Agent<
  TAgentId extends string = string,
  TTools extends Record<string, ToolAction<any, any, any>> = Record<string, ToolAction<any, any, any>>,
  TMetrics extends Record<string, Metric> = Record<string, Metric>,
> extends BaseAgent<TAgentId, TTools, TMetrics> {
  constructor(config: AgentConfig<TAgentId, TTools, TMetrics>) {
    super(config);

    this.logger.warn('Please import "Agent from "@mastra/core/agent" instead of "@mastra/core"');
  }
}
