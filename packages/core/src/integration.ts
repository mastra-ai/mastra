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
  categories: string[] = [];
  description: string = '';
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

  getClientZodSchema(): any {
    throw new IntegrationError('Client Zod Schema not implemented');
  }

  getBaseClient(): any {
    throw new IntegrationError('Base Client not implemented');
  }

  async getApiClient(params: { connectionId: string }): Promise<any> {
    throw new IntegrationError('API not implemented');
  }

  async getApi({ connectionId }: { connectionId: string }): Promise<any> {
    return {
      client: await this.getApiClient({ connectionId }),
    };
  }

  _convertApiClientToSystemApis = async () => {
    const client = this.getBaseClient();

    const apis = Object.entries(client).reduce((acc, [key, value]) => {
      if (typeof value === 'function') {
        const camelCasedKey = key.replace(/_([a-z])/g, (match, letter) =>
          letter.toUpperCase()
        );
        const schemaKey = `${camelCasedKey}DataSchema`;
        const clientSchema = this.getClientZodSchema();
        const schema = clientSchema[schemaKey];

        if (!schema) {
          console.log(`No schema found for ${schemaKey}`);
          return acc;
        }

        const api = {
          integrationName: this.name,
          type: key,
          icon: {
            alt: this.name,
            icon: this.logoUrl,
          },
          displayName: camelCasedKey,
          label: camelCasedKey,
          schema,
          executor: async ({ data, ctx: { connectionId } }) => {
            const client = await this.getApiClient({ connectionId });
            const value = client[key as keyof typeof client];
            return (value as any)({
              ...data,
            });
          },
          description: `Integration with ${this.name}`,
        } as IntegrationApi;

        return { ...acc, [key]: api };
      } else {
        return acc;
      }
    }, {});

    this.apis = apis;
  };

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

  async triggerEvent<T = Record<string, any>>({
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

  async test({
    connectionId,
  }: {
    connectionId: string;
  }): Promise<string | null> {
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

  async onDisconnect({
    connectionId,
  }: {
    connectionId: string;
  }): Promise<any> {}
}
