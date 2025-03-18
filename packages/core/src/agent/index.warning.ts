import type { ZodSchema } from 'zod';
import type { Metric } from '../eval';

import type { AgentConfig, ToolsInput } from './types';
import { Agent as BaseAgent } from './index';

export class Agent<
  TSchemaDeps extends ZodSchema | undefined = undefined,
  TTools extends ToolsInput<TSchemaDeps> = ToolsInput<TSchemaDeps>,
  TMetrics extends Record<string, Metric> = Record<string, Metric>,
> extends BaseAgent<TSchemaDeps, TTools, TMetrics> {
  constructor(config: AgentConfig<TSchemaDeps, TTools, TMetrics>) {
    super(config);

    this.logger.warn('Please import "Agent from "@mastra/core/agent" instead of "@mastra/core"');
  }
}
