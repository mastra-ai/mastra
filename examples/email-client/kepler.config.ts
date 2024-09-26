import { StripeIntegration } from '@kpl/stripe'
import { Config } from '@kpl/core';
import { GoogleIntegration } from '@kpl/google';
import { NotionIntegration } from '@kpl/notion';
import { z } from 'zod';

export const config: Config = {
  name: 'email-client',
  //logConfig: {}, // TODO: Add this
  integrations: [
    new StripeIntegration(),

    new NotionIntegration({
      config: {
        CLIENT_ID: process.env.NOTION_CLIENT_ID!,
        CLIENT_SECRET: process.env.NOTION_CLIENT_SECRET!,
        SCOPES: undefined,
      },
    }),

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
    uri: 'postgresql://postgres:postgres@127.0.0.1:5432/kepler?schema=kepler',
  },
  workflows: {
    blueprintDirPath: '/kepler-blueprints',
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
  routeRegistrationPath: '/api/kepler',
};
