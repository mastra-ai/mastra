import { z } from 'zod';

import { IExecutionContext } from '../action';
import { Agent } from '../agent';
import { MastraEngine } from '../engine';
import { LLM } from '../llm';
import { ModelConfig } from '../llm/types';
import { MastraMemory } from '../memory';
import { MastraVector } from '../vector';

export type StripUndefined<T> = T extends undefined ? never : T;
export interface MastraExecutionContext<TSchemaIn extends z.ZodSchema = any>
  extends IExecutionContext<z.infer<TSchemaIn>, any> {
  runId?: string;
  engine?: MastraEngine;
  agents?: Record<string, Agent>;
  vectors?: Record<string, MastraVector>;
  memory?: MastraMemory;
  llm?: (model: ModelConfig) => LLM;
}
