import { AsanaIntegration } from '@mastra/asana';
import { Config } from '@mastra/core';
import { GoogleIntegration } from '@mastra/google';
import { StripeIntegration } from '@mastra/stripe';

export const config: Config = {
  name: 'kitchen-sink',
  //logConfig: {}, // TODO: Add this
  integrations: [
    new GoogleIntegration({
      config: {
        CLIENT_ID: process.env.GOOGLE_CLIENT_ID!,
        CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET!,
        TOPIC: process.env.GOOGLE_MAIL_TOPIC!,
        SCOPES: [],
      },
    }),

    new AsanaIntegration({
      config: {
        CLIENT_ID: process.env.ASANA_CLIENT_ID!,
        CLIENT_SECRET: process.env.ASANA_CLIENT_SECRET!,
        SCOPES: [],
      },
    }),

    new StripeIntegration({
      config: {
        API_KEY: process.env.STRIPE_API_KEY!,
      },
    }),
  ],
  db: {
    provider: 'postgres',
    uri: 'postgresql://postgres:postgres@127.0.0.1:5434/mastra?schema=mastra',
  },
  workflows: {
    blueprintDirPath: '/mastra-blueprints',
    systemEvents: {},
    systemApis: [],
  },
  systemHostURL: process.env.APP_URL!,
  routeRegistrationPath: '/api/mastra',
};
