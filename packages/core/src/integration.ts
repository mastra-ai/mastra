import {
  EventHandlerReturnType,
  IntegrationApi,
  IntegrationCredentialType,
  IntegrationErrors,
  IntegrationEvent,
  MakeWebhookURL,
  OpenAPI,
  OpenAPI_Parameter,
  OpenAPI_Schema,
} from './types';
import { z, ZodSchema, ZodTypeAny } from 'zod';
import { IntegrationError } from './utils/errors';
import { DataLayer } from './data-access';
import { IntegrationAuth } from './authenticator';
import { client } from './utils/inngest';
import { Connection } from '@prisma-app/client';
import { FilterObject } from './lib';

export type IntegrationConfig = {
  name: string;
  logoUrl: string;
  scopes?: string[];
  authType?: IntegrationCredentialType;
  authConnectionOptions?: ZodSchema;
  [key: string]: any;
};

export type CoreIntegrationPresets = {
  redirectURI: string;
};

/**
 * @params T - The type of the client that the integration provides
 */
export class Integration<T = unknown> {
  name: string;
  logoUrl: string;
  dataLayer?: DataLayer;
  config: Omit<IntegrationConfig, 'name' | 'logoUrl'> & { [key: string]: any } =
    {};
  events: Record<string, IntegrationEvent<any>> = {};
  apis: Record<string, IntegrationApi<any>> = {};
  entityTypes: Record<string, string> = {};
  corePresets: CoreIntegrationPresets = {
    redirectURI: '',
  };

  constructor(config: IntegrationConfig) {
    if (!config?.name) {
      throw new IntegrationError('Integration name must be defined');
    }

    if (!config?.logoUrl) {
      throw new IntegrationError('Integration logoUrl must be defined');
    }

    const { name, logoUrl, ...others } = config;
    this.name = name;
    this.logoUrl = logoUrl;
    this.config = others;
  }

  getConfig() {
    return this.config;
  }

  async getApiClient(params: { referenceId: string }): Promise<any> {
    throw new IntegrationError('API not implemented');
  }

  _convertApiClientToSystemApis() {
    const openApiSpec = this.getOpenApiSpec();

    if (
      !openApiSpec ||
      !openApiSpec.components ||
      !openApiSpec.components.schemas
    ) {
      console.log(
        `OpenAPI spec or components/schemas for ${this.name} are missing`
      );
      return;
    }

    const { schemas } = openApiSpec.components;

    /**
     * Resolves a $ref and returns the referenced schema.
     */
    const resolveRef = (
      ref: string,
      components: Record<string, OpenAPI_Schema>
    ): OpenAPI_Schema => {
      const refPath = ref.replace('#/components/schemas/', '');
      const referencedSchema = components[refPath];
      if (!referencedSchema) {
        throw new Error(`Schema not found for reference: ${ref}`);
      }
      return referencedSchema;
    };

    /**
     * Merges multiple Zod schemas.
     */
    const mergeSchemas = (schemas: ZodTypeAny[]): ZodTypeAny => {
      return schemas.reduce((mergedSchema, currentSchema) => {
        return mergedSchema.and(currentSchema);
      }, z.object({}));
    };

    /**
     * Converts an OpenAPI schema object into a Zod schema.
     * This function only takes a SchemaObject and handles any $ref internally.
     */
    const convertSchema = (
      schema: OpenAPI_Schema,
      components: Record<string, OpenAPI_Schema>
    ): ZodTypeAny => {
      // Check if the schema is a $ref and resolve it

      if (schema?.$ref) {
        const resolvedSchema = resolveRef(schema.$ref, components);
        return convertSchema(resolvedSchema, components);
      }

      // Handle `allOf` by merging all subschemas
      if (schema.allOf) {
        const subschemas = schema.allOf.map((subschema) =>
          convertSchema(subschema as OpenAPI_Schema, components)
        );
        return mergeSchemas(subschemas);
      }

      // Convert schema based on its type
      switch (schema.type) {
        case 'string':
          return z.string();
        case 'number':
          return z.number();
        case 'integer':
          return z.number().int();
        case 'boolean':
          return z.boolean();
        case 'array':
          return z.array(
            convertSchema(schema.items as OpenAPI_Schema, components)
          );
        case 'object':
          const shape: Record<string, ZodTypeAny> = {};
          const requiredFields = schema.required || [];

          if (schema.properties) {
            for (const key in schema.properties) {
              const zodSchema = convertSchema(
                schema.properties[key] as OpenAPI_Schema,
                components
              );
              shape[key] = requiredFields.includes(key)
                ? zodSchema
                : zodSchema.optional();
            }
          }
          return z.object(shape);
        default:
          return z.any();
      }
    };

    const getParametersSchema = (
      parameters: OpenAPI_Parameter[] = []
    ): ZodTypeAny => {
      const shape: Record<string, ZodTypeAny> = {};
      parameters.forEach((param) => {
        if (param.schema) {
          shape[param.name] = convertSchema(
            param.schema as OpenAPI_Schema,
            schemas
          );
        }
      });
      return z.object(shape);
    };

    if (openApiSpec) {
      const apiGets = Object.entries(openApiSpec.paths).reduce(
        (memo, [path, methods]) => {
          const get = methods?.get;
          if (get) {
            const getOperationId = get?.operationId!;
            const parametersSchema = getParametersSchema(
              get.parameters as OpenAPI_Parameter[]
            );

            memo[getOperationId] = {
              integrationName: this.name,
              type: getOperationId,
              icon: {
                alt: this.name,
                icon: this.logoUrl,
              },
              displayName: getOperationId,
              label: getOperationId,
              description: get?.summary || get?.description || '',
              executor: async ({ data, ctx: { referenceId } }) => {
                const client = await this.getApiClient({ referenceId });
                return client[path].get(data);
              },
              schema: parametersSchema,
            } as IntegrationApi;
          }
          return memo;
        },
        {} as Record<string, IntegrationApi>
      );

      const apiPosts = Object.entries(openApiSpec.paths).reduce(
        (memo, [path, methods]) => {
          const post = methods.post;
          if (post) {
            const operationId = post?.operationId!;

            const requestBodySchema =
              post.requestBody?.content?.['application/json']?.schema;
            const bodySchema = requestBodySchema
              ? convertSchema(requestBodySchema as OpenAPI_Schema, schemas)
              : z.object({});

            memo[operationId] = {
              integrationName: this.name,
              type: operationId,
              displayName: operationId,
              label: operationId,
              icon: {
                alt: this.name,
                icon: this.logoUrl,
              },
              description: post?.summary || post?.description || '',
              executor: async ({ data, ctx: { referenceId } }) => {
                const client = await this.getApiClient({ referenceId });
                return client[path].post(data);
              },
              schema: bodySchema,
            } as IntegrationApi;
          }

          return memo;
        },
        {} as Record<string, IntegrationApi>
      );

      this.apis = {
        ...this.apis,
        ...apiGets,
        ...apiPosts,
      };
    }
  }

  async getApi({ referenceId }: { referenceId: string }): Promise<any> {
    return {
      client: await this.getApiClient({ referenceId }),
    };
  }

  getAuthenticator(): IntegrationAuth {
    throw new IntegrationError('Authenticator not implemented');
  }

  makeClient = async (params: { referenceId: string }): Promise<T> => {
    throw new IntegrationError('Client not implemented');
  };

  attachDataLayer({ dataLayer }: { dataLayer: DataLayer }) {
    this.dataLayer = dataLayer;
  }

  getEventHandlers({
    makeWebhookUrl,
  }: {
    makeWebhookUrl: MakeWebhookURL;
  }): EventHandlerReturnType[] {
    return Object.keys(this.events)
      .map((eventKey) => {
        const eventHandler = this.events[eventKey]?.handler;
        if (!eventHandler) return null;
        return eventHandler({
          integrationInstance: this,
          eventKey,
          makeWebhookUrl,
        });
      })
      .filter(Boolean) as EventHandlerReturnType[];
  }

  getOpenApiSpec(): OpenAPI | undefined {
    return;
  }

  registerApis() {
    return {};
  }

  getApis() {
    return this.apis;
  }

  registerEvents<T extends Integration>(): Record<string, IntegrationEvent<T>> {
    return {};
  }

  getEvents<T extends Integration>() {
    return this.events as Record<string, IntegrationEvent<T>>;
  }

  async query<T extends string | number | symbol>(props: {
    referenceId: string;
    entityType: any;
    filters?: FilterObject<T>;
    sort?: string[];
  }): Promise<any> {
    return [];
  }

  getEvent(name: string) {
    const event = this.events[name];

    if (!event) {
      throw new Error(`No event exists for this name: ${name}`);
    }
    return event;
  }

  async processWebhookRequest(params: {
    reqBody: any;
    event: string;
    connectionsBySubscriptionId: (
      subscriptionId: string
    ) => Promise<Connection[]>;
  }) {
    throw new Error('Not implemented');
  }

  async sendEvent<T = Record<string, any>>({
    key,
    data,
    user,
  }: {
    key: string;
    data: T;
    user?: {
      referenceId: string;
      [key: string]: any;
    };
  }) {
    const event = await client.send({
      name: key as any,
      data: data as any,
      user: user as any,
    });

    return event;
  }

  async test({ referenceId }: { referenceId: string }): Promise<string | null> {
    const connection = await this.dataLayer?.getConnectionByReferenceId({
      referenceId,
      name: this.name,
    });

    try {
      const authenticator = this.getAuthenticator();
      const bearer = await authenticator.getAuthToken({
        connectionId: connection?.id!,
      });
      const desiredScopes = this?.config.scopes ?? [];
      if (desiredScopes.length) {
        const actualScopes = bearer.scope ?? [];
        const isMissingScopes = !desiredScopes.every((desired: string) =>
          actualScopes.includes(desired)
        );
        if (isMissingScopes) {
          return IntegrationErrors.MISSING_SCOPES;
        }
      }
    } catch (e) {
      return IntegrationErrors.BROKEN_CONNECTION;
    }

    return null;
  }
}
