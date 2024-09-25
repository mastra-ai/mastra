import { Integration, OpenAPI, IntegrationCredentialType, IntegrationAuth } from '@kpl/core';
import { createClient, type OASClient, type NormalizeOAS } from 'fets';

// @ts-ignore
import AsanaLogo from './assets/asana.svg';
import { openapi } from './openapi';
import { paths, components } from './openapi-def';
import { tasksSync } from './events/tasks';
import { z } from 'zod';

type AsanaConfig = {
  CLIENT_ID: string;
  CLIENT_SECRET: string;
  [key: string]: any;
};

export class AsanaIntegration extends Integration {
  entityType = { TASK: 'TASK' };

  constructor({ config }: { config: AsanaConfig }) {
    super({
      ...config,
      authType: IntegrationCredentialType.OAUTH,
      name: 'ASANA',
      logoUrl: AsanaLogo,
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

    const authenticator = this.getAuthenticator();
    const { accessToken } = await authenticator.getAuthToken({ k_id: connection.id });

    const client = createClient<NormalizeOAS<openapi>>({
      endpoint: 'https://app.asana.com/api/1.0',
      globalParams: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });

    // @ts-ignore
    return client;
  };

  registerEvents() {
    this.events = {
      'asana.tasks/sync': {
        schema: z.object({
          limit: z.number().optional(),
          offset: z.number().optional(),
          assignee: z.string().optional(),
          project: z.string().optional(),
          section: z.string().optional(),
          workspace: z.string().optional(),
          completed_since: z.string().optional(),
          modified_since: z.string().optional(),
        }).refine((v) => {
          if (v.assignee && !v.workspace) {
            return false
          }

          if (v.workspace && !v.assignee) {
            return false
          }

          return true
        }),
        handler: tasksSync
      }
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
        CLIENT_ID: this.config.CLIENT_ID,
        CLIENT_SECRET: this.config.CLIENT_SECRET,
        REDIRECT_URI: this.config.REDIRECT_URI || this.corePresets.redirectURI,
        SERVER: `https://app.asana.com`,
        AUTHORIZATION_ENDPOINT: '/-/oauth_authorize',
        TOKEN_ENDPOINT: '/-/oauth_token',
        SCOPES: [],
      },
    });
  }
}
