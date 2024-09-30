import { Integration, IntegrationCredentialType, IntegrationAuth, generateSyncs } from '@kpl/core';
import { z } from 'zod';

// @ts-ignore
import GithubLogo from './assets/github.png';
import { comments } from './client/service-comments';
import * as integrationClient from './client/services.gen';
import * as zodSchema from './client/zodSchema';

export class GithubIntegration extends Integration {
  categories = ['dev-tools'];
  description =
    'GitHub is a development platform inspired by the way you work. From open source to business, you can host and review code, manage projects, and build software alongside millions of other developers.';

  constructor() {
    super({
      authType: IntegrationCredentialType.API_KEY,
      name: 'GITHUB',
      logoUrl: GithubLogo,
      authConnectionOptions: z.object({
        PERSONAL_ACCESS_TOKEN: z.string(),
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
      baseUrl: 'https://api.github.com',
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
      request.headers.set('Authorization', `Bearer ${value?.['PERSONAL_ACCESS_TOKEN']}`);
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
      name: this.name.toLowerCase(),
    });

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
