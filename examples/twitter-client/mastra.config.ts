import { Config } from '@mastra/core';
import { SlackIntegration } from '@mastra/slack';
import { XIntegration } from '@mastra/x';
import z from 'zod';

export const config: Config = {
  name: 'twitter-client',
  //logConfig: {}, // TODO: Add this
  integrations: [
    new SlackIntegration({
      config: {
        CLIENT_ID: process.env.SLACK_CLIENT_ID!,
        CLIENT_SECRET: process.env.SLACK_CLIENT_SECRET!,
        REDIRECT_URI: `https://redirectmeto.com/${new URL(
          '/api/mastra/connect/callback',
          process.env.APP_URL,
        ).toString()}`,
        SCOPES: [],
      },
    }),

    new XIntegration({
      config: {
        CLIENT_ID: process.env.X_CLIENT_ID!,
        CLIENT_SECRET: process.env.X_CLIENT_SECRET!,
        REDIRECT_URI: new URL('/api/mastra/connect/callback', process.env.APP_URL).toString(),
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
    systemApis: [],
    systemEvents: {
      BUTTON_CLICKED: {
        schema: z.object({}),
        key: 'BUTTON_CLICKED',
        label: 'Button Clicked',
        description: 'Triggered when trigger button is clicked',
      },
    },
  },
  systemHostURL: process.env.APP_URL!,
  routeRegistrationPath: '/api/mastra',
};
