import { Connection, Integration, OAuthToken, IntegrationAuth } from '@kpl/core';
import * as sdk from '@mailchimp/mailchimp_marketing';
import { z } from 'zod';

//@ts-ignore
import mailChimpIcon from './assets/mailchimp.svg';
import { resolveMailchimpServerPrefix } from './connect';
import { MAILCHIMP_FIELDS, MAILCHIMP_HOST } from './constants';
import { mailchimpSync } from './events/sync';

type MailchimpConfig = {
  CLIENT_ID: string;
  CLIENT_SECRET: string;
  SCOPES: string[];
  [key: string]: any;
};

export class MailchimpIntegration extends Integration {
  config: MailchimpConfig;

  entityTypes = { CONTACTS: 'CONTACTS' };
  availableScopes = [];

  constructor({ config }: { config: MailchimpConfig }) {
    config.authType = `OAUTH`;

    super({
      ...config,
      name: 'MAILCHIMP',
      logoUrl: mailChimpIcon,
    });

    this.config = config;
  }

  async getApiClient({ connectionId }: { connectionId: string }): Promise<typeof sdk> {
    const dataInt = await this.dataLayer?.getConnection({
      connectionId,
      name: this.name,
    });

    if (!dataInt) {
      throw new Error('Data Integration not found');
    }

    const credential = await this.dataLayer?.getCredentialsByConnection(dataInt.id);

    const token = credential?.value as OAuthToken;

    sdk.setConfig({
      accessToken: token.accessToken,
      server: token.serverPrefix,
    });

    return sdk;
  }

  registerEvents() {
    this.events = {
      'mailchimp/sync.table': {
        schema: z.object({
          entityId: z.string(),
          entityType: z.string(),
        }),
        handler: mailchimpSync,
      },
    };

    return this.events;
  }

  async query<T extends any>({
    connectionId,
    entityType,
    filters,
    sort,
  }: {
    connectionId: string;
    entityType: T;
    filters?: any;
    sort?: string[];
  }): Promise<any> {
    const connection = await this.dataLayer?.getConnection({ connectionId, name: this.name });

    if (!connection) {
      throw new Error('No connection found');
    }

    const recordData = await this.dataLayer?.getRecords({
      k_id: connection.id,
      entityType: entityType as string,
      filters,
      sort,
    });

    return recordData;
  }

  createEntity = async ({
    k_id,
    connectionId,
    shouldSync = true,
  }: {
    connectionId: string;
    k_id: string;
    shouldSync?: boolean;
  }) => {
    const existingEntity = await this.dataLayer?.getEntityByConnectionAndType({
      type: this.entityTypes.CONTACTS,
      k_id,
    });

    let entity;
    if (existingEntity) {
      entity = existingEntity;
    } else {
      entity = await this.dataLayer?.createEntity({
        connectionId,
        type: this.entityTypes.CONTACTS,
        k_id,
      });

      await this.dataLayer?.addPropertiesToEntity({
        entityId: entity?.id!,
        properties: MAILCHIMP_FIELDS,
      });
    }

    if (shouldSync) {
      await this.sendEvent({
        key: 'mailchimp/sync.table',
        data: {
          entityType: this.entityTypes.CONTACTS,
        },
        user: {
          connectionId,
        },
      });
    }

    return entity;
  };

  async onConnectionCreated({ connection }: { connection: Connection }) {
    const credential = await this.dataLayer?.getCredentialsByConnection(connection.id);
    const token = credential?.value as OAuthToken;
    const serverPrefix = await resolveMailchimpServerPrefix({ token });

    await this.dataLayer?.updateConnectionCredential({
      k_id: connection.id,
      token: {
        ...token,
        serverPrefix,
      },
    });

    return this.createEntity({
      k_id: connection.id,
      connectionId: connection.connectionId,
    });
  }

  async onDisconnect() {
    return;
  }

  getAuthenticator() {
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
        REDIRECT_URI: this.config.REDIRECT_URI || this.corePresets.redirectURI,
        SERVER: MAILCHIMP_HOST,
        AUTHORIZATION_ENDPOINT: '/oauth2/authorize',
        TOKEN_ENDPOINT: '/oauth2/token',
        SCOPES: this.config.SCOPES,
        AUTHENTICATION_METHOD: 'client_secret_post',
      },
    });
  }
}
