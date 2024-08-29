import { Config } from '@arkw/core';
import { GoogleIntegration } from '@arkw/google';

export const config: Config = {
  name: 'email-client',
  //logConfig: {}, // TODO: Add this
  systemActions: [],
  systemEvents: {},
  integrations: [
    new GoogleIntegration({
      config: {
        CLIENT_ID: process.env.GOOGLE_CLIENT_ID!,
        CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET!,
        REDIRECT_URI: new URL('/api/arkw/connect/callback', process.env.APP_URL).toString(),
        TOPIC: process.env.GOOGLE_MAIL_TOPIC!,
      },
    }),
  ],
  db: {
    provider: 'postgres',
    uri: 'postgresql://postgres:postgres@127.0.0.1:5432/arkwright?schema=arkw',
  },
  systemHostURL: process.env.APP_URL!,
  routeRegistrationPath: '/api/arkw',
  blueprintDirPath: '/arkw-blueprints',
};
