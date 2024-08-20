import { Config, createFramework, extractSchemaOptions } from '@arkw/core';
import { GoogleIntegration } from '@arkw/google';
import { MailchimpIntegration } from '@arkw/mailchimp';
import { z } from 'zod';

export const dbUrl = process.env.DB_URL;
export const redirectHost = process.env.APP_URL;

if (!dbUrl || !redirectHost) {
  throw new Error('Missing required environment variables');
}

export const redirectPath = '/api/integrations/connect/callback';

export const REDIRECT_URI = new URL(redirectPath, redirectHost).toString();

const ObjectCategoryEnum = {
  people: 'people',
  companies: 'companies',
  deals: 'deals',
} as const;

// TODO: Shouldn't this just be included in the framework by default?
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

const config: Config = {
  name: 'kepler',
  //logConfig: {}, // TODO: Add this
  systemActions: [],
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
  integrations: [
    new MailchimpIntegration({
      config: {
        CLIENT_ID: process.env.MAILCHIMP_CLIENT_ID!,
        CLIENT_SECRET: process.env.MAILCHIMP_CLIENT_SECRET!,
        REDIRECT_URI,
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
    uri: process.env.DB_URL!,
  },
  systemHostURL: process.env.APP_URL!,
  routeRegistrationPath: '/api/integrations',
  blueprintDirPath: '/mock-data/blueprints',
};

export default createFramework(config);
