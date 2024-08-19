import { Config, createFramework, extractSchemaOptions } from 'core';
import { GoogleIntegration } from 'future-google';
import { MailchimpIntegration } from 'future-mailchimp';
import { SlackIntegration } from 'future-slack';

import {
  BASE_RECORD_SCHEMA,
  CREATE_NOTE_OUTPUT_SCHEMA,
  CREATE_NOTE_SCHEMA,
  CREATE_TASK_OUTPUT_SCHEMA,
  CREATE_TASK_SCHEMA,
  RECORD_SCHEMA,
} from '@/domains/workflows/constants';

// // We have an admin db
// // Enter secrets and shit it saves it to admin db for that integration
// // ADMIN DISPLAYS A CATALOG of plugins
// // You fill the form in and magically
// //

// export async function getFramework() {
//   // GO to host project and grab the config
//   // For each plugin they have in their plugins attempt to resolve the config from the DB
//   const configFromDB = {}
//   return createFramework(configFromDB);
// }

export const dbUrl = process.env.DB_URL;
export const redirectHost = process.env.KEPLER_URL;

if (!dbUrl || !redirectHost) {
  throw new Error('Missing required environment variables');
}

export const redirectPath = '/api/integrations/connect/callback';

export const REDIRECT_URI = new URL(redirectPath, redirectHost).toString();

// THIS IS YOUR PROJECTS CONFIG
export const config: Config = {
  name: 'kepler',
  //logConfig: {}, // TODO: Add this
  systemActions: [
    {
      pluginName: 'system',
      type: 'CREATE_NOTE',
      label: 'Create Note',
      icon: {
        alt: 'Create Note',
        icon: 'plus-icon',
      },
      category: 'NOTE',
      description: 'Create a new note',
      schema: CREATE_NOTE_SCHEMA as any,
      async getSchemaOptions() {
        const options = extractSchemaOptions({ schema: CREATE_NOTE_SCHEMA });
        return options;
      },
      outputSchema: CREATE_NOTE_OUTPUT_SCHEMA,
      executor: async () => {
        //executor
      },
    },
    {
      pluginName: 'system',
      type: 'CREATE_TASK',
      label: 'Create Task',
      icon: {
        alt: 'Create Task',
        icon: 'plus-icon',
      },
      category: 'NOTE',
      description: 'Create a new task',
      schema: CREATE_TASK_SCHEMA as any,
      async getSchemaOptions() {
        const options = extractSchemaOptions({ schema: CREATE_TASK_SCHEMA });
        return options;
      },
      outputSchema: CREATE_TASK_OUTPUT_SCHEMA,
      executor: async () => {
        //executor
      },
    },
  ],
  systemEvents: [
    {
      key: 'record_created',
      schema: BASE_RECORD_SCHEMA,
      triggerProperties: {
        type: 'RECORD_CREATED',
        label: 'Record Created',
        icon: {
          alt: 'Record Created',
          icon: 'record-created',
        },
        description: 'Triggered when a record is created',
        schema: BASE_RECORD_SCHEMA,
        async getSchemaOptions() {
          const options = extractSchemaOptions({ schema: BASE_RECORD_SCHEMA });
          return options;
        },
        outputSchema: RECORD_SCHEMA,
      },
    },
    {
      key: 'record_updated',
      schema: BASE_RECORD_SCHEMA,
      triggerProperties: {
        type: 'RECORD_UPDATED',
        label: 'Record Updated',
        icon: {
          alt: 'Record Updated',
          icon: 'edit',
        },
        description: 'Triggered when a record is updated',
        schema: BASE_RECORD_SCHEMA,
        async getSchemaOptions() {
          const options = extractSchemaOptions({ schema: BASE_RECORD_SCHEMA });
          return options;
        },
        outputSchema: RECORD_SCHEMA,
      },
    },
    {
      key: 'record_deleted',
      schema: BASE_RECORD_SCHEMA,
      triggerProperties: {
        type: 'RECORD_DELETED',
        label: 'Record Deleted',
        icon: {
          alt: 'Record Deleted',
          icon: 'trash',
        },
        description: 'Triggered when a record is deleted',
        schema: BASE_RECORD_SCHEMA,
        async getSchemaOptions() {
          const options = extractSchemaOptions({ schema: BASE_RECORD_SCHEMA });
          return options;
        },
        outputSchema: RECORD_SCHEMA,
      },
    },
  ],
  plugins: [
    new MailchimpIntegration({
      config: {
        CLIENT_ID: process.env.MAILCHIMP_CLIENT_ID!,
        CLIENT_SECRET: process.env.MAILCHIMP_CLIENT_SECRET!,
        REDIRECT_URI: new URL(redirectPath, 'http://127.0.0.1:3000').toString(),
      },
    }),
    new SlackIntegration({
      config: {
        CLIENT_ID: process.env.SLACK_CLIENT_ID!,
        CLIENT_SECRET: process.env.SLACK_CLIENT_SECRET!,
        REDIRECT_URI: new URL(redirectPath, 'http://127.0.0.1:3000').toString(),
      },
    }),
    new GoogleIntegration({
      config: {
        CLIENT_ID: process.env.GOOGLE_CLIENT_ID!,
        CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET!,
        REDIRECT_URI,
        TOPIC: process.env.GOOGLE_MAIL_TOPIC!,
      },
    }),
  ],
  db: {
    provider: 'postgres',
    uri: dbUrl,
  },
  systemHostURL: process.env.KEPLER_URL!,
  routeRegistrationPath: '/api/integrations',
};

export const future = createFramework(config);
