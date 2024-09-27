import { Integration, IntegrationCredentialType, IntegrationAuth } from '@kpl/core';
import { z } from 'zod';

// @ts-ignore
import StripeLogo from './assets/stripe.png';
import * as stripeClient from './client/services.gen';
import * as zodSchema from './client/zodSchema';
import { priceSync } from './events/price';

export class StripeIntegration extends Integration {
  entityTypes = { PRICE: 'PRICE' };
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

  getBaseClient() {
    stripeClient.client.setConfig({
      baseUrl: 'https://api.stripe.com',
    });
    return stripeClient;
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

    return stripeClient;
  };

  registerEvents() {
    this.events = {
      'stripe.price/sync': {
        schema: z.object({}),
        handler: priceSync,
      },
    };
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
