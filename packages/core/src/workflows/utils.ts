import * as dateFns from 'date-fns';

import {
  z,
  ZodArray,
  ZodDate,
  ZodEnum,
  ZodNumber,
  ZodOptional,
  ZodString,
  ZodTypeAny,
} from 'zod';

import {
  frameWorkIcon,
  IntegrationContext,
  RefinedIntegrationAction,
  RefinedIntegrationEventTriggerProperties,
} from '../types';

import {
  ActionVariable,
  AutomationAction,
  AutomationBlueprintWithRelations,
  AutomationCondition,
  AutomationConditionGroup,
  AutomationLogicConditionGroup,
  AutomationParentBlock,
  AutomationParentBlocks,
  AutomationStatus,
  AutomationTrigger,
  WorkflowContextAction,
  WorkflowContextWorkflowActionsShape,
} from './types';
import { FilterOpToValueMapEnum } from './conditions/constants';
import { FilterOperator } from './conditions/types';

export const workflowStatusColorMap: Record<AutomationStatus, string> = {
  DRAFT: '#DFCA7A',
  PUBLISHED: '#4BB042',
} as const;

export const workflowStatusTextMap: Record<AutomationStatus, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Live',
} as const;

export function extractConditions(group?: AutomationConditionGroup) {
  let result: AutomationCondition[] = [];
  if (!group) return result;

  function recurse(group: AutomationConditionGroup, conj?: 'and' | 'or') {
    const {
      field,
      operator,
      value,
      automationBlockId,
      id,
      actionId,
      isDefault,
    } = group;

    if (id || field || isDefault) {
      result.push({
        field,
        operator,
        value,
        automationBlockId,
        id,
        actionId,
        isDefault,
        conj: conj,
      });
    }
    if (group.and) {
      for (const subGroup of group.and) {
        recurse({ ...subGroup }, 'and');
      }
    }
    if (group.or) {
      for (const subGroup of group.or) {
        recurse({ ...subGroup }, 'or');
      }
    }
  }

  recurse(group);
  return result;
}

export const getAllParentBlocks = ({
  actions,
  actionId,
  trigger,
}: {
  actions: WorkflowContextWorkflowActionsShape;
  actionId: string;
  trigger: AutomationTrigger;
}) => {
  const action = actions[actionId];
  let parentActions: AutomationParentBlocks = [];
  let parentActionId = action.parentActionId;
  while (!!parentActionId) {
    const parent = actions[parentActionId] as AutomationAction;
    if (parent.type !== 'CONDITIONS') {
      parentActions.push({ ...parent, blockType: 'action' });
    }
    parentActionId = parent.parentActionId;
  }

  const parentBlocks = [
    ...parentActions,
    { ...trigger, blockType: 'trigger' } as AutomationParentBlock,
  ];

  return parentBlocks;
};

export const getOutputSchema = ({
  block,
  payload,
  blockType,
}: {
  block: RefinedIntegrationAction | RefinedIntegrationEventTriggerProperties;
  payload: { value?: unknown } | Record<string, any>;
  blockType: 'action' | 'trigger';
}) => {
  const body = blockType === 'trigger' ? payload?.value : payload;
  const blockSchemaTypeName =
    (block as any)?.zodOutputSchema?._def?.typeName ||
    (block?.outputSchema as any)?._def?.typeName;
  const discriminatedUnionSchemaOptions = (block?.outputSchema as any)?._def
    ?.options;
  const discriminatedUnionSchemaDiscriminator =
    (block as any)?.zodOutputSchema?._def?.discriminator ||
    (block?.outputSchema as any)?._def?.discriminator;

  const discriminatorValue = discriminatedUnionSchemaDiscriminator
    ? (body as any)?.[discriminatedUnionSchemaDiscriminator]
    : undefined;

  const discriminatedUnionSchema = discriminatedUnionSchemaOptions?.find(
    (option: any) =>
      option?.shape?.[discriminatedUnionSchemaDiscriminator]?._def?.value ===
      discriminatorValue
  );

  const schema =
    blockSchemaTypeName === 'ZodDiscriminatedUnion'
      ? discriminatedUnionSchema?.omit({
          [discriminatedUnionSchemaDiscriminator]: true,
        })
      : (block as any)?.outputSchema || (block as any)?.schema;

  return schema;
};

export const getOutputSchemaServer = async ({
  ctx,
  block,
  payload,
  blockType,
}: {
  ctx: IntegrationContext;
  block: RefinedIntegrationAction | RefinedIntegrationEventTriggerProperties;
  payload: { value?: unknown } | Record<string, any>;
  blockType: 'action' | 'trigger';
}) => {
  const body = blockType === 'trigger' ? payload?.value : payload;
  const outputSchema =
    typeof block.outputSchema === 'function'
      ? await block.outputSchema({ ctx })
      : block.outputSchema;
  const schema =
    typeof block.schema === 'function'
      ? await block.schema({ ctx })
      : block.schema;

  const blockSchemaTypeName = (outputSchema as any)?._def?.typeName;
  const discriminatedUnionSchemaOptions = (outputSchema as any)?._def?.options;
  const discriminatedUnionSchemaDiscriminator = (outputSchema as any)?._def
    ?.discriminator;

  const discriminatorValue = discriminatedUnionSchemaDiscriminator
    ? (body as any)?.[discriminatedUnionSchemaDiscriminator]
    : undefined;

  const discriminatedUnionSchema = discriminatedUnionSchemaOptions?.find(
    (option: any) =>
      option?.shape?.[discriminatedUnionSchemaDiscriminator]?._def?.value ===
      discriminatorValue
  );

  const resolvedSchema =
    blockSchemaTypeName === 'ZodDiscriminatedUnion'
      ? discriminatedUnionSchema
      : outputSchema || schema;

  return resolvedSchema;
};

export const getSchemaServer = async ({
  ctx,
  block,
  payload,
  blockType,
}: {
  ctx: IntegrationContext;
  block: RefinedIntegrationAction | RefinedIntegrationEventTriggerProperties;
  payload: { value?: unknown } | Record<string, any>;
  blockType: 'action' | 'trigger';
}) => {
  const body = blockType === 'trigger' ? payload?.value : payload;
  const outputSchema =
    typeof block.outputSchema === 'function'
      ? await block.outputSchema({ ctx })
      : block.outputSchema;
  const schema =
    typeof block.schema === 'function'
      ? await block.schema({ ctx })
      : block.schema;

  const blockSchemaTypeName = (outputSchema as any)?._def?.typeName;
  const discriminatedUnionSchemaOptions = (outputSchema as any)?._def?.options;
  const discriminatedUnionSchemaDiscriminator = (outputSchema as any)?._def
    ?.discriminator;

  const discriminatorValue = discriminatedUnionSchemaDiscriminator
    ? (body as any)?.[discriminatedUnionSchemaDiscriminator]
    : undefined;

  const discriminatedUnionSchema = discriminatedUnionSchemaOptions?.find(
    (option: any) =>
      option?.shape?.[discriminatedUnionSchemaDiscriminator]?._def?.value ===
      discriminatorValue
  );

  const resolvedSchema =
    blockSchemaTypeName === 'ZodDiscriminatedUnion'
      ? discriminatedUnionSchema
      : schema || outputSchema;

  return resolvedSchema;
};

export const getSchemaClient = ({
  block,
  payload,
  blockType,
}: {
  block: RefinedIntegrationAction | RefinedIntegrationEventTriggerProperties;
  payload: { value?: unknown } | Record<string, any>;
  blockType: 'action' | 'trigger';
}) => {
  const body = blockType === 'trigger' ? payload?.value : payload;
  const schema = block?.zodSchema || block?.schema;

  const blockSchemaTypeName = (schema as any)?._def?.typeName;
  const discriminatedUnionSchemaOptions = (block?.schema as any)?._def?.options;
  const discriminatedUnionSchemaDiscriminator = (schema as any)?._def
    ?.discriminator;

  const discriminatorValue = discriminatedUnionSchemaDiscriminator
    ? (body as any)?.[discriminatedUnionSchemaDiscriminator]
    : undefined;

  const discriminatedUnionSchema =
    discriminatedUnionSchemaOptions?.find(
      (option: any) =>
        option?.shape?.[discriminatedUnionSchemaDiscriminator]?._def?.value ===
        discriminatorValue
    ) ||
    z.object({
      [discriminatedUnionSchemaDiscriminator]: z
        .string()
        .trim()
        .min(1, 'Required'),
    });

  const resolvedSchema =
    blockSchemaTypeName === 'ZodDiscriminatedUnion'
      ? discriminatedUnionSchema
      : block?.schema;

  return resolvedSchema;
};

export const filterChecks = {
  stringCheck: ({
    filterField,
    operator,
    comparator,
  }: {
    filterField: string;
    operator: FilterOperator;
    comparator: string;
  }) => {
    if (!filterField) return false;

    if (typeof filterField !== 'string') return false;

    switch (operator) {
      case FilterOpToValueMapEnum.EQUAL:
        return (
          filterField.trim().toLowerCase() === comparator.trim().toLowerCase()
        );
      case FilterOpToValueMapEnum.NOT_EQUAL:
        return (
          filterField.trim().toLowerCase() !== comparator.trim().toLowerCase()
        );
      case FilterOpToValueMapEnum.CONTAINS:
        return filterField
          .trim()
          .toLowerCase()
          .includes(comparator.trim().toLowerCase());
      case FilterOpToValueMapEnum.DOES_NOT_CONTAIN:
        return !filterField.trim().toLowerCase().includes(comparator.trim());
      case FilterOpToValueMapEnum.SET:
        return !!filterField;
      case FilterOpToValueMapEnum.NOT_SET:
        return !filterField;
      default:
        return false;
    }
  },
  numberCheck: ({
    filterField,
    operator,
    comparator,
  }: {
    filterField: number;
    operator: FilterOperator;
    comparator: number;
  }) => {
    if (!filterField) return false;
    if (typeof filterField !== 'number') return false;
    switch (operator) {
      case 'EQUAL':
        return filterField === comparator;
      case 'NOT_EQUAL':
        return filterField !== comparator;
      case 'GREATER_THAN':
        return filterField > comparator;
      case 'LESS_THAN':
        return filterField < comparator;
      case 'GREATER_THAN_OR_EQUAL':
        return filterField >= comparator;
      case 'LESS_THAN_OR_EQUAL':
        return filterField <= comparator;
      default:
        return false;
    }
  },

  dateCheck: ({
    filterField,
    operator,
    comparator,
  }: {
    filterField: string;
    operator: FilterOperator;
    comparator: string;
  }) => {
    if (!filterField) return false;
    const datesAreEqual = dateFns.isEqual(
      filterField,
      new Date(comparator).toDateString()
    );
    const dateIsAfter = dateFns.isAfter(
      filterField,
      new Date(comparator).toDateString()
    );
    const dateIsBefore = dateFns.isBefore(
      filterField,
      new Date(comparator).toDateString()
    );

    switch (operator) {
      case 'EQUAL':
        return datesAreEqual;
      case 'NOT_EQUAL':
        return !datesAreEqual;
      case 'GREATER_THAN':
        return dateIsAfter;
      case 'LESS_THAN':
        return dateIsBefore;
      default:
        return false;
    }
  },
  booleanCheck: ({
    filterField,
    operator,
    comparator,
  }: {
    filterField: boolean;
    operator: FilterOperator;
    comparator: unknown;
  }) => {
    switch (operator) {
      case 'IS':
        return filterField === Boolean(comparator);
      case 'IS_NOT':
        return filterField !== Boolean(comparator);
      default:
        return false;
    }
  },
};

export const constructWorkflowContextBluePrint = (
  blueprint: AutomationBlueprintWithRelations
) => {
  const { trigger, actions, ...blueprintInfo } = blueprint;
  const rootAction = actions[0];
  if (!rootAction)
    return {
      trigger,
      blueprintInfo,
      actions: {} as WorkflowContextWorkflowActionsShape,
    };
  const { subActions, ...rest } = rootAction;
  const workflowContextActions = {
    [rootAction.id]: rest as WorkflowContextAction,
  };

  function recurse({
    action,
    parentActionId,
  }: {
    action: AutomationAction;
    actionsObj?: WorkflowContextWorkflowActionsShape;
    parentActionId?: string;
  }) {
    const { subActions, ...rest } = action;
    action.parentActionId = parentActionId;
    workflowContextActions[action.id] = action as WorkflowContextAction;

    if (subActions?.length) {
      subActions.forEach((sub) => {
        recurse({
          action: sub,
          parentActionId: action.id,
        });
      });
    }
  }

  subActions.forEach((action) => {
    recurse({
      action,
      parentActionId: rootAction.id,
    });
  });

  return {
    trigger,
    blueprintInfo,
    actions: workflowContextActions,
  };
};
