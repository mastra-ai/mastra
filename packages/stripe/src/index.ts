//@ts-no-check
import { Integration, IntegrationCredentialType, IntegrationAuth, IntegrationApi, EventHandler } from '@kpl/core';
import { z } from 'zod';

// @ts-ignore
import StripeLogo from './assets/stripe.png';
import * as stripeClient from './client/services.gen';
import * as zodSchema from './client/zodSchema';
// import { priceSync } from './events/price';
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

    return baseClient;
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
    const client = this.getBaseClient();
    const schema = this.getClientZodSchema();

    Object.keys(client).filter((k) => k !== 'client').forEach((key) => {
      if (key && key.startsWith('get')) {
        const apiKey = key as Exclude<keyof typeof client, 'client'>;

        console.log(apiKey)

        const entityKey = key.replace('get', '').toLowerCase();

        const schemaKey = `${key}DataSchema` as keyof typeof schema;
        const responseSchemaKey = `${key}ResponseSchema` as keyof typeof schema;

        const inputSchema = (schema?.[schemaKey] ?? z.object({}))
        const responseSchema = (schema?.[responseSchemaKey] ?? z.object({}))

        const handler: EventHandler<StripeIntegration> = ({
          eventKey,
          integrationInstance: { name, getApiClient },
        }) => ({
          id: `${name}-sync-${entityKey}`,
          event: eventKey,
          executor: async ({ event }) => {
            const { connectionId } = event.user;

            const options: Record<string, any> = {}

            if (inputSchema && inputSchema instanceof z.ZodObject) {
              Object.keys(inputSchema._def.shape()).forEach((k) => {
                options[k] = event?.data?.[k]
              })
            }

            // const api = await getApiClient({ connectionId });

            // const result = await api[apiKey](options as any);

            let dataKey

            if (responseSchema && responseSchema instanceof z.ZodLazy) {
              const obj = responseSchema._def.getter()

              if (obj instanceof z.ZodObject) {
                const shape = obj._def.shape()

                Object.entries(shape).forEach(([k, v]) => {
                  if (v instanceof z.ZodArray) {
                    console.log(v)
                    dataKey = k
                  }
                })
              }
            }

            console.log(dataKey, connectionId)

            // if (dataKey) {
            //   const records = (result?.[dataKey] as Record<string, any>[])?.map((d: any) => {
            //     return {
            //       externalId: d.id,
            //       data: d,
            //       entityType: entityKey.toUpperCase(),
            //     };
            //   })

            //   await dataLayer?.syncData({
            //     name,
            //     connectionId,
            //     data: records,
            //     properties: [],
            //     type: entityKey.toUpperCase(),
            //     lastSyncId: event?.id!,
            //   });
            // }
          },
        });

        this.events[`stripe.${entityKey}/sync`] = {
          schema: inputSchema,
          handler,
        }
      }
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
