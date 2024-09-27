import { Integration, OpenAPI, IntegrationCredentialType, IntegrationAuth, IntegrationApi } from '@kpl/core';
import { z } from 'zod';

// @ts-ignore
import StripeLogo from './assets/stripe.png';
import * as stripeClient from './client/services.gen';
import * as zodSchema from './client/zodSchema';
import { priceSync } from './events/price';
import { components } from './openapi-components';
import { paths } from './openapi-paths';

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

  _convertApiClientToSystemApis() {
    const client = this.getBaseClient();

    const apis = Object.entries(client).reduce((acc, [key, value]) => {
      if (typeof value === 'function') {
        const camelCasedKey = key.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
        const schemaKey = `${camelCasedKey}DataSchema` as keyof typeof zodSchema;
        const clientSchema = this.getClientZodSchema();
        const schema = clientSchema[schemaKey];

        if (!schema) {
          console.log(`No schema found for ${schemaKey}`);
          return acc
        }

        const api = {
          integrationName: this.name,
          type: key,
          icon: {
            alt: this.name,
            icon: this.logoUrl,
          },
          displayName: camelCasedKey,
          label: camelCasedKey,
          schema,
          executor: async ({ data, ctx: { connectionId } }) => {
            return (value as any)({
              ...data,
            });
          },
          description: `Integration with ${this.name}`,
        } as IntegrationApi;

        return { ...acc, [key]: api };
      } else {
        return acc;
      }
    }, {});

    this.apis = { ...apis };
  }

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
