import { AsanaIntegration } from '@mastra/asana';
import { AttioIntegration } from '@mastra/attio';
import { Config } from '@mastra/core';
import { GithubIntegration } from '@mastra/github';
import { GoogleIntegration } from '@mastra/google';
import { SlackIntegration } from '@mastra/slack';
import { SpotifyIntegration } from '@mastra/spotify';
import { z } from 'zod';

export const config: Config = {
  name: 'email-client',
  //logConfig: {}, // TODO: Add this
  integrations: [
    new SpotifyIntegration({
      config: {
        CLIENT_ID: process.env.SPOTIFY_CLIENT_ID!,
        CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET!,
        SCOPES: [
          'user-library-read',
          'app-remote-control',
          'playlist-read-private',
          'user-top-read',
          'user-read-recently-played',
          'user-read-currently-playing',
          'streaming',
        ],
      },
    }),

    new SlackIntegration({
      config: {
        CLIENT_ID: process.env.SLACK_CLIENT_ID!,
        CLIENT_SECRET: process.env.SLACK_CLIENT_SECRET!,
        REDIRECT_URI: 'https://redirectmeto.com/http://localhost:3456/api/mastra/connect/callback',
        SCOPES: ['channels:manage', 'users:read', 'chat:write'],
      },
    }),

    new AttioIntegration({
      config: {
        CLIENT_ID: process.env.ATTIO_CLIENT_ID!,
        CLIENT_SECRET: process.env.ATTIO_CLIENT_SECRET!,
        REDIRECT_URI: process.env.REDIRECT_URI!,
        SCOPES: undefined,
      },
    }),

    new AsanaIntegration({
      config: {
        CLIENT_ID: process.env.ASANA_CLIENT_ID!,
        CLIENT_SECRET: process.env.ASANA_CLIENT_SECRET!,
        SCOPES: undefined,
      },
    }),

    new GithubIntegration(),

    // new StripeIntegration(),

    // new NotionIntegration({
    //   config: {
    //     CLIENT_ID: process.env.NOTION_CLIENT_ID!,
    //     CLIENT_SECRET: process.env.NOTION_CLIENT_SECRET!,
    //     SCOPES: undefined,
    //   },
    // }),

    new GoogleIntegration({
      config: {
        CLIENT_ID: process.env.GOOGLE_CLIENT_ID!,
        CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET!,
        TOPIC: process.env.GOOGLE_MAIL_TOPIC!,
        SCOPES: [],
      },
    }),
  ],
  db: {
    provider: 'postgres',
    uri: 'postgresql://postgres:postgres@127.0.0.1:5432/mastra?schema=mastra',
  },
  workflows: {
    blueprintDirPath: '/mastra-blueprints',
    systemEvents: {
      BUTTON_CLICKED: {
        schema: z.object({}),
        key: 'BUTTON_CLICKED',
        label: 'Button Clicked',
        description: 'Triggered when trigger button is clicked',
      },
    },
    systemApis: [],
  },
  systemHostURL: process.env.APP_URL!,
  routeRegistrationPath: '/api/mastra',
};
