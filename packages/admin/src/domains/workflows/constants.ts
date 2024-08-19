import { createId } from '@paralleldrive/cuid2';
import { z } from 'zod';

import { ObjectCategoryEnum } from '@/types';

import { IntegrationFieldTypeEnum, RefinedIntegrationAction } from './types';

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
