import { Integration, OpenAPI, IntegrationCredentialType, IntegrationAuth } from '@kpl/core';
import { z } from 'zod';

import * as stripeClient from './client/services.gen'

// @ts-ignore
import StripeLogo from './assets/stripe.png';
import { components } from './openapi-components';
import { paths } from './openapi-paths';
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

    stripeClient.client.setConfig({
      baseUrl: 'https://api.stripe.com',
    });

    stripeClient.client.interceptors.request.use((request, options) => {
      request.headers.set('Authorization', `Basic ${btoa(`${value?.['API_KEY']}`)}`);
      return request;
    });

    return stripeClient
  };

  registerEvents() {
    this.events = {
      'stripe.price/sync': {
        schema: z.object({}),
        handler: priceSync
      },
    }
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
