import { Integration, OpenAPI, IntegrationCredentialType, IntegrationAuth } from '@kpl/core';
import { createClient, type OASClient, type NormalizeOAS } from 'fets';
import { z } from 'zod';

// @ts-ignore
import StripeLogo from './assets/stripe.png';
import { openapi } from './openapi';
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

  getApiClient = async ({ connectionId }: { connectionId: string }): Promise<OASClient<NormalizeOAS<openapi>, false>> => {
    const connection = await this.dataLayer?.getConnection({ name: this.name, connectionId });

    if (!connection) {
      throw new Error(`Connection not found for connectionId: ${connectionId}`);
    }

    const credential = await this.dataLayer?.getCredentialsByConnection(connection.id);
    const value = credential?.value as Record<string, string>;

    const client = createClient<NormalizeOAS<openapi>>({
      endpoint: `https://api.stripe.com/`,
      globalParams: {
        headers: {
          Authorization: `Basic ${btoa(`${value?.['API_KEY']}`)}`,
        },
      },
    });

    return client
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
