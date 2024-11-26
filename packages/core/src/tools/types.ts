import { z, ZodSchema } from 'zod';
import { Integration } from '../integration';
import { LLM } from '../llm';
import { MastraEngine } from '../engine';
import { Agent } from '../agent';

export type CoreTool = {
  description: string;
  parameters: ZodSchema;
  execute: (params: any) => Promise<any>;
};

interface ToolIntegrations<I extends Integration[]> {
  get: <N extends I[number]['name']>(
    name: N
  ) => Extract<I[number], { name: N }>;
}

export interface IntegrationApiExcutorParams<
  T extends Record<string, unknown>,
  TOUT extends Record<string, unknown>,
> {
  data: T;
  integrationsRegistry: <I extends Integration[]>() => ToolIntegrations<I>;
  llm: LLM<Integration[], any, any>;
  engine?: MastraEngine | undefined;
  agents: Map<string, Agent<Integration[], any>>;
}
export type ToolApi<
  IN extends Record<string, unknown> = Record<string, unknown>,
  OUT extends Record<string, unknown> = Record<string, unknown>,
> = {
  // integrationName: string;
  schema: ZodSchema<IN>;
  // | (({ ctx }: { ctx: IntegrationContext }) => Promise<ZodSchema<IN>>);
  //   outputSchema?:
  //     | ZodSchema
  //     | (({ ctx }: { ctx: IntegrationContext }) => Promise<ZodSchema<OUT>>);
  //   type: string;
  label: string;
  //   getSchemaOptions?: ({
  //     ctx,
  //   }: {
  //     ctx: IntegrationContext;
  //   }) => Promise<Record<string, SchemaFieldOptions>>;
  //   icon?: frameWorkIcon;
  description: string;
  documentation?: string;
  outputSchema?: ZodSchema<OUT>;
  //   category?: string;
  executor: (params: IntegrationApiExcutorParams<IN, OUT>) => Promise<OUT>;
  //   isHidden?: boolean;
  //   source?: string;
};

// Helper to extract tools from array of integrations
export type IntegrationTools<T extends Integration> = T['tools'];

// Helper for union to intersection conversion
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never;

// Helper to merge all tools from array of integrations
export type MergeIntegrationTools<T extends Integration[]> =
  UnionToIntersection<IntegrationTools<T[number]>>;

export type AllTools<
  TTools,
  TIntegrations extends Integration[] | undefined = undefined,
> = TTools &
  (TIntegrations extends Integration[]
    ? MergeIntegrationTools<TIntegrations>
    : {});
