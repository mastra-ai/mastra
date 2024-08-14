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

import flatten from 'lodash/flatten';
import last from 'lodash/last';

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

export const blockStyles = {
  default: 'border-[0.5px] border-solid rounded-md relative border-kp-border-1',
  states: 'hover:border-kp-border-5 focus:border-kp-border-5',
  header: 'p-3 text-[13px] flex gap-3 items-center',
  details:
    'bg-neutral-800 rounded-b-md p-3 text-[10px] text-left text-neutral-300',
};

// export const constructBluePrint = ({
//   blueprintInfo,
//   actions,
//   trigger,
// }: Pick<WorkflowContextProps, 'blueprintInfo' | 'actions' | 'trigger'>) => {
//   const parentAction = Object.values(actions).find(action => !action.parentActionId);
//   if (!parentAction) return { ...blueprintInfo, trigger, actions: [] as AutomationAction[] };

//   const blueprint = { ...blueprintInfo, trigger, actions: [parentAction] as AutomationAction[] };

//   for (const key in actions) {
//     const currentAction = actions[key] as AutomationAction;
//     const subActions = Object.values(actions).filter(sub => sub.parentActionId === currentAction.id);
//     currentAction.subActions = [...subActions] as AutomationAction[];
//   }

//   return blueprint;
// };

// export const constructWorkflowContextBluePrint = (blueprint: AutomationBlueprintWithRelations) => {
//   const { trigger, actions, ...blueprintInfo } = blueprint;
//   const rootAction = actions[0];
//   if (!rootAction) return { trigger, blueprintInfo, actions: {} as WorkflowContextProps['actions'] };
//   const { subActions, ...rest } = rootAction;
//   const workflowContextActions = {
//     [rootAction.id]: rest as WorkflowContextAction,
//   };

//   function recurse({
//     action,
//     parentActionId,
//   }: {
//     action: AutomationAction;
//     actionsObj?: WorkflowContextProps['actions'];
//     parentActionId?: string;
//   }) {
//     const { subActions, ...rest } = action;
//     action.parentActionId = parentActionId;
//     workflowContextActions[action.id] = action as WorkflowContextAction;

//     if (subActions?.length) {
//       subActions.forEach(sub => {
//         recurse({
//           action: sub,
//           parentActionId: action.id,
//         });
//       });
//     }
//   }

//   subActions.forEach(action => {
//     recurse({
//       action,
//       parentActionId: rootAction.id,
//     });
//   });

//   return {
//     trigger,
//     blueprintInfo,
//     actions: workflowContextActions,
//   };
// };

// export const schemaToFilterOperator = (schema: ZodTypeAny): FilterOperator[] => {
//   if (schema instanceof ZodString) {
//     return filterFieldTypeToOperatorMap['SINGLE_LINE_TEXT'];
//   } else if (schema instanceof ZodNumber) {
//     return filterFieldTypeToOperatorMap['CURRENCY'];
//   } else if (schema instanceof ZodDate) {
//     return filterFieldTypeToOperatorMap['DATE'];
//   } else if (schema instanceof ZodEnum || (schema instanceof ZodArray && schema.element instanceof ZodEnum)) {
//     return filterFieldTypeToOperatorMap['MULTI_SELECT'];
//   } else if (schema instanceof ZodOptional) {
//     return schemaToFilterOperator(schema._def.innerType);
//   } else {
//     return filterFieldTypeToOperatorMap['SINGLE_LINE_TEXT'];
//   }
// };

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

// export const isConditionValid = (cond: AutomationLogicConditionGroup) => {
//   const valueCheck =
//     cond.operator === FilterOpToValueMapEnum.SET || cond.operator === FilterOpToValueMapEnum.NOT_SET
//       ? true
//       : !!cond.value;

//   return !!cond.automationBlockId && !!cond.field && valueCheck;
// };

// export const isActionPayloadValid = ({
//   action,
//   block,
// }: {
//   action: AutomationAction;
//   block: RefinedIntegrationAction;
// }) => {
//   const { type, payload, variables } = action;

//   if (type === 'CONDITIONS') {
//     const atLeastOneConditionHasActions = (action?.condition as AutomationLogicConditionGroup[])
//       ?.filter(cd => !cd.isDefault)
//       ?.every(cond => isConditionValid(cond));
//     return {
//       isValid: atLeastOneConditionHasActions && action.subActions?.length > 0,
//       message: 'Multi branch requires paths with defined conditions and linked actions',
//     };
//   }

//   if (!payload || !type) return { isValid: false, message: 'Has unfilled required input(s)' };

//   const schema = getSchemaClient({ block, payload, blockType: 'action' });

//   const result = schema.safeParse(payload);

//   const flattenPayload = flattenObject(payload, [], true);

//   if (result.error) {
//     const transformedErr = transformToNestObject(result.error);
//     const errorHasVariable = Object.entries(transformedErr).every(([key, value]) =>
//       typeof flattenPayload[key] === 'string' ? (flattenPayload[key] as string)?.includes('{{') : false,
//     );
//     if (!errorHasVariable) {
//       return { isValid: false, message: 'Has unfilled required input(s)' };
//     }
//   }

//   if (variables) {
//     const payloadHasVariable = Object.values(flattenPayload)?.some(val =>
//       typeof val === 'string' ? (val as string)?.includes('{{') : false,
//     );

//     if (!payloadHasVariable) return { isValid: true, message: '' };

//     const message = 'Has unmapped variables';

//     if (!Object.keys(variables)?.length) return { isValid: false, message };

//     const flattenedVariables = flattenObject(variables, ['path', 'refBlockId']);

//     const flattenedPayloadVariables = Object.values(flattenPayload).map(val => {
//       const extractedVariables = extractVariables(val as string);
//       return extractedVariables?.map(v => last(v?.split('.')) as string);
//     });

//     const payloadVariables = flatten(flattenedPayloadVariables);
//     const variablesOnly = Object.entries(flattenedVariables)
//       .map(([key, value]) => {
//         const newKey = last(key.split('.')) as string;
//         return { newKey, value };
//       })
//       ?.reduce((a, b) => ({ ...a, [b.newKey]: b.value }), {} as Record<string, unknown>);

//     const allVariablesMapped = payloadVariables?.every(
//       pp => (variablesOnly[pp] as ActionVariable)?.path && (variablesOnly[pp] as ActionVariable)?.refBlockId,
//     );

//     return { isValid: allVariablesMapped, message };
//   }

//   return { isValid: true, message: '' };
// };

// export const isTriggerPayloadValid = ({
//   trigger,
//   block,
// }: {
//   trigger: AutomationTrigger;
//   block: RefinedIntegrationEventTriggerProperties;
// }) => {
//   const { type, payload } = trigger;

//   if (!type) return false;

//   const schema = getSchemaClient({ block, payload: payload!, blockType: 'trigger' });

//   const result = schema?.safeParse(payload?.value);

//   if (result?.error) {
//     return false;
//   }

//   return true;
// };

// export const getFieldSchema = ({ schema, field }: { schema: z.ZodSchema<unknown>; field: string }) => {
//   let fields = field?.split('.') || [];
//   let fieldSchema = schema;
//   let index = 0;

//   while (fieldSchema instanceof z.ZodObject && index < fields.length) {
//     fieldSchema = (fieldSchema as any)?.shape?.[fields[index]];
//     index++;
//   }

//   return fieldSchema;
// };

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

// export const transformToNestObject = (error: z.ZodError): FieldErrors => {
//   const fieldErrors: FieldErrors = {};
//   error.errors.forEach(err => {
//     if (err.path.length > 0) {
//       const path = err.path.join('.');
//       fieldErrors[path] = {
//         type: 'validation',
//         message: err.message,
//       };
//     }
//   });
//   return fieldErrors;
// };

// export const customZodResolver = (schemaUnion: ZodTypeAny, discriminator: string): Resolver<any> => {
//   return async values => {
//     //get schema based on discriminator
//     const schema =
//       schemaUnion?._def?.options?.find(
//         (option: any) => option?.shape?.[discriminator]?._def?.value === values[discriminator],
//       ) || z.object({ [discriminator]: z.string() });

//     // Filter out keys that are not in the schema
//     const filteredValues = Object.fromEntries(Object.entries(values).filter(([key]) => (schema as any)?.shape?.[key]));

//     const result = schema.safeParse(filteredValues);

//     if (result.success) {
//       return { values: result.data, errors: {} };
//     } else {
//       const errors = transformToNestObject(result.error);
//       return { values: {}, errors };
//     }
//   };
// };

// export function extractVariables(value: string | string[]) {
//   const regex = /\{\{([\w._]+)\}\}/g; // supporting only text matches
//   const matches = [];
//   let match;

//   if (Array.isArray(value)) {
//     value.forEach(val => {
//       const nestedMatches = extractVariables(val);
//       matches.push(...nestedMatches);
//     });
//   } else {
//     while ((match = regex.exec(value)) !== null) {
//       matches.push(match[1]);
//     }
//   }
//   return matches;
// }

// type RecordTypePayloadValue = { recordType: ObjectCategory };

// export const getBlockIconAndTitle = ({
//   block,
//   blockDescription,
// }: {
//   block: AutomationTrigger | AutomationAction;
//   blockDescription?: string;
// }) => {
//   if (block?.type?.toLocaleLowerCase()?.includes('record')) {
//     if (block?.payload) {
//       const { recordType } = (block.payload?.value || block.payload || {}) as RecordTypePayloadValue;
//       const blockTitle = block.type.split('_')?.join(' ')?.toLocaleLowerCase();
//       const recordTypeTitle = getSingularOrPluralRecordTypeBasedOnRecordsCount(recordType);
//       const title = recordTypeTitle ? blockTitle?.replace('record', recordTypeTitle) : '';
//       const description =
//         recordTypeTitle && blockDescription ? blockDescription?.replace('record', recordTypeTitle) : blockDescription;
//       const icon = srtToIcon[recordType];

//       return {
//         title,
//         description,
//         icon: { type: 'system', icon, alt: `${recordTypeTitle} icon` } as frameWorkIcon,
//         recordTypeTitle,
//       };
//     }
//   }

//   return {
//     title: '',
//     description: blockDescription,
//     icon: null,
//     recordTypeTitle: '',
//   };
// };

// export const pathAlphabet = 'abcdefghijklmnopqrstuvwxyz'.toUpperCase().split('');

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
