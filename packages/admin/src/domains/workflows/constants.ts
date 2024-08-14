import { createId } from '@paralleldrive/cuid2';
import { z } from 'zod';

import { ObjectCategoryEnum } from '@/types';

import { IntegrationAction, IntegrationEvent, IntegrationFieldTypeEnum, RefinedIntegrationAction } from './types';
import { extractSchemaOptions } from './utils';

export type RefinedIntegrationActionLogic = Pick<
  RefinedIntegrationAction,
  'type' | 'label' | 'icon' | 'description' | 'category'
>;

enum Status {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export const CREATE_NOTE_SCHEMA = z.object({
  title: z.string().trim().min(1, 'Required'),
  description: z.string().optional().describe(`type::${IntegrationFieldTypeEnum.LONG_TEXT}`),
  publicId: z
    .string()
    .optional()
    .default(() => `kn_${createId()}`)
    .transform(v => `kn_${createId()}`),
});

export const CREATE_NOTE_OUTPUT_SCHEMA = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional().describe(`type::${IntegrationFieldTypeEnum.LONG_TEXT}`),
  publicId: z.string(),
  status: z.nativeEnum(Status),
});

export const CREATE_TASK_OUTPUT_SCHEMA = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().describe(`type::${IntegrationFieldTypeEnum.LONG_TEXT}`),
  isCompleted: z.boolean(),
  status: z.nativeEnum(Status),
  dueDate: z.string(),
});

export const CREATE_TASK_SCHEMA = z.object({
  name: z.string().trim().min(1, 'Required'),
  description: z.string().optional().describe(`type::${IntegrationFieldTypeEnum.LONG_TEXT}`),
  dueDate: z.string().datetime().optional(),
});

export const BASE_RECORD_SCHEMA = z.object({
  recordType: z.enum([ObjectCategoryEnum.people, ObjectCategoryEnum.companies, ObjectCategoryEnum.deals]),
});

export const RECORD_SCHEMA = z.discriminatedUnion('recordType', [
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

export const systemLogics: RefinedIntegrationActionLogic[] = [
  {
    type: 'CONDITIONS',
    label: 'Multibranch',
    icon: {
      alt: 'Multibranch',
      icon: 'multibranch',
    },
    description: 'Create conditional logic',
  },
];

export const systemActions: IntegrationAction[] = [
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
];

export const systemEvents: IntegrationEvent[] = [
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
];
