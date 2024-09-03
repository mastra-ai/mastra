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

export interface IntegrationApiExcutorParams<T> {
  data: T;
}

export type EventSchema =
  | ZodSchema
  | (({ ctx }: { ctx: IntegrationContext }) => Promise<ZodSchema>);

/**
 * @param T - the type of the Integration Instance
 */
type IntegrationEventHandler<T extends Integration> = {
  handler?: EventHandler<T>;
};

export type IntegrationEvent<T extends Integration> = RefinedIntegrationEvent &
  IntegrationEventHandler<T>;

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

export type RefinedIntegrationEvent<T = unknown> = {
  schema: EventSchema;
  key?: string;
  integrationName?: string;
  label?: string;
  description?: string;
  getSchemaOptions?: ({
    ctx,
  }: {
    ctx: IntegrationContext;
  }) => Promise<Record<string, SchemaFieldOptions>>;
  zodSchema?: ZodSchema<T>;
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
  info: OpenAPI_Info; // Information about the API
  servers?: OpenAPI_Server[]; // List of servers
  paths: OpenAPI_Paths; // Paths and their operations
  components?: OpenAPI_Components; // Reusable components
  security?: OpenAPI_SecurityRequirement[]; // Security requirements
  tags?: OpenAPI_Tag[]; // Tags for API documentation
  externalDocs?: OpenAPI_ExternalDocumentation; // External documentation
}

export interface OpenAPI_Info {
  title: string; // Title of the API
  version: string; // Version of the API
  description?: string; // Description of the API
  termsOfService?: string; // Terms of service
  contact?: OpenAPI_Contact; // Contact information
  license?: OpenAPI_License; // License information
}

export interface OpenAPI_Contact {
  name?: string; // Contact name
  url?: string; // Contact URL
  email?: string; // Contact email
}

export interface OpenAPI_License {
  name: string; // License name
  url?: string; // License URL
}

export interface OpenAPI_Server {
  url: string; // URL of the server
  description?: string; // Description of the server
}

export interface OpenAPI_Paths {
  [path: string]: OpenAPI_PathItem; // Keyed by path (e.g., "/users/{id}")
}

export interface OpenAPI_PathItem {
  summary?: string; // Summary of the path item
  description?: string; // Description of the path item
  get?: OpenAPI_Operation; // GET operation
  put?: OpenAPI_Operation; // PUT operation
  post?: OpenAPI_Operation; // POST operation
  delete?: OpenAPI_Operation; // DELETE operation
  options?: OpenAPI_Operation; // OPTIONS operation
  head?: OpenAPI_Operation; // HEAD operation
  patch?: OpenAPI_Operation; // PATCH operation
  trace?: OpenAPI_Operation; // TRACE operation
  servers?: OpenAPI_Server[]; // List of servers
  parameters?: OpenAPI_Parameter[]; //Top level parameters
}

export interface OpenAPI_Operation {
  summary?: string; // Summary of the operation
  description?: string; // Description of the operation
  operationId?: string; // Unique operation ID
  parameters?: OpenAPI_Parameter[]; // List of parameters
  requestBody?: OpenAPI_RequestBody; // Request body
  responses: OpenAPI_Responses; // Responses
  deprecated?: boolean; // Indicates if the operation is deprecated
  security?: OpenAPI_SecurityRequirement[]; // Security requirements
  tags?: string[]; // Tags for the operation
  servers?: OpenAPI_Server[]; // List of servers
}

export interface OpenAPI_Parameter {
  name: string; // Name of the parameter
  in: 'query' | 'header' | 'path' | 'cookie'; // Location of the parameter
  description?: string; // Description of the parameter
  required?: boolean; // Indicates if the parameter is required
  schema: OpenAPI_Schema; // Schema defining the parameter
  $ref?: string; // Reference to another parameter
  example?: string | string[];
}

export interface OpenAPI_RequestBody {
  description?: string; // Description of the request body
  content: {
    [mediaType: string]: OpenAPI_MediaType; // Media type of the request body
  };
  required?: boolean; // Indicates if the request body is required
}

export interface OpenAPI_MediaType {
  schema: OpenAPI_Schema; // Schema defining the media type
}

export interface OpenAPI_Responses {
  [statusCode: string]: OpenAPI_Response; // Keyed by status code (e.g., "200")
}

export interface OpenAPI_Response {
  description: string; // Description of the response
  content?: {
    [mediaType: string]: OpenAPI_MediaType; // Media type of the response
  };
  headers?: {
    [headerName: string]: OpenAPI_Header; // Headers for the response
  };
  links?: {
    [linkName: string]: OpenAPI_Link; // Links for the response
  };
}

export interface OpenAPI_Header {
  description?: string; // Description of the header
  schema: OpenAPI_Schema; // Schema defining the header
}

export interface OpenAPI_Link {
  operationRef?: string; // Reference to an operation
  operationId?: string; // ID of an operation
  parameters?: {
    [parameterName: string]: any; // Parameters for the link
  };
  requestBody?: any; // Request body for the link
  description?: string; // Description of the link
}

export interface OpenAPI_Schema {
  type?: string; // Data type (e.g., "string", "integer")
  format?: string; // Format of the data type (e.g., "date-time")
  properties?: {
    [propertyName: string]: OpenAPI_Schema; // Properties of the schema
  };
  required?: string[]; // Required properties
  items?: OpenAPI_Schema; // Items if the schema is an array
  enum?: any[]; // Enum values
  example?: any; // Example value
  $ref?: string; // Reference to another schema
  allOf?: OpenAPI_Schema[]; // References to multiple schemas
}

export interface OpenAPI_Components {
  schemas?: {
    [schemaName: string]: OpenAPI_Schema; // Reusable schemas
  };
  responses?: {
    [responseName: string]: OpenAPI_Response; // Reusable responses
  };
  parameters?: {
    [parameterName: string]: OpenAPI_Parameter; // Reusable parameters
  };
  requestBodies?: {
    [requestBodyName: string]: OpenAPI_RequestBody; // Reusable request bodies
  };
  headers?: {
    [headerName: string]: OpenAPI_Header; // Reusable headers
  };
  securitySchemes?: {
    [securitySchemeName: string]: OpenAPI_SecurityScheme; // Reusable security schemes
  };
  links?: {
    [linkName: string]: OpenAPI_Link; // Reusable links
  };
  callbacks?: {
    [callbackName: string]: OpenAPI_PathItem; // Reusable callbacks
  };
}

export interface OpenAPI_SecurityScheme {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect'; // Type of security scheme
  in?: 'query' | 'header' | 'cookie'; // Location of the API key
  name?: string; // Name of the API key
  scheme?: string; // HTTP scheme
  bearerFormat?: string; // Bearer format
  flows?: OpenAPI_OAuthFlows; // OAuth flows
  openIdConnectUrl?: string; // OpenID Connect URL
}

export interface OpenAPI_OAuthFlows {
  implicit?: OpenAPI_OAuthFlow; // OAuth 2.0 implicit flow
  password?: OpenAPI_OAuthFlow; // OAuth 2.0 password flow
  clientCredentials?: OpenAPI_OAuthFlow; // OAuth 2.0 client credentials flow
  authorizationCode?: OpenAPI_OAuthFlow; // OAuth 2.0 authorization code flow
}

export interface OpenAPI_OAuthFlow {
  authorizationUrl?: string; // Authorization URL
  tokenUrl?: string; // Token URL
  refreshUrl?: string; // Refresh URL
  scopes: {
    [scope: string]: string; // Scopes and their descriptions
  };
}

export interface OpenAPI_SecurityRequirement {
  [securitySchemeName: string]: string[]; // Security scheme and its required scopes
}

export interface OpenAPI_Tag {
  name: string; // Name of the tag
  description?: string; // Description of the tag
  externalDocs?: OpenAPI_ExternalDocumentation; // External documentation for the tag
}

export interface OpenAPI_ExternalDocumentation {
  description?: string; // Description of the external documentation
  url: string; // URL of the external documentation
}

export interface OpenAPI_Callback {
  [callbackName: string]: OpenAPI_PathItem; // Callbacks for the API
}
