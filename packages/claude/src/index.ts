import { Integration, OpenAPI, IntegrationCredentialType, IntegrationAuth } from '@kpl/core';
import { createClient, type OASClient, type NormalizeOAS } from 'fets';
import { z } from 'zod';

// @ts-ignore
import ClaudeLogo from './assets/claude.svg';
import { openapi } from './openapi';
import { components } from './openapi-components';
import { paths } from './openapi-paths';

export class ClaudeIntegration extends Integration {
  constructor() {
    super({
      authType: IntegrationCredentialType.API_KEY,
      name: 'CLAUDE',
      logoUrl: ClaudeLogo,
      authConnectionOptions: z.object({
        ANTHROPIC_API_KEY: z.string(),
      }),
    });
  }

  getOpenApiSpec() {
    return { paths, components } as unknown as OpenAPI;
  }

  getApiClient = async ({ connectionId }: { connectionId: string }): Promise<OASClient<NormalizeOAS<openapi>>> => {
    const connection = await this.dataLayer?.getConnection({ name: this.name, connectionId });

    if (!connection) {
      throw new Error(`Connection not found for connectionId: ${connectionId}`);
    }

    const credential = await this.dataLayer?.getCredentialsByConnection(connection.id);
    const value = credential?.value as Record<string, string>;

    const client = createClient<NormalizeOAS<openapi>>({
      endpoint: `https://api.anthropic.com/v1`,
      globalParams: {
        headers: {
          'x-api-key': value?.['ANTHROPIC_API_KEY'],
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
