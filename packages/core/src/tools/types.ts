import { ZodSchema } from 'zod';

import { Agent } from '../agent';
import { MastraEngine } from '../engine';
import { LLM } from '../llm';
import { ModelConfig } from '../llm/types';
import { Run } from '../run/types';

export type CoreTool = {
  description: string;
  parameters: ZodSchema;
  execute: (params: any) => Promise<any>;
};

export interface IntegrationApiExcutorParams<T extends Record<string, unknown>> {
  data: T;
  runId?: Run['runId'];
  llm?: (model: ModelConfig) => LLM;
  engine?: MastraEngine | undefined;
  agents?: Record<string, Agent>;
}
