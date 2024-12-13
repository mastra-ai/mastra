import { z } from 'zod';

import { Agent } from '../agent';
import { MastraEngine } from '../engine';
import { LLM } from '../llm';
import { ModelConfig } from '../llm/types';
import { MastraMemory } from '../memory';
import { MastraVector } from '../vector';

export type RetryConfig = { attempts?: number; delay?: number };

export interface Options {
  retry: RetryConfig;
  // other common options
}

export type ExecuteFn<TSchemaIn extends z.ZodSchema = any, TSchemaOut extends z.ZodSchema = any> = ({
  context,
  runId,
  engine,
}: {
  engine?: MastraEngine;
  agents?: Record<string, Agent>;
  vectors?: Record<string, MastraVector>;
  memory?: MastraMemory;
  context: z.infer<TSchemaIn>;
  llm?: (model: ModelConfig) => LLM;
  runId?: string;
}) => Promise<z.infer<TSchemaOut>>;

export interface ActionParams<
  TId extends string = any,
  TSchemaIn extends z.ZodSchema = any,
  TSchemaOut extends z.ZodSchema = any,
> {
  id: TId;
  description: string;
  inputSchema?: TSchemaIn;
  documentation?: string;
  outputSchema?: TSchemaOut;
  retryConfig?: RetryConfig;
  payload?: Partial<z.infer<TSchemaIn>>;
  execute: ExecuteFn<TSchemaIn, TSchemaOut>;
  enableCache?: boolean;
}

export class Action<
  TId extends string = any,
  TSchemaIn extends z.ZodSchema = any,
  TSchemaOut extends z.ZodSchema = any,
> {
  id: TId;
  description: string;
  documentation?: string;
  inputSchema?: TSchemaIn;
  outputSchema?: TSchemaOut;
  payload?: Partial<z.infer<TSchemaIn>>;
  execute: ExecuteFn<TSchemaIn, TSchemaOut>;
  retryConfig?: RetryConfig;
  enableCache?: boolean;

  constructor({
    id,
    description,
    documentation,
    execute,
    payload,
    outputSchema,
    inputSchema,
    retryConfig,
    enableCache,
  }: ActionParams<TId, TSchemaIn, TSchemaOut>) {
    this.id = id;
    this.documentation = documentation;
    this.description = description;
    this.inputSchema = inputSchema;
    this.payload = payload;
    this.outputSchema = outputSchema;
    this.execute = execute;
    this.retryConfig = retryConfig;
    this.enableCache = enableCache;
  }
}
