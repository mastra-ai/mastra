import { Integration, IntegrationCredentialType, IntegrationAuth, generateSyncs } from '@kpl/core';
import { z } from 'zod';

// @ts-ignore
import StripeLogo from './assets/stripe.png';
import { comments } from './client/service-comments';
import * as integrationClient from './client/services.gen';
import * as zodSchema from './client/zodSchema';

export class StripeIntegration extends Integration {
  categories = ['payments'];
  description = 'Stripe is a technology company that builds economic infrastructure for the internet.';

  constructor() {
    super({
      authType: IntegrationCredentialType.API_KEY,
      name: 'STRIPE',
      logoUrl: StripeLogo,
      authConnectionOptions: z.object({
        API_KEY: z.string(),
      }),
    });
  }

  getClientZodSchema() {
    return zodSchema;
  }

  getCommentsForClientApis() {
    return comments;
  }

  getBaseClient() {
    integrationClient.client.setConfig({
      baseUrl: 'https://api.stripe.com',
    });
    return integrationClient;
  }

  getApiClient = async ({ connectionId }: { connectionId: string }) => {
    const connection = await this.dataLayer?.getConnection({ name: this.name, connectionId });

    if (!connection) {
      throw new Error(`Connection not found for connectionId: ${connectionId}`);
    }

    const credential = await this.dataLayer?.getCredentialsByConnection(connection.id);
    const value = credential?.value as Record<string, string>;

    const baseClient = this.getBaseClient();

    baseClient.client.interceptors.request.use((request, options) => {
      request.headers.set('Authorization', `Basic ${btoa(`${value?.['API_KEY']}`)}`);
      return request;
    });

    return integrationClient;
  };

  registerEvents() {
    const client = this.getBaseClient();
    const schema = this.getClientZodSchema();
    
    this.events = generateSyncs({
      client,
      schema,
      idKey: 'id',
      listDataKey: 'data',
      name: this.name.toLowerCase(),
    })

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
