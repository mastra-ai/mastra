import { z } from 'zod';

import {
  actionPayloadSchema,
  actionPayloadValueSchema,
  actionVariableSchema,
  automationActionSchema,
  automationBlueprintSchema,
  automationConditionSchema,
  automationLogicConditionSchema,
  automationTriggerSchema,
  createAutomationBlueprintSchema,
  createAutomationRunSchema,
  PayloadFieldTypeEnum,
  updatAutomationActionSchema,
  updateAutomationBlueprintSchema,
  updateAutomationRunSchema,
  updateAutomationTriggerSchema,
} from './schemas';

export const AutomationStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
} as const;

export type AutomationStatus =
  (typeof AutomationStatus)[keyof typeof AutomationStatus];

export const AutomationRunStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;

export type AutomationRunStatus =
  (typeof AutomationRunStatus)[keyof typeof AutomationRunStatus];

export type AutomationRun = {
  id: string;
  status: AutomationRunStatus;
  completedAt: Date | null;
  failedAt: Date | null;
  blueprintId: string;
  createdAt: Date;
  updatedAt: Date | null;
};

export type CreateAutomationBlueprintDto = z.infer<
  typeof createAutomationBlueprintSchema
>;

export type CreateAutomationRunDto = z.infer<typeof createAutomationRunSchema>;

export type UpdateAutomationBlueprintDto = z.infer<
  typeof updateAutomationBlueprintSchema
>;

export type UpdateAutomationRunDto = z.infer<typeof updateAutomationRunSchema>;

export type AutomationTrigger = z.infer<typeof automationTriggerSchema>;

export type AutomationParentBlock = { blockType: 'action' | 'trigger' } & (
  | AutomationAction
  | AutomationTrigger
);

export type AutomationParentBlocks = AutomationParentBlock[];

export type UpdateAutomationTrigger = z.infer<
  typeof updateAutomationTriggerSchema
>;

export type AutomationAction = z.infer<typeof automationActionSchema>;

export type ActionWithParentCondition = AutomationAction & {
  parentCondition?: AutomationLogicConditionGroup;
};

export type AutomationBlueprint = z.infer<typeof automationBlueprintSchema>;

export type AutomationBlueprintWithRelations = AutomationBlueprint & {
  // owner?: UserInfo;
  runs?: AutomationRun[];
  isLoading?: boolean;
};

export type UpdateAutomationAction = z.infer<
  typeof updatAutomationActionSchema
>;

export type AutomationConditionGroup = z.infer<
  typeof automationConditionSchema
> & {
  actionId?: string;
  automationBlockId?: string;
  isDefault?: boolean;
};

export type AutomationLogicConditionGroup = z.infer<
  typeof automationLogicConditionSchema
>;

export type AutomationConditionConj = 'and' | 'or';

export type AutomationCondition = Pick<
  AutomationConditionGroup,
  'field' | 'operator' | 'value' | 'id'
> & {
  conj?: AutomationConditionConj;
  actionId?: string;
  automationBlockId?: string;
  isDefault?: boolean;
};

export type ActionPayload = z.infer<typeof actionPayloadSchema>;

export type ActionVariables = z.infer<typeof actionVariableSchema>;

export type ActionVariable = z.infer<typeof actionVariableSchema.valueSchema>;

export type PayloadField =
  (typeof PayloadFieldTypeEnum)[keyof typeof PayloadFieldTypeEnum];

export type ActionPayloadValue = z.infer<typeof actionPayloadValueSchema>;

export type WorkflowContextBlueprintInfo = Omit<
  AutomationBlueprintWithRelations,
  'actions' | 'trigger' | 'isLoading' | 'runs'
>;

export type WorkflowContextAction = UpdateAutomationAction & {
  id: string;
  parentActionId?: string;
};

export type WorkflowContextWorkflowActionsShape = {
  [key: string]: WorkflowContextAction;
};

export type WorkflowContextSelectedBlock =
  | {
      type: 'action';
      block: AutomationAction;
    }
  | {
      type: 'trigger';
      block: AutomationTrigger;
    }
  | {
      type: 'path';
      block: AutomationLogicConditionGroup;
    };

export type NewActionInMiddleProps = {
  newAction: WorkflowContextAction;
  isParentATrigger?: boolean;
} & (
  | { isParentACondition?: never; conditionId?: never }
  | { isParentACondition: boolean; conditionId: string }
);

export interface UpdateLogicCondtion {
  actionId: string;
  condition: AutomationLogicConditionGroup;
  isNewCondition?: boolean;
  isPathFromGraph?: boolean;
}
