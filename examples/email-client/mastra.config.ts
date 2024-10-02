import { Config } from '@mastra/core';
import { GoogleIntegration } from '@mastra/google';
import { XIntegration } from '@mastra/x';
// import { NotionIntegration } from '@mastra/notion';
import { z } from 'zod';

export const config: Config = {
  name: 'email-client',
  //logConfig: {}, // TODO: Add this
  integrations: [
    new XIntegration({
      config: {
        CLIENT_ID: process.env.X_CLIENT_ID!,
        CLIENT_SECRET: process.env.X_CLIENT_SECRET!,
        SCOPES: undefined,
      },
    }),

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
