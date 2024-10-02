import { Integration, OpenAPI, IntegrationCredentialType, IntegrationAuth } from '@mastra/core';
import { createClient, type NormalizeOAS } from 'fets';
import { z } from 'zod';

// @ts-ignore
import TwilioLogo from './assets/twilio.svg';
import { openapi } from './openapi';
import { paths, components } from './openapi-def';

export class TwilioIntegration extends Integration {
  constructor() {
    super({
      authType: IntegrationCredentialType.API_KEY,
      name: 'TWILIO',
      logoUrl: TwilioLogo,
      authConnectionOptions: z.object({
        ACCOUNT_SID: z.string(),
        AUTH_TOKEN: z.string(),
      }),
    });
  }

  getOpenApiSpec() {
    return { paths, components } as unknown as OpenAPI;
  }

  getApiClient = async ({ connectionId }: { connectionId: string }) => {
    const connection = await this.dataLayer?.getConnection({ name: this.name, connectionId });

    if (!connection) {
      throw new Error(`Connection not found for connectionId: ${connectionId}`);
    }

    const credential = await this.dataLayer?.getCredentialsByConnection(connection.id);
    const value = credential?.value as Record<string, string>;

    const client = createClient<NormalizeOAS<openapi>>({
      endpoint: 'https://api.twilio.com',
      globalParams: {
        headers: {
          Authorization: `Basic ${btoa(`${value?.['ACCOUNT_SID']}:${value?.['AUTH_TOKEN']}`)}`,
        },
      },
    });

    return client;
  };

  registerEvents() {
    this.events = {};
    return this.events;
  }

  getAuthenticator() {
    return new IntegrationAuth({
      dataAccess: this.dataLayer!,
      // @ts-ignore
      onConnectionCreated: () => {
        // TODO
      },
      config: {
        INTEGRATION_NAME: this.name,
        AUTH_TYPE: this.config.authType,
      },
    });
  }
}
