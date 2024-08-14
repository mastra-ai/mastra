import { DataIntegration, IntegrationPlugin, OAuthToken, IntegrationAuth } from 'core';
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

export class MailchimpIntegration extends IntegrationPlugin {
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

  createSyncTable = async ({
    integrationId,
    connectionId,
    shouldSync = true,
  }: {
    connectionId: string;
    integrationId: string;
    shouldSync?: boolean;
  }) => {
    const existingTable = await this.dataLayer?.getSyncTableByDataIdAndType({
      type: 'CONTACTS',
      dataIntegrationId: integrationId,
    });

    let tempTable;
    if (existingTable) {
      tempTable = existingTable;
    } else {
      tempTable = await this.dataLayer?.createSyncTable({
        dataIntegrationId: integrationId,
        type: 'CONTACTS',
        connectionId,
      });

      await this.dataLayer?.addFieldsToSyncTable({
        syncTableId: tempTable?.id!,
        fields: MAILCHIMP_FIELDS,
      });
    }

    if (shouldSync) {
      const event = await this.sendEvent({
        name: this.getEventKey('SYNC'),
        data: {
          syncTableId: tempTable?.id,
        },
        user: {
          connectionId,
        },
      });
      await this.dataLayer?.updateSyncTableLastSyncId({
        syncTableId: tempTable?.id!,
        syncId: event.ids[0],
      });
    }

    return tempTable;
  };

  async onDataIntegrationCreated({ integration }: { integration: DataIntegration }) {
    const credential = await this.dataLayer?.getDataIntegrationCredentialsById(integration.id);
    const token = credential?.value as OAuthToken;
    const serverPrefix = await resolveMailchimpServerPrefix({ token });

    await this.dataLayer?.updateDataIntegrationCredential({
      integrationId: integration.id,
      token: {
        ...token,
        serverPrefix,
      },
    });

    return this.createSyncTable({
      connectionId: integration.connectionId,
      integrationId: integration.id,
    });
  }

  async onDisconnect() {
    return;
  }

  getAuthenticator() {
    console.log(this.config);
    return new IntegrationAuth({
      dataAccess: this.dataLayer!,
      onDataIntegrationCreated: integration => {
        return this.onDataIntegrationCreated({ integration });
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
