import { Config, createFramework, extractSchemaOptions } from '@arkw/core';
import { GoogleIntegration } from '@arkw/google';
import { MailchimpIntegration } from '@arkw/mailchimp';
import { z } from 'zod';

export const dbUrl = process.env.DB_URL ?? 'file://contact-book.db';
export const redirectHost = process.env.APP_URL;

if (!dbUrl || !redirectHost) {
  throw new Error('Missing required environment variables');
}

export const REDIRECT_URI = new URL('/api/arkw/connect/callback', redirectHost).toString();

const RECORD_TYPE = { contact: 'contact' } as const;

const BASE_RECORD_SCHEMA = z.object({
  recordType: z.enum([RECORD_TYPE.contact]),
});

const RECORD_SCHEMA = z.discriminatedUnion('recordType', [
  z.object({
    recordType: z.literal(RECORD_TYPE.contact),
    data: z.object({
      firstName: z.string().trim().min(1, 'Required'),
      lastName: z.string().trim().min(1, 'Required'),
      email: z.string().email(),
      phone: z.string(),
      birthday: z.date().optional(),
    }),
  }),
]);

export const config = {
  name: 'contact-book',
  systemHostURL: process.env.APP_URL!,
  routeRegistrationPath: '/api/arkw',
  blueprintDirPath: '/src/blueprints',
  db: {
    provider: 'sqlite',
    uri: dbUrl,
  },
  integrations: [
    new GoogleIntegration({
      config: {
        CLIENT_ID: process.env.GOOGLE_CLIENT_ID!,
        CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET!,
        REDIRECT_URI,
        TOPIC: process.env.GOOGLE_MAIL_TOPIC!,
        SCOPES: [],
      },
    }),
    new MailchimpIntegration({
      config: {
        CLIENT_ID: process.env.MAILCHIMP_CLIENT_ID!,
        CLIENT_SECRET: process.env.MAILCHIMP_CLIENT_SECRET!,
        REDIRECT_URI,
        SCOPES: [],
      },
    }),
  ],
  systemEvents: {
    record_created: {
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
    record_updated: {
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
    record_deleted: {
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
  },
  systemApis: [
    {
      type: 'validate_phone_number',
      label: 'Validate Phone Number',
      description: 'Validates that the phone number assigned to the contact.',
      schema: z.object({}),
      executor: function (params: any): Promise<unknown> {
        console.log(params);
        throw new Error('Function not implemented.');
      },
    },
  ],
};

export default createFramework(config);
