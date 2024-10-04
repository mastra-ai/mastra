import { Integration, IntegrationCredentialType, IntegrationAuth } from '@mastra/core';

// @ts-ignore
import SlackLogo from './assets/slack.png';
import { comments } from './client/service-comments';
import * as integrationClient from './client/services.gen';
import * as zodSchema from './client/zodSchema';

type SlackConfig = {
  CLIENT_ID: string;
  CLIENT_SECRET: string;

  [key: string]: any;
};

export class SlackIntegration extends Integration {
  categories = ['communications'];
  description = 'Slack is a cloud-based team collaboration tool.';
  availableScopes = [
    {
      key: `admin`,
      description: `admin`,
    },
    {
      key: `admin.apps:read`,
      description: `admin.apps:read`,
    },
    {
      key: `admin.apps:write`,
      description: `admin.apps:write`,
    },
    {
      key: `admin.conversations:read`,
      description: `admin.conversations:read`,
    },
    {
      key: `admin.conversations:write`,
      description: `admin.conversations:write`,
    },
    {
      key: `admin.invites:read`,
      description: `admin.invites:read`,
    },
    {
      key: `admin.invites:write`,
      description: `admin.invites:write`,
    },
    {
      key: `admin.teams:read`,
      description: `admin.teams:read`,
    },
    {
      key: `admin.teams:write`,
      description: `admin.teams:write`,
    },
    {
      key: `admin.usergroups:read`,
      description: `admin.usergroups:read`,
    },
    {
      key: `admin.usergroups:write`,
      description: `admin.usergroups:write`,
    },
    {
      key: `admin.users:read`,
      description: `admin.users:read`,
    },
    {
      key: `admin.users:write`,
      description: `admin.users:write`,
    },
    {
      key: `authorizations:read`,
      description: `authorizations:read`,
    },
    {
      key: `bot`,
      description: `Bot user scope`,
    },
    {
      key: `calls:read`,
      description: `calls:read`,
    },
    {
      key: `calls:write`,
      description: `calls:write`,
    },
    {
      key: `channels:history`,
      description: `channels:history`,
    },
    {
      key: `channels:manage`,
      description: `channels:manage`,
    },
    {
      key: `channels:read`,
      description: `channels:read`,
    },
    {
      key: `channels:write`,
      description: `channels:write`,
    },
    {
      key: `chat:write`,
      description: `chat:write`,
    },
    {
      key: `chat:write:bot`,
      description: `Author messages as a bot`,
    },
    {
      key: `chat:write:user`,
      description: `Author messages as a user`,
    },
    {
      key: `conversations:history`,
      description: `conversations:history`,
    },
    {
      key: `conversations:read`,
      description: `conversations:read`,
    },
    {
      key: `conversations:write`,
      description: `conversations:write`,
    },
    {
      key: `dnd:read`,
      description: `dnd:read`,
    },
    {
      key: `dnd:write`,
      description: `dnd:write`,
    },
    {
      key: `emoji:read`,
      description: `emoji:read`,
    },
    {
      key: `files:read`,
      description: `files:read`,
    },
    {
      key: `files:write:user`,
      description: `files:write:user`,
    },
    {
      key: `groups:history`,
      description: `groups:history`,
    },
    {
      key: `groups:read`,
      description: `groups:read`,
    },
    {
      key: `groups:write`,
      description: `groups:write`,
    },
    {
      key: `identity.basic`,
      description: `identity.basic`,
    },
    {
      key: `im:history`,
      description: `im:history`,
    },
    {
      key: `im:read`,
      description: `im:read`,
    },
    {
      key: `im:write`,
      description: `im:write`,
    },
    {
      key: `links:write`,
      description: `links:write`,
    },
    {
      key: `mpim:history`,
      description: `mpim:history`,
    },
    {
      key: `mpim:read`,
      description: `mpim:read`,
    },
    {
      key: `mpim:write`,
      description: `mpim:write`,
    },
    {
      key: `none`,
      description: `No scope required`,
    },
    {
      key: `pins:read`,
      description: `pins:read`,
    },
    {
      key: `pins:write`,
      description: `pins:write`,
    },
    {
      key: `reactions:read`,
      description: `reactions:read`,
    },
    {
      key: `reactions:write`,
      description: `reactions:write`,
    },
    {
      key: `reminders:read`,
      description: `reminders:read`,
    },
    {
      key: `reminders:write`,
      description: `reminders:write`,
    },
    {
      key: `remote_files:read`,
      description: `remote_files:read`,
    },
    {
      key: `remote_files:share`,
      description: `remote_files:share`,
    },
    {
      key: `remote_files:write`,
      description: `remote_files:write`,
    },
    {
      key: `rtm:stream`,
      description: `rtm:stream`,
    },
    {
      key: `search:read`,
      description: `search:read`,
    },
    {
      key: `stars:read`,
      description: `stars:read`,
    },
    {
      key: `stars:write`,
      description: `stars:write`,
    },
    {
      key: `team:read`,
      description: `team:read`,
    },
    {
      key: `tokens.basic`,
      description: `tokens.basic`,
    },
    {
      key: `usergroups:read`,
      description: `usergroups:read`,
    },
    {
      key: `usergroups:write`,
      description: `usergroups:write`,
    },
    {
      key: `users.profile:read`,
      description: `users.profile:read`,
    },
    {
      key: `users.profile:write`,
      description: `users.profile:write`,
    },
    {
      key: `users:read`,
      description: `users:read`,
    },
    {
      key: `users:read.email`,
      description: `users:read.email`,
    },
    {
      key: `users:write`,
      description: `users:write`,
    },
    {
      key: `workflow.steps:execute`,
      description: `workflow.steps:execute`,
    },
  ];

  constructor({ config }: { config: SlackConfig }) {
    super({
      ...config,
      authType: IntegrationCredentialType.OAUTH,
      name: 'SLACK',
      logoUrl: SlackLogo,
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
      baseUrl: 'https://slack.com/api',
    });
    return integrationClient;
  }

  getApiClient = async ({ connectionId }: { connectionId: string }) => {
    const connection = await this.dataLayer?.getConnection({ name: this.name, connectionId });

    if (!connection) {
      throw new Error(`Connection not found for connectionId: ${connectionId}`);
    }

    const authenticator = this.getAuthenticator();
    const { accessToken } = await authenticator.getAuthToken({ k_id: connection.id });

    const baseClient = this.getBaseClient();

    baseClient.client.interceptors.request.use((request, options) => {
      request.headers.set('Authorization', `Bearer ${accessToken}`);
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
        CLIENT_ID: this.config.CLIENT_ID,
        CLIENT_SECRET: this.config.CLIENT_SECRET,
        REDIRECT_URI: this.config.REDIRECT_URI || this.corePresets.redirectURI,
        SERVER: `https://slack.com/api`,
        AUTHORIZATION_ENDPOINT: `https://slack.com/oauth/v2/authorize`,
        TOKEN_ENDPOINT: `https://slack.com/api/oauth.v2.access`,
        SCOPES: this.config.SCOPES || [],
      },
    });
  }
}
