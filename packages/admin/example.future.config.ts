import { createId } from '@paralleldrive/cuid2';
import { Config, createFramework, extractSchemaOptions, IntegrationFieldTypeEnum } from 'core';
import { GoogleIntegration } from 'future-google';
import { MailchimpIntegration } from 'future-mailchimp';
import { RewatchIntegration } from 'future-rewatch';
import { SlackIntegration } from 'future-slack';
import { z } from 'zod';

enum Status {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

const ObjectCategoryEnum = {
  people: 'people',
  companies: 'companies',
  deals: 'deals',
} as const;

const CREATE_NOTE_SCHEMA = z.object({
  title: z.string().trim().min(1, 'Required'),
  description: z.string().optional().describe(`type::${IntegrationFieldTypeEnum.LONG_TEXT}`),
  publicId: z
    .string()
    .optional()
    .default(() => `kn_${createId()}`)
    .transform(v => `kn_${createId()}`),
});

const CREATE_NOTE_OUTPUT_SCHEMA = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional().describe(`type::${IntegrationFieldTypeEnum.LONG_TEXT}`),
  publicId: z.string(),
  status: z.nativeEnum(Status),
});

const CREATE_TASK_OUTPUT_SCHEMA = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().describe(`type::${IntegrationFieldTypeEnum.LONG_TEXT}`),
  isCompleted: z.boolean(),
  status: z.nativeEnum(Status),
  dueDate: z.string(),
});

const CREATE_TASK_SCHEMA = z.object({
  name: z.string().trim().min(1, 'Required'),
  description: z.string().optional().describe(`type::${IntegrationFieldTypeEnum.LONG_TEXT}`),
  dueDate: z.string().datetime().optional(),
});

const BASE_RECORD_SCHEMA = z.object({
  recordType: z.enum([ObjectCategoryEnum.people, ObjectCategoryEnum.companies, ObjectCategoryEnum.deals]),
});

const RECORD_SCHEMA = z.discriminatedUnion('recordType', [
  z.object({
    recordType: z.literal(ObjectCategoryEnum.companies),
    data: z.object({
      name: z.string().trim().min(1, 'Required'),
    }),
  }),
  z.object({
    recordType: z.literal(ObjectCategoryEnum.deals),
    data: z.object({
      name: z.string().trim().min(1, 'Required'),
      amount: z.coerce.number(),
      closeDate: z.string().datetime(),
      pipeline: z.string().trim().min(1, 'Required'),
      pipelineStage: z.string().trim().min(1, 'Required'),
    }),
  }),
  z.object({
    recordType: z.literal(ObjectCategoryEnum.people),
    data: z.object({
      firstName: z.string().trim().min(1, 'Required'),
      lastName: z.string().trim().min(1, 'Required'),
      email: z.string().email(),
    }),
  }),
]);

// import { RewatchIntegration } from 'future-rewatch';

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
export const SLACK_REDIRECT_URI = `https://redirectmeto.com/${new URL(redirectPath, redirectHost).toString()}`;

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
        REDIRECT_URI,
      },
    }),
    new RewatchIntegration(),
    new SlackIntegration({
      config: {
        CLIENT_ID: process.env.SLACK_CLIENT_ID!,
        CLIENT_SECRET: process.env.SLACK_CLIENT_SECRET!,
        REDIRECT_URI: SLACK_REDIRECT_URI,
        // SLACK_PROXY_REDIRECT_URI='https://redirectmeto.com/http://localhost:3000/api/integrations/connect/callback'
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
