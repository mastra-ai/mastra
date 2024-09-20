import { Integration, OpenAPI, IntegrationCredentialType, IntegrationAuth } from '@kpl/core';
import { createClient, type OASClient, type NormalizeOAS } from 'fets';
import { z } from 'zod';

// @ts-ignore
import GongLogo from './assets/gong.png';
import { openapi } from './openapi';
import { components } from './openapi-components';
import { paths } from './openapi-paths';

export class GongIntegration extends Integration {
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

  constructor() {
    super({
      authType: IntegrationCredentialType.API_KEY,
      name: 'GONG',
      logoUrl: GongLogo,
      authConnectionOptions: z.object({
        ACCESS_KEY: z.string(),
        ACCESS_KEY_SECRET: z.string(),
      }),
    });
  }

  getOpenApiSpec() {
    return { paths, components } as unknown as OpenAPI;
  }

  getApiClient = async ({ referenceId }: { referenceId: string }): Promise<OASClient<NormalizeOAS<openapi>>> => {
    const connection = await this.dataLayer?.getConnectionByReferenceId({ name: this.name, referenceId });

    if (!connection) {
      throw new Error(`Connection not found for referenceId: ${referenceId}`);
    }

    const credential = await this.dataLayer?.getCredentialsByConnectionId(connection.id);
    const value = credential?.value as Record<string, string>;

    const client = createClient<NormalizeOAS<openapi>>({
      endpoint: `https://discord.com/api/v10`,
      globalParams: {
        headers: {
          Authorization: `Basic ${btoa(`${value?.['ACCESS_KEY']}:${value?.['ACCESS_KEY_SECRET']}`)}`,
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
