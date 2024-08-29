import {
  EventHandlerReturnType,
  IntegrationApi,
  IntegrationCredentialType,
  IntegrationErrors,
  IntegrationEvent,
  MakeWebhookURL,
  OpenAPI,
} from './types';
import { z, ZodSchema } from 'zod';
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
    const openApiSpec = this.getOpenApiSpec()

    if (openApiSpec) {
      const apiGets = Object.entries(openApiSpec?.paths).reduce((memo, [path, methods]) => {
        const get = (methods as any).get
        if (get) {
          console.log(methods.get?.parameters)
          const getOperationId = get.operationId
          memo[getOperationId] = {
            integrationName: this.name,
            type: getOperationId,
            icon: {
              alt: this.name,
              icon: this.logoUrl,
            },
            displayName: getOperationId,
            label: getOperationId,
            description: "Suh",
            executor: async ({ data, ctx: { referenceId } }) => {
              const client = await this.getApiClient({ referenceId })
              return client[path].get()
            },
            schema: z.object({}),
          } as IntegrationApi
        }
        return memo
      }, {} as Record<string, IntegrationApi>)

      const apiPosts = Object.entries(openApiSpec?.paths).reduce((memo, [path, methods]) => {
        const post = (methods as any).post;

        if (post) {
          const operationId = post.operationId
          memo[operationId] = {
            integrationName: this.name,
            type: operationId,
            displayName: operationId,
            label: operationId,
            icon: {
              alt: this.name,
              icon: this.logoUrl,
            },
            description: "Suh",
            executor: async ({ data, ctx: { referenceId } }) => {
              const client = await this.getApiClient({ referenceId })
              return client[path].get()
            },
            schema: z.object({}),
          } as IntegrationApi
        }

        return memo
      }, {} as Record<string, IntegrationApi>)

      this.apis = {
        ...this.apis,
        ...apiGets,
        ...apiPosts
      }
    }
  }

  async getApi({ referenceId }: { referenceId: string }): Promise<any> {
    return {
      client: await this.getApiClient({ referenceId })
    }
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
    return
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

    const integrationEvent = this.events[key];

    if (integrationEvent) {
      await client.send({
        name: 'workflow/run-automations',
        data: {
          trigger: key,
          payload: data,
        },
        user: user as any,
      });
    }

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
