import { ZodSchema, ZodObject } from 'zod';

export type EventSchema = ZodObject<any>;

export type SchemaFieldOptions =
  | {
      options: { [parentValue: string]: { value: string; label: string }[] };
      parentField: string;
    }
  | { options: { value: string; label: string }[]; parentField?: never }
  | { options: undefined; parentField?: never };

export type frameWorkIcon = {
  icon: string;
  alt: string;
};

export type IntegrationEventTriggerProperties<T = unknown, U = unknown> = {
  schema?: ZodSchema<T>;
  outputSchema?: ZodSchema<T> | (() => Promise<ZodSchema<T>>);
  type: string;
  label: string;
  getSchemaOptions?: () => Promise<Record<string, SchemaFieldOptions>>;
  icon?: frameWorkIcon;
  description: string;
  isHidden?: boolean;
};

export interface IntegrationActionExcutorParams<T> {
  data: T;
}

export type IntegrationEvent = {
  key: string;
  schema: EventSchema;
  triggerProperties?: IntegrationEventTriggerProperties;
};
export type IntegrationAction<T = unknown, U = unknown> = {
  pluginName: string;
  schema: ZodSchema<T> | (() => Promise<ZodSchema<T>>);
  outputSchema?: ZodSchema<U> | (() => Promise<ZodSchema<U>>);
  type: string;
  label: string;
  getSchemaOptions?: () => Promise<Record<string, SchemaFieldOptions>>;
  icon?: frameWorkIcon;
  description: string;
  category?: string;
  executor: (params: IntegrationActionExcutorParams<T>) => Promise<U>;
  isHidden?: boolean;
};

export enum IntegrationErrors {
  BROKEN_CONNECTION = 'BROKEN_CONNECTION',
  MISSING_SCOPES = 'MISSING_SCOPES',
}

export type IntegrationContext = {
  workspaceId: string;
  userId: string;
};

export interface IntegrationActionExcutorParams<T> {
  data: T;
}

export type RefinedIntegrationAction<T = unknown> = Omit<
  IntegrationAction,
  'getSchemaOptions'
> & {
  schemaOptions: Record<string, SchemaFieldOptions>;
  zodSchema: ZodSchema<T>;
  zodOutputSchema: ZodSchema<T>;
};

export type RefinedIntegrationEventTriggerProperties<T = unknown> = Omit<
  IntegrationEventTriggerProperties,
  'getSchemaOptions'
> & {
  schemaOptions: Record<string, SchemaFieldOptions>;
  zodSchema: ZodSchema<T>;
  zodOutputSchema: ZodSchema<T>;
};
