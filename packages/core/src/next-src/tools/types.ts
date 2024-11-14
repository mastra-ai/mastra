import { ZodSchema } from 'zod';
import { Integration } from '../integration';

export type CoreTool = {
  description: string;
  parameters: ZodSchema;
  execute: (params: any) => Promise<any>;
};

export interface IntegrationApiExcutorParams<
  T extends Record<string, any> = Record<string, any>
> {
  data: T;
}

export type ToolApi<
  IN extends Record<string, any> = Record<string, any>,
  OUT extends Record<string, any> = Record<string, any>
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
  executor: (params: IntegrationApiExcutorParams<IN>) => Promise<OUT>;
  //   isHidden?: boolean;
  //   source?: string;
};

export type ToolRecord = Record<
  string,
  ToolApi<Record<string, any>, Record<string, any>>
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
  TTools extends ToolRecord | undefined = undefined,
  TIntegrations extends Integration[] | undefined = undefined
> = (TTools extends ToolRecord ? TTools : {}) &
  (TIntegrations extends Integration[]
    ? MergeIntegrationTools<TIntegrations>
    : {});
