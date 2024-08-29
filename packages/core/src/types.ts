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

export interface IntegrationApiExcutorParams<T> {
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

export type IntegrationApi<T = unknown, U = unknown> = {
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
  executor: (params: IntegrationApiExcutorParams<T>) => Promise<U>;
  isHidden?: boolean;
};

export enum IntegrationErrors {
  BROKEN_CONNECTION = 'BROKEN_CONNECTION',
  MISSING_SCOPES = 'MISSING_SCOPES',
}

export interface IntegrationApiExcutorParams<T> {
  data: T;
  ctx: IntegrationContext;
}

export type RefinedIntegrationApi<T = unknown> = Omit<
  IntegrationApi,
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

// OpenAPI Specification TypeScript Schema
export interface OpenAPI {
  openapi: string; // The OpenAPI version (e.g., "3.0.0")
  info: Info; // Information about the API
  servers?: Server[]; // List of servers
  paths: Paths; // Paths and their operations
  components?: Components; // Reusable components
  security?: SecurityRequirement[]; // Security requirements
  tags?: Tag[]; // Tags for API documentation
  externalDocs?: ExternalDocumentation; // External documentation
}

interface Info {
  title: string; // Title of the API
  version: string; // Version of the API
  description?: string; // Description of the API
  termsOfService?: string; // Terms of service
  contact?: Contact; // Contact information
  license?: License; // License information
}

interface Contact {
  name?: string; // Contact name
  url?: string; // Contact URL
  email?: string; // Contact email
}

interface License {
  name: string; // License name
  url?: string; // License URL
}

interface Server {
  url: string; // URL of the server
  description?: string; // Description of the server
}

interface Paths {
  [path: string]: PathItem; // Keyed by path (e.g., "/users/{id}")
}

interface PathItem {
  summary?: string; // Summary of the path item
  description?: string; // Description of the path item
  get?: Operation; // GET operation
  put?: Operation; // PUT operation
  post?: Operation; // POST operation
  delete?: Operation; // DELETE operation
  options?: Operation; // OPTIONS operation
  head?: Operation; // HEAD operation
  patch?: Operation; // PATCH operation
  trace?: Operation; // TRACE operation
  servers?: Server[]; // List of servers
}

interface Operation {
  summary?: string; // Summary of the operation
  description?: string; // Description of the operation
  operationId?: string; // Unique operation ID
  parameters?: Parameter[]; // List of parameters
  requestBody?: RequestBody; // Request body
  responses: Responses; // Responses
  deprecated?: boolean; // Indicates if the operation is deprecated
  security?: SecurityRequirement[]; // Security requirements
  tags?: string[]; // Tags for the operation
  servers?: Server[]; // List of servers
}

interface Parameter {
  name: string; // Name of the parameter
  in: 'query' | 'header' | 'path' | 'cookie'; // Location of the parameter
  description?: string; // Description of the parameter
  required?: boolean; // Indicates if the parameter is required
  schema: Schema; // Schema defining the parameter
}

interface RequestBody {
  description?: string; // Description of the request body
  content: {
      [mediaType: string]: MediaType; // Media type of the request body
  };
  required?: boolean; // Indicates if the request body is required
}

interface MediaType {
  schema: Schema; // Schema defining the media type
}

interface Responses {
  [statusCode: string]: Response; // Keyed by status code (e.g., "200")
}

interface Response {
  description: string; // Description of the response
  content?: {
      [mediaType: string]: MediaType; // Media type of the response
  };
  headers?: {
      [headerName: string]: Header; // Headers for the response
  };
  links?: {
      [linkName: string]: Link; // Links for the response
  };
}

interface Header {
  description?: string; // Description of the header
  schema: Schema; // Schema defining the header
}

interface Link {
  operationRef?: string; // Reference to an operation
  operationId?: string; // ID of an operation
  parameters?: {
      [parameterName: string]: any; // Parameters for the link
  };
  requestBody?: any; // Request body for the link
  description?: string; // Description of the link
}

interface Schema {
  type?: string; // Data type (e.g., "string", "integer")
  format?: string; // Format of the data type (e.g., "date-time")
  properties?: {
      [propertyName: string]: Schema; // Properties of the schema
  };
  required?: string[]; // Required properties
  items?: Schema; // Items if the schema is an array
  enum?: any[]; // Enum values
  example?: any; // Example value
  $ref?: string; // Reference to another schema
}

interface Components {
  schemas?: {
      [schemaName: string]: Schema; // Reusable schemas
  };
  responses?: {
      [responseName: string]: Response; // Reusable responses
  };
  parameters?: {
      [parameterName: string]: Parameter; // Reusable parameters
  };
  requestBodies?: {
      [requestBodyName: string]: RequestBody; // Reusable request bodies
  };
  headers?: {
      [headerName: string]: Header; // Reusable headers
  };
  securitySchemes?: {
      [securitySchemeName: string]: SecurityScheme; // Reusable security schemes
  };
  links?: {
      [linkName: string]: Link; // Reusable links
  };
  callbacks?: {
      [callbackName: string]: Callback; // Reusable callbacks
  };
}

interface SecurityScheme {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect'; // Type of security scheme
  in?: 'query' | 'header' | 'cookie'; // Location of the API key
  name?: string; // Name of the API key
  scheme?: string; // HTTP scheme
  bearerFormat?: string; // Bearer format
  flows?: OAuthFlows; // OAuth flows
  openIdConnectUrl?: string; // OpenID Connect URL
}

interface OAuthFlows {
  implicit?: OAuthFlow; // OAuth 2.0 implicit flow
  password?: OAuthFlow; // OAuth 2.0 password flow
  clientCredentials?: OAuthFlow; // OAuth 2.0 client credentials flow
  authorizationCode?: OAuthFlow; // OAuth 2.0 authorization code flow
}

interface OAuthFlow {
  authorizationUrl?: string; // Authorization URL
  tokenUrl?: string; // Token URL
  refreshUrl?: string; // Refresh URL
  scopes: {
      [scope: string]: string; // Scopes and their descriptions
  };
}

interface SecurityRequirement {
  [securitySchemeName: string]: string[]; // Security scheme and its required scopes
}

interface Tag {
  name: string; // Name of the tag
  description?: string; // Description of the tag
  externalDocs?: ExternalDocumentation; // External documentation for the tag
}

interface ExternalDocumentation {
  description?: string; // Description of the external documentation
  url: string; // URL of the external documentation
}

interface Callback {
  [callbackName: string]: PathItem; // Callbacks for the API
}
