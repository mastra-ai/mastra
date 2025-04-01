import type { ZodSchema } from 'zod';
import type { Metric } from '../eval';

import type { AgentConfig, ToolsInput } from './types';
import { Agent as BaseAgent } from './index';

export class Agent<
  TAgentId extends string = string,
  TSchemaVariables extends ZodSchema | undefined = undefined,
  TTools extends ToolsInput<TSchemaVariables> = ToolsInput<TSchemaVariables>,
  TMetrics extends Record<string, Metric> = Record<string, Metric>,
> extends BaseAgent<TAgentId, TSchemaVariables, TTools, TMetrics> {
  constructor(config: AgentConfig<TAgentId, TSchemaVariables, TTools, TMetrics>) {
    super(config);

    this.logger.warn('Please import "Agent from "@mastra/core/agent" instead of "@mastra/core"');
  }
}
