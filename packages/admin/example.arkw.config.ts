import { Config, IntegrationFieldTypeEnum } from '@arkw/core';
import { GoogleIntegration } from '@arkw/google';
import { createId } from '@paralleldrive/cuid2';
import { z } from 'zod';

import { extractSchemaOptions } from '@/domains/workflows/utils';

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
  entityType: z.enum([ObjectCategoryEnum.people, ObjectCategoryEnum.companies, ObjectCategoryEnum.deals]),
});

const RECORD_SCHEMA = z.discriminatedUnion('entityType', [
  z.object({
    entityType: z.literal(ObjectCategoryEnum.companies),
    data: z.object({
      name: z.string().trim().min(1, 'Required'),
    }),
  }),
  z.object({
    entityType: z.literal(ObjectCategoryEnum.deals),
    data: z.object({
      name: z.string().trim().min(1, 'Required'),
      amount: z.coerce.number(),
      closeDate: z.string().datetime(),
      pipeline: z.string().trim().min(1, 'Required'),
      pipelineStage: z.string().trim().min(1, 'Required'),
    }),
  }),
  z.object({
    entityType: z.literal(ObjectCategoryEnum.people),
    data: z.object({
      firstName: z.string().trim().min(1, 'Required'),
      lastName: z.string().trim().min(1, 'Required'),
      email: z.string().email(),
    }),
  }),
]);

export const dbUrl = process.env.DB_URL;
export const redirectHost = process.env.APP_URL;

if (!dbUrl || !redirectHost) {
  throw new Error('Missing required environment variables');
}

//Custom redirect URI for slack local development
export const SLACK_REDIRECT_URI = `https://redirectmeto.com/${new URL(
  `/api/arkw/connect/callback`,
  redirectHost,
).toString()}`;

// THIS IS YOUR PROJECTS CONFIG
export const config: Config = {
  name: 'kepler',
  //logConfig: {}, // TODO: Add this
  systemApis: [
    {
      type: 'CREATE_NOTE',
      label: 'Create Note',
      icon: {
        alt: 'Create Note',
        icon: 'plus-icon',
      },
      category: 'NOTE',
      description: 'Create a new note',
      schema: CREATE_NOTE_SCHEMA,
      async getSchemaOptions() {
        const options = extractSchemaOptions({ schema: CREATE_NOTE_SCHEMA });
        return options;
      },
      outputSchema: CREATE_NOTE_OUTPUT_SCHEMA,
      executor: async () => {
        console.log('I created system notes');
      },
    },
    {
      type: 'CREATE_TASK',
      label: 'Create Task',
      icon: {
        alt: 'Create Task',
        icon: 'plus-icon',
      },
      category: 'TASK',
      description: 'Create a new task',
      schema: CREATE_TASK_SCHEMA,
      async getSchemaOptions() {
        const options = extractSchemaOptions({ schema: CREATE_TASK_SCHEMA });
        return options;
      },
      outputSchema: CREATE_TASK_OUTPUT_SCHEMA,
      executor: async () => {
        console.log('I created system tasks');
      },
    },
  ],
  systemEvents: {
    RECORD_CREATED: {
      schema: BASE_RECORD_SCHEMA,
      label: 'Record Created',
      description: 'Triggered when a record is created',
      async getSchemaOptions() {
        const options = extractSchemaOptions({ schema: BASE_RECORD_SCHEMA });
        return options;
      },
    },
    RECORD_UPDATED: {
      schema: BASE_RECORD_SCHEMA,
      label: 'Record Updated',
      description: 'Triggered when a record is updated',
      async getSchemaOptions() {
        const options = extractSchemaOptions({ schema: BASE_RECORD_SCHEMA });
        return options;
      },
    },
    RECORD_DELETED: {
      schema: BASE_RECORD_SCHEMA,
      label: 'Record Deleted',
      description: 'Triggered when a record is deleted',
      async getSchemaOptions() {
        const options = extractSchemaOptions({ schema: BASE_RECORD_SCHEMA });
        return options;
      },
    },
  },
  integrations: [
    new GoogleIntegration({
      config: {
        CLIENT_ID: process.env.GOOGLE_CLIENT_ID!,
        CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET!,
        TOPIC: process.env.GOOGLE_MAIL_TOPIC!,
      },
    }),
  ],
  db: {
    provider: 'postgres',
    uri: dbUrl,
  },
  systemHostURL: process.env.APP_URL!,
  routeRegistrationPath: '/api/arkw',
  blueprintDirPath: '/mock-data/blueprints',
};
