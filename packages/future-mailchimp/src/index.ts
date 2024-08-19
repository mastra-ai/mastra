import { Connection, Integration, OAuthToken, IntegrationAuth } from 'core';
import { z } from 'zod';

import { resolveMailchimpServerPrefix } from './connect';
import { MAILCHIMP_FIELDS, MAILCHIMP_HOST } from './constants';
import { mailchimpSync } from './events/sync';

type MailchimpConfig = {
  CLIENT_ID: string;
  CLIENT_SECRET: string;
  REDIRECT_URI: string;
  [key: string]: any;
};

export class MailchimpIntegration extends Integration {
  config: MailchimpConfig;

  constructor({ config }: { config: MailchimpConfig }) {
    config.authType = `OAUTH`;

    super({
      ...config,
      name: 'MAILCHIMP',
      logoUrl: '/images/integrations/mailchimp.svg',
    });

    this.config = config;
  }

  defineEvents() {
    this.events = {
      SYNC: {
        key: 'mailchimp/sync.table',
        schema: z.object({
          syncTableId: z.string(),
        }),
      },
    };

    return this.events;
  }

  getEventHandlers() {
    return [
      mailchimpSync({
        name: this.name,
        event: this.getEventKey('SYNC'),
        dataLayer: this.dataLayer!,
      }),
    ];
  }

  createEntity = async ({
    referenceId,
    connectionId,
    shouldSync = true,
  }: {
    connectionId: string;
    referenceId: string;
    shouldSync?: boolean;
  }) => {
    const existingEntity = await this.dataLayer?.getEntityByConnectionAndType({
      type: 'CONTACTS',
      connectionId,
    });

    let entity;
    if (existingEntity) {
      entity = existingEntity;
    } else {
      entity = await this.dataLayer?.createEntity({
        connectionId,
        type: 'CONTACTS',
        referenceId,
      });

      await this.dataLayer?.addPropertiesToEntity({
        entityId: entity?.id!,
        properties: MAILCHIMP_FIELDS,
      });
    }

    if (shouldSync) {
      const event = await this.sendEvent({
        name: this.getEventKey('SYNC'),
        data: {
          syncTableId: entity?.id,
        },
        user: {
          referenceId,
        },
      });
      await this.dataLayer?.updateEntityLastSyncId({
        entityId: entity?.id!,
        syncId: event.ids[0],
      });
    }

    return entity;
  };

  async onConnectionCreated({ connection }: { connection: Connection }) {
    const credential = await this.dataLayer?.getCredentialsByConnectionId(connection.id);
    const token = credential?.value as OAuthToken;
    const serverPrefix = await resolveMailchimpServerPrefix({ token });

    await this.dataLayer?.updateConnectionCredential({
      connectionId: connection.id,
      token: {
        ...token,
        serverPrefix,
      },
    });

    return this.createEntity({
      connectionId: connection.id,
      referenceId: connection.referenceId,
    });
  }

  async onDisconnect() {
    return;
  }

  getAuthenticator() {
    console.log(this.config);
    return new IntegrationAuth({
      dataAccess: this.dataLayer!,
      onConnectionCreated: connection => {
        return this.onConnectionCreated({ connection });
      },
      config: {
        INTEGRATION_NAME: this.name,
        AUTH_TYPE: this.config.authType,
        CLIENT_ID: this.config.CLIENT_ID,
        CLIENT_SECRET: this.config.CLIENT_SECRET,
        REDIRECT_URI: this.config.REDIRECT_URI,
        SERVER: MAILCHIMP_HOST,
        AUTHORIZATION_ENDPOINT: '/oauth2/authorize',
        TOKEN_ENDPOINT: '/oauth2/token',
        SCOPES: [],
        AUTHENTICATION_METHOD: 'client_secret_post',
      },
    });
  }
}
