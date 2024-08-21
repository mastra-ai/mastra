import {
  AuthToken,
  EventHandler,
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
import { client } from './next/inngest';
import { Connection } from '@prisma-app/client';

export type IntegrationConfig = {
  name: string;
  logoUrl: string;
  scopes?: string[];
  authType?: IntegrationCredentialType;
  authConnectionOptions?: ZodSchema;
  [key: string]: any;
};

export class Integration {
  name: string;
  logoUrl: string;
  dataLayer?: DataLayer;
  config: Omit<IntegrationConfig, 'name' | 'logoUrl'> & { [key: string]: any } =
    {};
  events: Record<string, IntegrationEvent> = {};
  actions: Record<string, IntegrationAction<any>> = {};
  entityTypes: Record<string, string> = {};

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

  getAuthenticator(): IntegrationAuth {
    throw new IntegrationError('Authenticator not implemented');
  }

  attachDataLayer({ dataLayer }: { dataLayer: DataLayer }) {
    this.dataLayer = dataLayer;
  }

  getEventHandlers({
    makeWebhookUrl,
  }: {
    makeWebhookUrl: MakeWebhookURL;
  }): any[] {
    return [];
  }

  defineActions() {}

  getActions() {
    return this.actions;
  }

  defineEvents() {}

  getEvents() {
    return this.events;
  }

  async query(props: { referenceId: string; entityType: any }): Promise<any> {
    throw new IntegrationError('Query method not implemented');
  }

  getEvent(name: string) {
    const event = this.events[name];

    if (!event) {
      throw new Error(`No event exists for this name: ${name}`);
    }
    return event;
  }

  getEventKey(name: string) {
    return this.getEvent(name).key;
  }

  async processWebhookRequest({
    event,
    reqBody,
    connectionsBySubscriptionId,
  }: {
    reqBody: any;
    event: string;
    connectionsBySubscriptionId: (
      subscriptionId: string
    ) => Promise<Connection[]>;
  }) {
    throw new Error('Not implemented');
  }

  async sendEvent({
    name,
    data,
    user,
  }: {
    name: string;
    data: Record<string, any>;
    user?: {
      referenceId: string;
      [key: string]: any;
    };
  }) {
    const event = await client.send({
      name: name as any,
      data: data as any,
      user: user as any,
    });

    const integrationEvent = Object.values(this.events).find(
      (e) => e.key === name
    );

    if (integrationEvent?.triggerProperties) {
      await client.send({
        name: 'workflow/run-workflows',
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
