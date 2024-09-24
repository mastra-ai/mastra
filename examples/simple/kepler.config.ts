import { Config } from '@kpl/core';
import { SlackIntegration } from '@kpl/slack'
import { GoogleIntegration } from '@kpl/google'
import { OpenaiIntegration } from '@kpl/openai'
import { z } from 'zod'

export const config: Config = {
  name: 'simple',
  //logConfig: {}, // TODO: Add this
  integrations: [
    new SlackIntegration({
      config: {
        CLIENT_ID: process.env.SLACK_CLIENT_ID!,
        CLIENT_SECRET: process.env.SLACK_CLIENT_SECRET!,
        REDIRECT_URI: 'https://redirectmeto.com/http://localhost:3456/api/kepler/connect/callback',
        SCOPES: []
      }
    }),
    new GoogleIntegration({
      config: {
        CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
        CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
      }
    }),
    new OpenaiIntegration({
      config: {
        API_KEY: process.env.OPENAI_API_KEY
      }
    })
  ],
  db: {
    provider: 'postgres',
    uri: 'postgresql://postgres:postgres@127.0.0.1:5433/kepler?schema=kepler',
  },
  workflows: {
    blueprintDirPath: '/kepler-blueprints',
    systemEvents: {
      RECORD_CREATED: {
        label: 'Record Created',
        description: 'Triggered when a record is created',
        schema: z.object({
          name: z.string()
        })
      }
    },
    systemApis: [],
  },
  systemHostURL: process.env.APP_URL!,
  routeRegistrationPath: '/api/kepler',
};
