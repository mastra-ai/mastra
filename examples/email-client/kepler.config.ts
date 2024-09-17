import { GithubIntegration } from '@kpl/github'
import { AsanaIntegration } from '@kpl/asana'
import { ZendeskIntegration } from '@kpl/zendesk'
import { Config } from '@kpl/core';
import { GoogleIntegration } from '@kpl/google';
import { SlackIntegration } from '@kpl/slack';
import { TwilioIntegration } from '@kpl/twilio';
import { z } from 'zod';

export const redirectHost = process.env.APP_URL;

export const config: Config = {
  name: 'email-client',
  //logConfig: {}, // TODO: Add this
  systemApis: [],
  systemEvents: {},
  integrations: [
    new GithubIntegration(),

    new TwilioIntegration(),
    new SlackIntegration({
      config: {
        CLIENT_ID: process.env.SLACK_CLIENT_ID!,
        CLIENT_SECRET: process.env.SLACK_CLIENT_SECRET!,
        REDIRECT_URI: `https://redirectmeto.com/${new URL(`/api/kepler/connect/callback`, redirectHost).toString()}`,
        SCOPES: [],
      },
    }),

    new GoogleIntegration({
      config: {
        CLIENT_ID: process.env.GOOGLE_CLIENT_ID!,
        CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET!,
        REDIRECT_URI: new URL('/api/kepler/connect/callback', process.env.APP_URL).toString(),
        TOPIC: process.env.GOOGLE_MAIL_TOPIC!,
        SCOPES: [],
      },
    }),
    new AsanaIntegration({
    config: {
      CLIENT_ID: process.env.ASANA_CLIENT_ID!,
      CLIENT_SECRET: process.env.ASANA_CLIENT_SECRET!,
      SCOPES: undefined
    },
  }),

    new ZendeskIntegration({
    config: {
      ZENDESK_SUBDOMAIN: process.env.ZENDESK_SUBDOMAIN!,
      CLIENT_ID: process.env.ZENDESK_CLIENT_ID!,
      CLIENT_SECRET: process.env.ZENDESK_CLIENT_SECRET!,
      SCOPES: ["impersonate", "users:read"]
    },
  }),
  ],

  db: {
    provider: 'postgres',
    uri: 'postgresql://postgres:postgres@127.0.0.1:5432/kepler?schema=kepler',
  },
  systemHostURL: process.env.APP_URL!,
  routeRegistrationPath: '/api/kepler',
  blueprintDirPath: '/kepler-blueprints',
};
