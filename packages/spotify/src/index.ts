import { Integration, IntegrationCredentialType, IntegrationAuth } from '@mastra/core';

// @ts-ignore
import SpotifyLogo from './assets/spotify.png';
import { comments } from './client/service-comments';
import * as integrationClient from './client/services.gen';
import * as zodSchema from './client/zodSchema';

type SpotifyConfig = {
  CLIENT_ID: string;
  CLIENT_SECRET: string;

  [key: string]: any;
};

export class SpotifyIntegration extends Integration {
  categories = ['music'];
  description = 'Spotify is a digital music service that gives you access to millions of songs.';
  availableScopes = [
    {
      key: `app-remote-control`,
      description: `Communicate with the Spotify app on your device.
`,
    },
    {
      key: `playlist-read-private`,
      description: `Access your private playlists.
`,
    },
    {
      key: `playlist-read-collaborative`,
      description: `Access your collaborative playlists.
`,
    },
    {
      key: `playlist-modify-public`,
      description: `Manage your public playlists.
`,
    },
    {
      key: `playlist-modify-private`,
      description: `Manage your private playlists.
`,
    },
    {
      key: `user-library-read`,
      description: `Access your saved content.
`,
    },
    {
      key: `user-library-modify`,
      description: `Manage your saved content.
`,
    },
    {
      key: `user-read-private`,
      description: `Access your subscription details.
`,
    },
    {
      key: `user-read-email`,
      description: `Get your real email address.
`,
    },
    {
      key: `user-follow-read`,
      description: `Access your followers and who you are following.
`,
    },
    {
      key: `user-follow-modify`,
      description: `Manage your saved content.
`,
    },
    {
      key: `user-top-read`,
      description: `Read your top artists and content.
`,
    },
    {
      key: `user-read-playback-position`,
      description: `Read your position in content you have played.
`,
    },
    {
      key: `user-read-playback-state`,
      description: `Read your currently playing content and Spotify Connect devices information.
`,
    },
    {
      key: `user-read-recently-played`,
      description: `Access your recently played items.
`,
    },
    {
      key: `user-read-currently-playing`,
      description: `Read your currently playing content.
`,
    },
    {
      key: `user-modify-playback-state`,
      description: `Control playback on your Spotify clients and Spotify Connect devices.
`,
    },
    {
      key: `ugc-image-upload`,
      description: `Upload images to Spotify on your behalf.
`,
    },
    {
      key: `streaming`,
      description: `Play content and control playback on your other devices.
`,
    },
  ];

  constructor({ config }: { config: SpotifyConfig }) {
    super({
      ...config,
      authType: IntegrationCredentialType.OAUTH,
      name: 'SPOTIFY',
      logoUrl: SpotifyLogo,
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
      baseUrl: 'https://api.spotify.com/v1',
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
        SERVER: `https://api.spotify.com/v1`,
        AUTHORIZATION_ENDPOINT: `https://accounts.spotify.com/authorize`,
        TOKEN_ENDPOINT: `https://accounts.spotify.com/api/token`,
        SCOPES: this.config.SCOPES || [],
      },
    });
  }
}
