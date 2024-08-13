import { z } from 'zod';

import { AutomationRunStatus, AutomationStatus } from './types';
import { FilterOpToValueMapEnum } from './conditions/constants';

const baseAutomationConditionSchema = z
  .object({
    id: z.string(),
    field: z.string(),
    operator: z.nativeEnum(FilterOpToValueMapEnum).or(z.literal('')),
    value: z.unknown(),
    automationBlockId: z.string(),
    actionId: z.string(),
  })
  .partial();

type Condition = z.infer<typeof baseAutomationConditionSchema> & {
  and?: Condition[];
  or?: Condition[];
};

export const automationConditionSchema: z.ZodType<Condition> =
  baseAutomationConditionSchema.extend({
    and: z.lazy(() => baseAutomationConditionSchema.array()).optional(),
    or: z.lazy(() => baseAutomationConditionSchema.array()).optional(),
  });

export const automationLogicConditionSchema =
  baseAutomationConditionSchema.extend({
    and: z.lazy(() => baseAutomationConditionSchema.array()).optional(),
    or: z.lazy(() => baseAutomationConditionSchema.array()).optional(),
    automationBlockId: z.string(),
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

const baseAutomationActionSchema = z.object({
  id: z.string(),
  type: z.string(),
  description: z.string().optional(),
  payload: actionPayloadSchema.optional(),
  condition: z.union([
    automationConditionSchema.optional(),
    z.array(automationLogicConditionSchema).optional(),
  ]),
  parentActionId: z.string().optional(),
  variables: z.record(z.string(), actionVariableSchema.optional()).optional(),
});

type Action = z.infer<typeof baseAutomationActionSchema> & {
  subActions: Action[];
};

export const automationActionSchema: z.ZodType<Action> =
  baseAutomationActionSchema.extend({
    subActions: z.lazy(() => automationActionSchema.array()),
  });

export const automationTriggerSchema = z.object({
  id: z.string(),
  type: z.string(),
  description: z.string().optional(),
  payload: z
    .object({
      value: z.unknown(),
    })
    .optional(),
  condition: automationConditionSchema.optional(),
});

export const automationRunSchema = z.object({
  id: z.string(),
  status: z.nativeEnum(AutomationRunStatus),
  blueprintId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date().optional(),
  completedAt: z.date().optional(),
  failedAt: z.date().optional(),
});

export const automationBlueprintSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional().nullable(),
  status: z.nativeEnum(AutomationStatus),
  trigger: automationTriggerSchema.nullable(),
  actions: z.array(automationActionSchema),

  ownerId: z.string(),
  workspaceId: z.string(),

  createdAt: z.date(),
  updatedAt: z.date().optional(),
});

export const createAutomationBlueprintSchema = automationBlueprintSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  ownerId: true,
});

export const createAutomationRunSchema = automationRunSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  failedAt: true,
});

export const updateAutomationBlueprintSchema =
  createAutomationBlueprintSchema.partial();
export const updateAutomationRunSchema = automationRunSchema
  .omit({ id: true, blueprintId: true })
  .partial();

export const updatAutomationActionSchema = baseAutomationActionSchema.partial();

export const updateAutomationTriggerSchema = automationTriggerSchema.partial();
