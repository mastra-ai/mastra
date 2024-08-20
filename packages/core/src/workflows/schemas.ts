import { z } from 'zod';

import { RunStatus, WorkflowStatusEnum } from './types';
import { FilterOpToValueMapEnum } from './conditions/constants';

const baseConditionSchema = z
  .object({
    id: z.string(),
    field: z.string(),
    operator: z.nativeEnum(FilterOpToValueMapEnum).or(z.literal('')),
    value: z.unknown(),
    blockId: z.string(),
    actionId: z.string(),
  })
  .partial();

type Condition = z.infer<typeof baseConditionSchema> & {
  and?: Condition[];
  or?: Condition[];
};

export const conditionSchema: z.ZodType<Condition> = baseConditionSchema.extend(
  {
    and: z.lazy(() => baseConditionSchema.array()).optional(),
    or: z.lazy(() => baseConditionSchema.array()).optional(),
  }
);

export const logicConditionSchema = baseConditionSchema.extend({
  and: z.lazy(() => baseConditionSchema.array()).optional(),
  or: z.lazy(() => baseConditionSchema.array()).optional(),
  blockId: z.string(),
  actionId: z.string(),
  isDefault: z.boolean().optional(),
});

export const PayloadFieldTypeEnum = {
  VARIABLE: 'variable',
  STATIC: 'static',
} as const;

export const actionPayloadValueSchema = z.any();

export const actionPayloadSchema = z
  .record(z.string(), actionPayloadValueSchema)
  .optional();

export const actionVariableSchema = z.record(
  z.string(),
  z.object({
    refBlockId: z.string(),
    path: z.string(),
  })
);

const baseActionSchema = z.object({
  id: z.string(),
  type: z.string(),
  description: z.string().optional(),
  payload: actionPayloadSchema.optional(),
  condition: z.union([
    conditionSchema.optional(),
    z.array(logicConditionSchema).optional(),
  ]),
  parentActionId: z.string().optional(),
  variables: z.record(z.string(), actionVariableSchema.optional()).optional(),
});

type Action = z.infer<typeof baseActionSchema> & {
  subActions: Action[];
};

export const actionSchema: z.ZodType<Action> = baseActionSchema.extend({
  subActions: z.lazy(() => actionSchema.array()),
});

export const triggerSchema = z.object({
  id: z.string(),
  type: z.string(),
  description: z.string().optional(),
  payload: z
    .object({
      value: z.unknown(),
    })
    .optional(),
  condition: conditionSchema.optional(),
});

export const runSchema = z.object({
  id: z.string(),
  status: z.nativeEnum(RunStatus),
  blueprintId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date().optional(),
  completedAt: z.date().optional(),
  failedAt: z.date().optional(),
});

export const blueprintSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional().nullable(),
  status: z.nativeEnum(WorkflowStatusEnum),
  trigger: triggerSchema.nullable(),
  actions: z.array(actionSchema),

  ownerId: z.string(),
  workspaceId: z.string(),

  createdAt: z.date(),
  updatedAt: z.date().optional(),
});

export const createBlueprintSchema = blueprintSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  ownerId: true,
});

export const createRunSchema = runSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  failedAt: true,
});

export const updateBlueprintSchema = createBlueprintSchema.partial();
export const updateRunSchema = runSchema
  .omit({ id: true, blueprintId: true })
  .partial();

export const updatActionSchema = baseActionSchema.partial();

export const updateTriggerSchema = triggerSchema.partial();
