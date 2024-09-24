import {
  EventHandlerReturnType,
  IntegrationApi,
  IntegrationCredentialType,
  IntegrationErrors,
  IntegrationEvent,
  MakeWebhookURL,
  OpenAPI,
  OpenAPI_Components,
  OpenAPI_Header,
  OpenAPI_Link,
  OpenAPI_Parameter,
  OpenAPI_PathItem,
  OpenAPI_RequestBody,
  OpenAPI_Response,
  OpenAPI_Schema,
  OpenAPI_SecurityScheme,
} from './types';
import { z, ZodObject, ZodSchema, ZodTypeAny } from 'zod';
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
  availableScopes?: { key: string; description: string }[];
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

  async getApiClient(params: { connectionId: string }): Promise<any> {
    throw new IntegrationError('API not implemented');
  }

  _convertApiClientToSystemApis() {
    const openApiSpec = this.getOpenApiSpec();

    if (!openApiSpec || !openApiSpec.components) {
      console.log(
        `OpenAPI spec or components/schemas for ${this.name} are missing`
      );
      return;
    }

    const { components } = openApiSpec;

    /**
     * Resolves a $ref and returns the referenced schema, resolving recursively if necessary.
     */
    const resolveRef = (
      ref: string,
      components: OpenAPI_Components
    ): OpenAPI_Schema | undefined => {
      const [_, __, type, name] = ref.split('/');
      const referencedSchema =
        components[type as keyof OpenAPI_Components]?.[name];

      if (!referencedSchema) {
        console.log(`Schema not found for reference: ${ref}`);
        return undefined;
      }

      // If the referenced schema contains a $ref, resolve it recursively
      if ((referencedSchema as OpenAPI_Schema)?.$ref) {
        return resolveRef(
          (referencedSchema as OpenAPI_Schema).$ref!,
          components
        );
      }

      return referencedSchema as OpenAPI_Schema;
    };

    /**
     * Merges multiple Zod schemas.
     */
    const mergeSchemas = (schemas: ZodTypeAny[]): ZodTypeAny => {
      return (schemas as unknown as ZodObject<any>[]).reduce(
        (acc, schema) => acc.extend(schema.shape),
        z.object({})
      );
    };

    /**
     * Converts an OpenAPI schema object into a Zod schema.
     * This function only takes a SchemaObject and handles any $ref internally.
     */
    const convertSchema = ({
      components,
      schema,
      example,
    }: {
      components: OpenAPI_Components;
      schema?: OpenAPI_Schema;
      example?: string | string[];
    }): ZodTypeAny => {
      if (!schema) {
        return z.any();
      }

      // Check if the schema is a $ref and resolve it
      if (schema?.$ref) {
        const resolvedSchema = resolveRef(schema.$ref, components);
        return convertSchema({
          schema: resolvedSchema as OpenAPI_Schema,
          components,
        });
      }

      // Handle `allOf` by merging all subschemas
      if (schema?.allOf) {
        const subschemas = schema.allOf.map((subschema) =>
          convertSchema({
            schema: subschema,
            components,
          })
        );
        return mergeSchemas(subschemas);
      }

      // Convert schema based on its type
      switch (schema?.type) {
        case 'string':
          return z.string();
        case 'number':
          return z.number();
        case 'integer':
          return z.number().int();
        case 'boolean':
          return z.boolean();
        case 'array':
          if (schema?.items?.type === 'string' && example) {
            return z.enum(example as [string, ...string[]]);
          }
          return z.array(
            convertSchema({
              schema: schema.items,
              components,
            })
          );
        case 'object':
          if (schema.properties?.data) {
            return convertSchema({
              schema: schema.properties.data,
              components,
            });
          }

          const shape: Record<string, ZodTypeAny> = {};
          const requiredFields = schema.required || [];

          if (schema.properties) {
            for (const key in schema?.properties) {
              const zodSchema = convertSchema({
                schema: schema.properties[key],
                components,
              });

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
    ): {
      schema: ZodTypeAny;
      paramToLocationMap: Record<string, OpenAPI_Parameter['in']>;
    } => {
      if (!parameters?.length) {
        return { paramToLocationMap: {}, schema: z.object({}) };
      }
      const shape: Record<string, ZodTypeAny> = {};
      let paramToLocationMap: Record<string, OpenAPI_Parameter['in']> = {};

      parameters.forEach((param) => {
        if (param.schema) {
          paramToLocationMap[param.name] = param?.in;
          shape[param.name] = convertSchema({
            components,
            schema: param.schema,
          });
        } else if (param?.$ref) {
          const resolvedSchema = resolveRef(
            param.$ref,
            components
          ) as OpenAPI_Parameter;

          paramToLocationMap[resolvedSchema?.name] = resolvedSchema?.in;
          shape[resolvedSchema?.name] = convertSchema({
            schema: resolvedSchema?.schema,
            components,
            example: resolvedSchema?.example || resolvedSchema?.enum,
          });
        }
      });
      return { paramToLocationMap, schema: z.object(shape) };
    };

    const getRequestBodySchema = (
      requestBody: OpenAPI_RequestBody
    ): { schema: ZodTypeAny; reqBodyKey?: 'json' | 'formUrlEncoded' } => {
      const contentJsonSchema =
        requestBody?.content?.['application/json']?.schema;
      const contentUrlFormEncodedSchema =
        requestBody?.content?.['application/x-www-form-urlencoded']?.schema;

      const reqBodySchema = contentJsonSchema
        ? convertSchema({ components, schema: contentJsonSchema })
        : contentUrlFormEncodedSchema
        ? convertSchema({ components, schema: contentUrlFormEncodedSchema })
        : z.object({});

      return {
        schema: reqBodySchema,
        reqBodyKey: contentJsonSchema
          ? 'json'
          : contentUrlFormEncodedSchema
          ? 'formUrlEncoded'
          : undefined,
      };
    };

    if (openApiSpec) {
      const apiGets = Object.entries(openApiSpec.paths).reduce(
        (memo, [path, methods]) => {
          const get = methods?.get;
          const topLevelParameters = methods?.parameters;
          if (get) {
            const operationId = get?.operationId!;
            const parameterSchema = getParametersSchema(get.parameters);
            const topLevelParametersSchema =
              getParametersSchema(topLevelParameters);
            const mergedParametersSchema = mergeSchemas([
              parameterSchema?.schema,
              topLevelParametersSchema?.schema,
            ]);
            const paramsLocationMap = {
              ...topLevelParametersSchema?.paramToLocationMap,
              ...parameterSchema?.paramToLocationMap,
            };

            memo[operationId] = {
              integrationName: this.name,
              type: operationId,
              icon: {
                alt: this.name,
                icon: this.logoUrl,
              },
              displayName: operationId,
              label: operationId,
              description: get?.summary || get?.description || '',
              executor: async ({ data, ctx: { connectionId } }) => {
                const client = await this.getApiClient({ connectionId });
                const query: any = {};
                const params: any = {};
                const headers: any = {};

                for (const [k, v] of Object.entries(data as Object)) {
                  if (paramsLocationMap[k] === 'query') {
                    query[k] = v;
                  } else if (paramsLocationMap[k] === 'path') {
                    params[k] = v;
                  } else if (paramsLocationMap[k] === 'header') {
                    headers[k] = v;
                  }
                }
                return client[path].get({
                  query,
                  params,
                  headers,
                });
              },
              schema: mergedParametersSchema,
            } as IntegrationApi;
          }
          return memo;
        },
        {} as Record<string, IntegrationApi>
      );

      const apiPosts = Object.entries(openApiSpec.paths).reduce(
        (memo, [path, methods]) => {
          const post = methods.post;
          const topLevelParameters = methods?.parameters;
          if (post) {
            const operationId = post?.operationId!;

            const { schema: reqBodySchema, reqBodyKey } = getRequestBodySchema(
              post.requestBody as OpenAPI_RequestBody
            );

            const parameterSchema = getParametersSchema(post.parameters);
            const topLevelParametersSchema =
              getParametersSchema(topLevelParameters);
            const mergedSchema = mergeSchemas([
              parameterSchema?.schema,
              topLevelParametersSchema?.schema,
              reqBodySchema,
            ]);

            const paramsLocationMap = {
              ...topLevelParametersSchema?.paramToLocationMap,
              ...parameterSchema?.paramToLocationMap,
            };

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
              executor: async ({ data, ctx: { connectionId } }) => {
                const client = await this.getApiClient({ connectionId });
                let query = {};
                let params = {};
                let body = {};
                let headers = {};

                for (const [k, v] of Object.entries(data as Object)) {
                  if (paramsLocationMap[k] === 'query') {
                    query = { ...query, [k]: v };
                  } else if (paramsLocationMap[k] === 'path') {
                    params = { ...params, [k]: v };
                  } else if (paramsLocationMap[k] === 'header') {
                    headers = { ...headers, [k]: v };
                  } else {
                    body = { ...body, [k]: v };
                  }
                }

                return client[path].post({
                  [reqBodyKey!]: body,
                  query,
                  params,
                  headers,
                });
              },
              schema: mergedSchema,
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

  async getApi({ connectionId }: { connectionId: string }): Promise<any> {
    return {
      client: await this.getApiClient({ connectionId }),
    };
  }

  getAuthenticator(): IntegrationAuth {
    throw new IntegrationError('Authenticator not implemented');
  }

  makeClient = async (params: { connectionId: string }): Promise<T> => {
    throw new IntegrationError('Client not implemented');
  };

  attachDataLayer({ dataLayer }: { dataLayer: DataLayer }) {
    this.dataLayer = dataLayer;
  }

  getEventHandlers = ({
    makeWebhookUrl,
  }: {
    makeWebhookUrl: MakeWebhookURL;
  }): EventHandlerReturnType[] => {
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
  };

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
    connectionId: string;
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
      connectionId: string;
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

  async test({ connectionId }: { connectionId: string }): Promise<string | null> {
    const connection = await this.dataLayer?.getConnection({
      connectionId,
      name: this.name,
    });

    try {
      const authenticator = this.getAuthenticator();
      const bearer = await authenticator.getAuthToken({
        k_id: connection?.id!,
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

  async onConnectionCreated({
    connection,
  }: {
    connection: Connection;
  }): Promise<any> {}

  async onDisconnect({ connectionId }: { connectionId: string }): Promise<any> {}
}
