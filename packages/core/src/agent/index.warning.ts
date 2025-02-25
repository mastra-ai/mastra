import type { Metric } from '../eval';
import type { ToolAction } from '../tools';

import type { AgentConfig } from './types';
import { Agent as BaseAgent } from './index';

export class Agent<
  TTools extends Record<string, ToolAction<any, any, any, any>> = Record<string, ToolAction<any, any, any, any>>,
  TMetrics extends Record<string, Metric> = Record<string, Metric>,
> extends BaseAgent<TTools, TMetrics> {
  constructor(config: AgentConfig<TTools, TMetrics>) {
    super(config);

    this.logger.warn('Please import "Agent from "@mastra/core/agent" instead of "@mastra/core"');
  }
}
