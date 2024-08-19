import { z } from 'zod';

import {
  actionPayloadSchema,
  actionPayloadValueSchema,
  actionVariableSchema,
  actionSchema,
  blueprintSchema,
  conditionSchema,
  logicConditionSchema,
  triggerSchema,
  createBlueprintSchema,
  createRunSchema,
  PayloadFieldTypeEnum,
  updatActionSchema,
  updateBlueprintSchema,
  updateRunSchema,
  updateTriggerSchema,
} from './schemas';

export const WorkflowStatusEnum = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
} as const;

export type WorkflowStatus =
  (typeof WorkflowStatusEnum)[keyof typeof WorkflowStatusEnum];

export const RunStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;

export type RunStatus = (typeof RunStatus)[keyof typeof RunStatus];

export type Run = {
  id: string;
  status: RunStatus;
  completedAt: Date | null;
  failedAt: Date | null;
  blueprintId: string;
  createdAt: Date;
  updatedAt: Date | null;
};

export type CreateBlueprintDto = z.infer<typeof createBlueprintSchema>;

export type CreateRunDto = z.infer<typeof createRunSchema>;

export type UpdateBlueprintDto = z.infer<typeof updateBlueprintSchema>;

export type UpdateRunDto = z.infer<typeof updateRunSchema>;

export type WorkflowTrigger = z.infer<typeof triggerSchema>;

export type UpdateTrigger = z.infer<typeof updateTriggerSchema>;

export type WorkflowAction = z.infer<typeof actionSchema>;

export type WorkflowParentBlock = { blockType: 'action' | 'trigger' } & (
  | WorkflowAction
  | WorkflowTrigger
);

export type WorkflowParentBlocks = WorkflowParentBlock[];

export type ActionWithParentCondition = WorkflowAction & {
  parentCondition?: WorkflowLogicConditionGroup;
};

export type Blueprint = z.infer<typeof blueprintSchema>;

export type BlueprintWithRelations = Blueprint & {
  // owner?: UserInfo;
  runs?: Run[];
  isLoading?: boolean;
};

export type UpdateAction = z.infer<typeof updatActionSchema>;

export type WorkflowConditionGroup = z.infer<typeof conditionSchema> & {
  actionId?: string;
  blockId?: string;
  isDefault?: boolean;
};

export type WorkflowLogicConditionGroup = z.infer<typeof logicConditionSchema>;

export type ConditionConj = 'and' | 'or';

export type WorkflowCondition = Pick<
  WorkflowConditionGroup,
  'field' | 'operator' | 'value' | 'id'
> & {
  conj?: ConditionConj;
  actionId?: string;
  blockId?: string;
  isDefault?: boolean;
};

export type ActionPayload = z.infer<typeof actionPayloadSchema>;

export type ActionVariables = z.infer<typeof actionVariableSchema>;

export type ActionVariable = z.infer<typeof actionVariableSchema.valueSchema>;

export type PayloadField =
  (typeof PayloadFieldTypeEnum)[keyof typeof PayloadFieldTypeEnum];

export type ActionPayloadValue = z.infer<typeof actionPayloadValueSchema>;

export type WorkflowContextBlueprintInfo = Omit<
  BlueprintWithRelations,
  'actions' | 'trigger' | 'isLoading' | 'runs'
>;

export type WorkflowContextAction = UpdateAction & {
  id: string;
  parentActionId?: string;
};

export type WorkflowContextWorkflowActionsShape = {
  [key: string]: WorkflowContextAction;
};

export type WorkflowContextSelectedBlock =
  | {
      type: 'action';
      block: WorkflowAction;
    }
  | {
      type: 'trigger';
      block: WorkflowTrigger;
    }
  | {
      type: 'path';
      block: WorkflowLogicConditionGroup;
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
  condition: WorkflowLogicConditionGroup;
  isNewCondition?: boolean;
  isPathFromGraph?: boolean;
}
