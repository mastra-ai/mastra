import { Integration, IntegrationCredentialType, IntegrationAuth } from '@mastra/core';

// @ts-ignore
import XLogo from './assets/x.png';
import { comments } from './client/service-comments';
import * as integrationClient from './client/services.gen';
import * as zodSchema from './client/zodSchema';

type XConfig = {
  CLIENT_ID: string;
  CLIENT_SECRET: string;

  [key: string]: any;
};

export class XIntegration extends Integration {
  categories = ['marketing', 'social_media'];
  description =
    'X is a social media platform that allows users to share and interact with short messages called tweets.';
  availableScopes = [
    {
      key: `block.read`,
      description: `Accounts you’ve blocked.`,
    },
    {
      key: `block.write`,
      description: `Block and unblock accounts for you.`,
    },
    {
      key: `bookmark.read`,
      description: `Allows an app to read bookmarked Tweets`,
    },
    {
      key: `bookmark.write`,
      description: `Allows an app to create and delete bookmarks`,
    },
    {
      key: `dm.read`,
      description: `All your Direct Messages`,
    },
    {
      key: `dm.write`,
      description: `Send and manage Direct Messages for you`,
    },
    {
      key: `follows.read`,
      description: `People who follow you and people who you follow.`,
    },
    {
      key: `follows.write`,
      description: `Follow and unfollow people for you.`,
    },
    {
      key: `like.read`,
      description: `Tweets you’ve liked and likes you can view.`,
    },
    {
      key: `like.write`,
      description: `Like and un-like Tweets for you.`,
    },
    {
      key: `list.read`,
      description: `Lists, list members, and list followers of lists you’ve created or are a member of, including private lists.`,
    },
    {
      key: `list.write`,
      description: `Create and manage Lists for you.`,
    },
    {
      key: `mute.read`,
      description: `Accounts you’ve muted.`,
    },
    {
      key: `mute.write`,
      description: `Mute and unmute accounts for you.`,
    },
    {
      key: `offline.access`,
      description: `App can request refresh token.`,
    },
    {
      key: `space.read`,
      description: `Access all of the Spaces you can see.`,
    },
    {
      key: `tweet.moderate.write`,
      description: `Hide and unhide replies to your Tweets.`,
    },
    {
      key: `tweet.read`,
      description: `All the Tweets you can see, including Tweets from protected accounts.`,
    },
    {
      key: `tweet.write`,
      description: `Tweet and retweet for you.`,
    },
    {
      key: `users.read`,
      description: `Any account you can see, including protected accounts. Any account you can see, including protected accounts.`,
    },
  ];

  constructor({ config }: { config: XConfig }) {
    super({
      ...config,
      authType: IntegrationCredentialType.OAUTH,
      name: 'X',
      logoUrl: XLogo,
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
      baseUrl: 'https://api.twitter.com/2',
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
        SERVER: `https://api.twitter.com/2`,
        AUTHORIZATION_ENDPOINT: `https://api.twitter.com/2/oauth2/authorize`,
        TOKEN_ENDPOINT: `https://api.twitter.com/2/oauth2/token`,
        SCOPES: this.config.SCOPES || [],
      },
    });
  }
}
