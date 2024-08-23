import { OAuth2Token } from '@badgateway/oauth2-client';
import { BaseContext } from 'inngest';
import { ZodObject, ZodSchema, any } from 'zod';
import { DataLayer } from './data-access';
import { Integration } from './integration';

export type FrameWorkConfig = {
  name: string;
  routeRegistrationPath: string;
  systemHostURL: string;
  blueprintDirPath: string;
};

export type EventSchema = ZodSchema<unknown>;

export type IntegrationContext = {
  referenceId: string;
};

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
  integrationName: string;
  schema?: ZodSchema<T>;
  outputSchema?:
    | ZodSchema<T>
    | (({ ctx }: { ctx: IntegrationContext }) => Promise<ZodSchema<T>>);
  type: string;
  label: string;
  getSchemaOptions?: ({
    ctx,
  }: {
    ctx: IntegrationContext;
  }) => Promise<Record<string, SchemaFieldOptions>>;
  icon?: frameWorkIcon;
  description: string;
  isHidden?: boolean;
};

export interface IntegrationActionExcutorParams<T> {
  data: T;
}

/**
 * @param T - the type of the Integration Instance
 */
export type IntegrationEvent<T extends Integration> = {
  schema: EventSchema;
  triggerProperties?: IntegrationEventTriggerProperties;
  handler?: EventHandler<T>;
};

export type IntegrationAction<T = unknown, U = unknown> = {
  integrationName: string;
  schema:
    | ZodSchema<T>
    | (({ ctx }: { ctx: IntegrationContext }) => Promise<ZodSchema<T>>);
  outputSchema?:
    | ZodSchema<U>
    | (({ ctx }: { ctx: IntegrationContext }) => Promise<ZodSchema<U>>);
  type: string;
  label: string;
  getSchemaOptions?: ({
    ctx,
  }: {
    ctx: IntegrationContext;
  }) => Promise<Record<string, SchemaFieldOptions>>;
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

export interface IntegrationActionExcutorParams<T> {
  data: T;
  ctx: IntegrationContext;
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

export enum IntegrationCredentialType {
  OAUTH = 'OAUTH',
  API_KEY = 'API_KEY',
}

export const IntegrationFieldTypeEnum = {
  SINGLE_LINE_TEXT: 'SINGLE_LINE_TEXT',
  LONG_TEXT: 'LONG_TEXT',
  SINGLE_SELECT: 'SINGLE_SELECT',
  MULTI_SELECT: 'MULTI_SELECT',
  CREATABLE_SELECT: 'CREATABLE_SELECT',
  CHECKBOX: 'CHECKBOX',
  DATE: 'DATE',
  USER: 'USER',
  BADGE_LIST: 'BADGE_LIST',
  CURRENCY: 'CURRENCY',
  URL: 'URL',
  PHONE: 'PHONE',
  CONTACT: 'CONTACT',
  COMPANY: 'COMPANY',
  COMPOSITE: 'COMPOSITE',
  PERSON: 'PERSON',
  ENRICHMENT: 'ENRICHMENT',
} as const;

export type IntegrationFieldType = keyof typeof IntegrationFieldTypeEnum;
export type OAuthToken = OAuth2Token & { [key: string]: any };
export type APIKey = { apiKey: string } & { [key: string]: any };
export type CredentialValue = OAuthToken | APIKey;
export type AuthToken = Omit<OAuthToken, 'refreshToken'> | APIKey;

export type MakeWebhookURL = ({
  event,
  name,
}: {
  name: string;
  event: string;
}) => string;

export type EventHandlerExecutorParams = BaseContext<any>;

export type EventHandlerReturnType = {
  id: string;
  event: string;
  executor: ({ event, step }: EventHandlerExecutorParams) => Promise<any>;
  onFailure?: ({
    event,
  }: {
    event: {
      data: {
        event: { data: Record<string, any>; user: Record<string, string> };
      };
    };
  }) => Promise<any>;
  cancelOn?: { event: string; if: string }[];
};

/**
 * @param T - the type of the Integration Instance defining the event handler
 */
export type EventHandler<T = unknown> = (params: {
  integrationInstance: T;
  eventKey: string;
  makeWebhookUrl: MakeWebhookURL;
}) => EventHandlerReturnType;

export type QueryResult<T> = {
  data: T;
};

export type Routes = 'connect' | 'callback' | 'inngest' | 'webhook';
