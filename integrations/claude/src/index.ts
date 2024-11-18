import { Integration, IntegrationCredentialType, IntegrationAuth } from '@mastra/core';
import { z } from 'zod';

// @ts-ignore
import ClaudeLogo from './assets/claude.png';
import { comments } from './client/service-comments';
import * as integrationClient from './client/services.gen';
import * as zodSchema from './client/zodSchema';

export class ClaudeIntegration extends Integration {
  categories = ['ai', 'communications'];
  description = 'Claude is a next generation AI assistant built for work and trained to be safe, accurate, and secure.';

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

  getClientZodSchema() {
    return zodSchema;
  }

  getCommentsForClientApis() {
    return comments;
  }

  getBaseClient() {
    integrationClient.client.setConfig({
      baseUrl: `https://api.anthropic.com/v1`,
    });
    return integrationClient;
  }

  getApiClient = async ({ connectionId }: { connectionId: string }) => {
    const connection = await this.dataLayer?.getConnection({ name: this.name, connectionId });

    if (!connection) {
      throw new Error(`Connection not found for connectionId: ${connectionId}`);
    }
    const credential = await this.dataLayer?.getCredentialsByConnection(connection.id);
    const value = credential?.value as Record<string, any>;

    const baseClient = this.getBaseClient();

    baseClient.client.interceptors.request.use((request, options) => {
      request.headers.set('x-api-key', value?.['ANTHROPIC_API_KEY']);
      return request;
    });

    return integrationClient;
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
