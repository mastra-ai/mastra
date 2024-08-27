import {
  EventHandlerReturnType,
  IntegrationAction,
  IntegrationCredentialType,
  IntegrationErrors,
  IntegrationEvent,
  MakeWebhookURL,
} from './types';
import { ZodSchema } from 'zod';
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
  actions: Record<string, IntegrationAction<any>> = {};
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

  async getProxy(params: { referenceId: string }): Promise<any> {
    throw new IntegrationError('Proxy not implemented');
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

  attachCorePresets({ corePresets }: { corePresets: CoreIntegrationPresets }) {
    this.corePresets = corePresets;
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

  registerActions() {
    return {};
  }

  getActions() {
    return this.actions;
  }

  registerEvents<T extends Integration>(): Record<string, IntegrationEvent<T>> {
    return {};
  }

  getEvents<T extends Integration>() {
    return this.events as Record<string, IntegrationEvent<T>>;
  }

  async query(props: {
    referenceId: string;
    entityType: any;
    filters?: FilterObject;
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

    if (integrationEvent?.triggerProperties) {
      await client.send({
        name: 'workflow/run-automations',
        data: {
          trigger: integrationEvent.triggerProperties.type,
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
