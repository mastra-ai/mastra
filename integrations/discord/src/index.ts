import { Integration, IntegrationCredentialType, IntegrationAuth } from '@mastra/core';

// @ts-ignore
import DiscordLogo from './assets/discord.png';
import { comments } from './client/service-comments';
import * as integrationClient from './client/services.gen';
import * as zodSchema from './client/zodSchema';

type DiscordConfig = {
  CLIENT_ID: string;
  CLIENT_SECRET: string;

  [key: string]: any;
};

export class DiscordIntegration extends Integration {
  categories = ['communications'];
  description = 'Discord is a voice, video, and text communication platform.';
  availableScopes = [
    {
      key: `activities.read`,
      description: `allows your app to fetch data from a user's "Now Playing/Recently Played" list - requires Discord approval`,
    },
    {
      key: `activities.write`,
      description: `allows your app to update a user's activity - requires Discord approval (NOT REQUIRED FOR GAMESDK ACTIVITY MANAGER)`,
    },
    {
      key: `applications.builds.read`,
      description: `allows your app to read build data for a user's applications`,
    },
    {
      key: `applications.builds.upload`,
      description: `allows your app to upload/update builds for a user's applications - requires Discord approval`,
    },
    {
      key: `applications.commands`,
      description: `allows your app to use commands in a guild`,
    },
    {
      key: `applications.commands.permissions.update`,
      description: `allows your app to update permissions for its commands in a guild a user has permissions to`,
    },
    {
      key: `applications.entitlements`,
      description: `allows your app to read entitlements for a user's applications`,
    },
    {
      key: `applications.store.update`,
      description: `allows your app to read and update store data (SKUs, store listings, achievements, etc.) for a user's applications`,
    },
    {
      key: `bot`,
      description: `for oauth2 bots, this puts the bot in the user's selected guild by default`,
    },
    {
      key: `connections`,
      description: `allows /users/@me/connections to return linked third-party accounts`,
    },
    {
      key: `dm_channels.read`,
      description: `allows your app to see information about the user's DMs and group DMs - requires Discord approval`,
    },
    {
      key: `email`,
      description: `enables /users/@me to return an email`,
    },
    {
      key: `gdm.join`,
      description: `allows your app to join users to a group dm`,
    },
    {
      key: `guilds`,
      description: `allows /users/@me/guilds to return basic information about all of a user's guilds`,
    },
    {
      key: `guilds.join`,
      description: `allows /guilds/{guild.id}/members/{user.id} to be used for joining users to a guild`,
    },
    {
      key: `guilds.members.read`,
      description: `allows /users/@me/guilds/{guild.id}/member to return a user's member information in a guild`,
    },
    {
      key: `identify`,
      description: `allows /users/@me without email`,
    },
    {
      key: `messages.read`,
      description: `for local rpc server api access, this allows you to read messages from all client channels (otherwise restricted to channels/guilds your app creates)`,
    },
    {
      key: `relationships.read`,
      description: `allows your app to know a user's friends and implicit relationships - requires Discord approval`,
    },
    {
      key: `rpc`,
      description: `for local rpc server access, this allows you to control a user's local Discord client - requires Discord approval`,
    },
    {
      key: `rpc.activities.write`,
      description: `for local rpc server access, this allows you to update a user's activity - requires Discord approval`,
    },
    {
      key: `rpc.notifications.read`,
      description: `for local rpc server access, this allows you to receive notifications pushed out to the user - requires Discord approval`,
    },
    {
      key: `rpc.screenshare.read`,
      description: `for local rpc server access, this allows you to read a user's screenshare status- requires Discord approval`,
    },
    {
      key: `rpc.screenshare.write`,
      description: `for local rpc server access, this allows you to update a user's screenshare settings- requires Discord approval`,
    },
    {
      key: `rpc.video.read`,
      description: `for local rpc server access, this allows you to read a user's video status - requires Discord approval`,
    },
    {
      key: `rpc.video.write`,
      description: `for local rpc server access, this allows you to update a user's video settings - requires Discord approval`,
    },
    {
      key: `rpc.voice.read`,
      description: `for local rpc server access, this allows you to read a user's voice settings and listen for voice events - requires Discord approval`,
    },
    {
      key: `rpc.voice.write`,
      description: `for local rpc server access, this allows you to update a user's voice settings - requires Discord approval`,
    },
    {
      key: `voice`,
      description: `allows your app to connect to voice on user's behalf and see all the voice members - requires Discord approval`,
    },
    {
      key: `webhook.incoming`,
      description: `this generates a webhook that is returned in the oauth token response for authorization code grants`,
    },
  ];

  constructor({ config }: { config: DiscordConfig }) {
    super({
      ...config,
      authType: IntegrationCredentialType.OAUTH,
      name: 'DISCORD',
      logoUrl: DiscordLogo,
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
      baseUrl: `https://discord.com/api/v10`,
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
        SERVER: `https://discord.com/api/v10`,
        AUTHORIZATION_ENDPOINT: `discord.com/oauth2/authorize`,
        TOKEN_ENDPOINT: `https://discord.com/api/oauth2/token`,
        SCOPES: this.config.SCOPES || [],
      },
    });
  }
}
