import { Config, IntegrationCredentialType } from '@arkw/core';
import { GoogleIntegration } from '@arkw/google';
import { SlackIntegration } from '@arkw/slack';
import { TwilioIntegration } from '@arkw/twilio';
import { z } from 'zod';

export const redirectHost = process.env.APP_URL;

//Custom redirect URI for slack local development
export const SLACK_REDIRECT_URI = `https://redirectmeto.com/${new URL(
  `/api/arkw/connect/callback`,
  redirectHost,
).toString()}`;

export const config: Config = {
  name: 'email-client',
  //logConfig: {}, // TODO: Add this
  systemApis: [],
  systemEvents: {
    NOTE_CREATED: {
      schema: z.object({
        name: z.string(),
      }),
      description: 'A note was created',
      label: 'Note Created',
    },
  },
  integrations: [
    new TwilioIntegration(),
    new SlackIntegration({
      config: {
        CLIENT_ID: process.env.SLACK_CLIENT_ID!,
        CLIENT_SECRET: process.env.SLACK_CLIENT_SECRET!,
        REDIRECT_URI: SLACK_REDIRECT_URI,
        SCOPES: [],
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
    uri: 'postgresql://postgres:postgres@127.0.0.1:5432/arkwright?schema=arkw',
  },
  systemHostURL: process.env.APP_URL!,
  routeRegistrationPath: '/api/arkw',
  blueprintDirPath: '/arkw-blueprints',
};
