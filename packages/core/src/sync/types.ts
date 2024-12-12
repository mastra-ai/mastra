import { ZodSchema } from 'zod';

import { Agent } from '../agent';
import { MastraEngine } from '../engine';
import { Integration } from '../integration';
import { LLM } from '../llm';
import { ModelConfig } from '../llm/types';
import { Run } from '../run/types';
import { ToolApi } from '../tools/types';
import { MastraVector } from '../vector';

export interface SyncIntegrationRegistry<I extends Integration[]> {
  get: <N extends I[number]['name']>(name: N) => Extract<I[number], { name: N }>;
}

export interface SyncToolRegistry<T extends Record<string, ToolApi<any, any>>> {
  get: <N extends keyof T>(name: N) => T[N];
}

export interface syncApi<IN extends Record<string, unknown>, OUT extends Record<string, unknown>> {
  label: string;
  schema: ZodSchema<IN>;
  outputShema?: ZodSchema<OUT>;
  description: string;
  executor: (params: {
    data: IN;
    runId?: Run['runId'];
    engine: MastraEngine;
    agents: Record<string, Agent>;
    vectors: Record<string, MastraVector> | undefined;
    llm: (model: ModelConfig) => LLM;
  }) => Promise<OUT>;
}
