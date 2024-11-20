import { ZodSchema } from 'zod';
import { Integration } from '../integration';
import { LLM } from '../llm';
import { MastraEngine } from '../engine';
import { Agent } from '../agent';

export type CoreTool = {
  description: string;
  parameters: ZodSchema;
  execute: (params: any) => Promise<any>;
};
export interface IntegrationApiExcutorParams<
  TIntegrations extends Integration[] | unknown = unknown,
  T extends Record<string, any> | Record<string, any> = Record<string, any>,
> {
  data: T;
  getIntegration: <
    I extends TIntegrations extends Integration[]
      ? TIntegrations[number]['name']
      : never,
  >(
    name: I
  ) => TIntegrations extends Integration[]
    ? Extract<TIntegrations[number], { name: I }>
    : never;
  llm: LLM<
    TIntegrations extends Integration[] ? TIntegrations : never,
    any,
    any
  >;
  engine: MastraEngine | undefined;
  agents: Map<string, Agent<Integration[], any>>;
}
export type ToolApi<
  TIntegrations extends Integration[] | unknown = unknown,
  IN extends Record<string, any> = Record<string, any>,
  OUT extends Record<string, any> = Record<string, any>,
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
  //   category?: string;
  executor: (
    params: IntegrationApiExcutorParams<TIntegrations, IN>
  ) => Promise<OUT>;
  //   isHidden?: boolean;
  //   source?: string;
};

type ToolRecord<TIntegrations extends Integration[] | undefined> = Record<
  string,
  ToolApi<TIntegrations, Record<string, any>, Record<string, any>>
>;

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
  TIntegrations extends Integration[] | undefined = undefined,
  TTools extends ToolRecord<TIntegrations> | undefined = undefined,
> = (TTools extends ToolRecord<TIntegrations> ? TTools : {}) &
  (TIntegrations extends Integration[]
    ? MergeIntegrationTools<TIntegrations>
    : {});
