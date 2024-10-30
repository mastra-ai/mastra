'use client';

import type {
  RefinedIntegrationApi,
  RefinedIntegrationEvent,
  WorkflowAction,
  WorkflowConditionGroup,
  WorkflowLogicConditionGroup,
  WorkflowParentBlocks,
  WorkflowTrigger,
} from '@mastra/core';
import { isValid } from 'date-fns';
import { Fragment, useEffect, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { ZodObject, ZodOptional, ZodSchema } from 'zod';

import { Icon } from '@/components/icon';
import { DatePicker } from '@/components/ui/date-picker';
import { Dropdown } from '@/components/ui/dropdown-menu';
import IconButton from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { formatDate } from '@/lib/date';
import { lodashTitleCase, truncateText } from '@/lib/string';
import { cn } from '@/lib/utils';

import { useWorkflowContext } from '../../context/workflow-context';
import { FormConfigType, getFormConfigTypesFromSchemaDef } from '../../schema';
import {
  FilterOperator as FilterOperatorType,
  FilterOperatorEnum,
  operatorToIconMap,
  FilterOpToValueMapEnum,
} from '../../types';
import {
  getAllParentBlocks,
  getFieldSchema,
  getActionOutputSchema,
  getTriggerOutputSchema,
  schemaToFilterOperator,
} from '../../utils';

interface ConditionFilterWithConj {
  conj: 'and' | 'or';
  parentCondition: WorkflowLogicConditionGroup;
  condition: WorkflowConditionGroup;
  isLastCondition?: never;
}

interface ConditionFilterWithoutConj {
  conj?: never;
  parentCondition?: never;
  condition: WorkflowLogicConditionGroup;
  isLastCondition: boolean;
}

type ConditionFilterProps = {
  action: WorkflowAction;
} & (ConditionFilterWithConj | ConditionFilterWithoutConj);

export const ConditionFilterBar = ({
  action,
  condition,
  conj,
  parentCondition,
  isLastCondition,
}: ConditionFilterProps) => {
  const { actions, trigger, updateLogicActionCondition, updateAction, blueprintInfo } = useWorkflowContext();
  const { blockId } = condition;
  const selectedBlock =
    trigger.id === blockId ? (trigger as WorkflowTrigger) : (actions[blockId || ''] as WorkflowAction);

  const [openField, setOpenField] = useState(false);
  const [openOperator, setOpenOperator] = useState(false);

  const parentBlocks = getAllParentBlocks({ actions, actionId: action.id, trigger });

  const selectedBlockType = parentBlocks?.find(({ id }) => id === selectedBlock?.id)?.blockType;

  const handleUpdateCondition = (newCondition: Record<string, unknown>) => {
    let updatedCondition = { ...(condition as WorkflowLogicConditionGroup), ...newCondition };
    if (conj) {
      const newConjConditions = parentCondition[conj]?.map(cond => {
        if (cond.id === condition.id) {
          return { ...cond, ...newCondition };
        }

        return cond;
      });

      updatedCondition = { ...parentCondition, [conj]: newConjConditions };
    }
    updateLogicActionCondition({
      actionId: action.id,
      condition: updatedCondition,
      isNewCondition: false,
    });
  };

  const handleRemoveCondition = () => {
    if (conj) {
      const newConjConditions = parentCondition[conj]?.filter(cond => cond.id !== condition.id);

      const updatedCondition = { ...parentCondition, [conj]: newConjConditions };
      updateLogicActionCondition({ actionId: action.id, condition: updatedCondition });
    } else {
      let updatedConditions = action.condition as WorkflowLogicConditionGroup[];
      const condExtra = condition.and || condition.or;
      const firstExtraCond = condExtra?.[0];
      if (firstExtraCond?.blockId) {
        updatedConditions = updatedConditions?.map(cond => {
          if (cond.id === condition.id) {
            const condConj = condition.and ? 'and' : 'or';
            const { id, actionId, ...rest } = firstExtraCond;

            return {
              ...condition,
              ...(rest as WorkflowLogicConditionGroup),
              [condConj]: condExtra?.slice(1),
            };
          }

          return cond;
        });
      } else {
        updatedConditions = updatedConditions?.map(cond => {
          if (cond.id === condition.id) {
            cond.blockId = '';
            cond.field = '';
            cond.operator = '';
            cond.value = '';
            cond.and = undefined;
            cond.or = undefined;
          }

          return cond;
        });
      }

      updateAction({ ...action, condition: updatedConditions });
    }
  };

  useEffect(() => {
    if (isLastCondition) {
      const { blockId, field } = condition;
      if (blockId && !field) {
        setOpenField(true);
      }
    }
  }, [isLastCondition, condition]);

  return (
    <TooltipProvider>
      <div className="inline-block">
        <div className="border-mastra-border-2 bg-mastra-bg-4 flex h-6 w-fit items-center rounded-[0.25rem] border-[0.5px]">
          {/*this renders the action/trigger block being used for the condition filter*/}

          <FilterFieldAction
            parentBlocks={parentBlocks}
            selectedBlock={selectedBlock}
            updateCondition={payload => {
              const rest = payload.blockId !== condition?.blockId ? { field: '', value: '', operator: '' } : {};
              handleUpdateCondition({ ...payload, ...rest });
              setOpenField(true);
            }}
            selectedBlockType={selectedBlockType!}
          />

          {/*this renders the field being used for the condition filter*/}
          <FilterFieldName
            open={openField}
            setOpen={setOpenField}
            field={condition.field!}
            selectedBlock={selectedBlock}
            updateCondition={payload => {
              const rest = payload.field !== condition?.field ? { value: '', operator: '' } : {};
              handleUpdateCondition({ ...payload, ...rest });
              setOpenOperator(true);
            }}
            selectedBlockType={selectedBlockType!}
          />
          {/*this renders the operator being used for the condition filter*/}
          <FilterOperator
            open={openOperator}
            setOpen={setOpenOperator}
            operator={condition.operator!}
            field={condition.field!}
            selectedBlock={selectedBlock}
            updateCondition={handleUpdateCondition}
            selectedBlockType={selectedBlockType!}
          />
          {/*this renders the condition filter value*/}
          {condition?.operator !== FilterOpToValueMapEnum.NOT_SET &&
            condition?.operator !== FilterOpToValueMapEnum.SET && (
              <FilterValue
                value={condition.value as string}
                field={condition.field!}
                selectedBlock={selectedBlock}
                updateCondition={handleUpdateCondition}
                selectedBlockType={selectedBlockType!}
              />
            )}
          {selectedBlock ? (
            <IconButton
              icon="cancel"
              className="flex h-full w-6 items-center justify-center rounded-l-none rounded-r bg-[#2A2A2A] p-1.5"
              onClick={handleRemoveCondition}
              aria-label="Clear all filters"
            />
          ) : null}
        </div>
      </div>
    </TooltipProvider>
  );
};

const FilterFieldAction = ({
  parentBlocks,
  selectedBlock,
  updateCondition,
  selectedBlockType,
}: {
  parentBlocks: WorkflowParentBlocks;
  selectedBlock: WorkflowAction | WorkflowTrigger;
  updateCondition: ({ blockId }: { blockId: string }) => void;
  selectedBlockType: 'action' | 'trigger';
}) => {
  const { frameworkApis, frameworkEvents } = useWorkflowContext();
  const systemData = selectedBlockType === 'action' ? frameworkApis : frameworkEvents;
  const selected = {
    id: selectedBlock?.id, //@ts-ignore
    name: systemData?.find(sys => sys?.type === selectedBlock?.type)?.label || lodashTitleCase(selectedBlock?.type),
  };

  const options = parentBlocks?.map(block => {
    let name = lodashTitleCase(block?.type);

    if (block.blockType === 'action') {
      name = frameworkApis?.find(sys => sys?.type === block.type)?.label as string;
    } else {
      name = frameworkEvents?.find(sys => sys?.key === block.type)?.label as string;
    }
    return {
      id: block.id,
      name,
      type: block.blockType,
    };
  });

  return (
    <Tooltip>
      <TooltipTrigger disabled={!selected?.name}>
        <Dropdown>
          <Dropdown.Trigger asChild>
            <div
              role="button"
              className={cn(
                'border-r-mastra-border-2 flex h-full flex-shrink flex-nowrap items-center gap-2 text-ellipsis whitespace-nowrap rounded-l border-r-[0.5px] p-1 text-xs font-medium',
                !selectedBlock && 'rounded-r',
              )}
            >
              {truncateText(selected?.name || '', 6) || 'Add Filter'}
            </div>
          </Dropdown.Trigger>
          <Dropdown.Content align="start" className="w-fit">
            <Dropdown.Label className="sr-only">Add Filter</Dropdown.Label>
            {options.map(({ id, name, type }) => (
              <Dropdown.Item
                key={id}
                onClick={() => {
                  id !== selected.id && updateCondition({ blockId: id });
                }}
              >
                <span className="text-sm font-medium capitalize">
                  {name} ({type})
                </span>
                {id === selected?.id ? (
                  <Icon name="check-in-circle" className="text-accent-1 ml-auto text-base" />
                ) : null}
              </Dropdown.Item>
            ))}
          </Dropdown.Content>
        </Dropdown>
      </TooltipTrigger>
      {selected?.name ? (
        <TooltipContent side="top" className="bg-dialog-bg rounded-md p-1 px-3">
          {selected?.name}
        </TooltipContent>
      ) : null}
    </Tooltip>
  );
};

const FilterFieldName = ({
  field,
  selectedBlock,
  updateCondition,
  open,
  setOpen,
  selectedBlockType,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  field: string;
  updateCondition: ({ field }: { field: string }) => void;
  selectedBlock: WorkflowAction | WorkflowTrigger;
  selectedBlockType: 'action' | 'trigger';
}) => {
  const { frameworkApis, frameworkEvents } = useWorkflowContext();
  const systemData = selectedBlockType === 'action' ? frameworkApis : frameworkEvents;
  //@ts-ignore
  const systemObj = systemData?.find(sys => sys?.type === selectedBlock?.type);

  const schema =
    selectedBlockType === 'action'
      ? getActionOutputSchema({
          block: systemObj! as RefinedIntegrationApi,
          payload: selectedBlock?.payload!,
        })
      : getTriggerOutputSchema({
          block: systemObj! as RefinedIntegrationEvent,
          payload: selectedBlock?.payload!,
        });

  if (!systemObj || !schema) {
    return null;
  }

  const constructFieldName = field
    ?.split('.')
    ?.map(name => lodashTitleCase(name))
    ?.join(' > ');

  function removeDataPrefix(text: string) {
    return text?.replace('Data > ', '');
  }

  const formattedFieldName = truncateText(removeDataPrefix(constructFieldName));

  return (
    <Tooltip>
      <TooltipTrigger disabled={!constructFieldName}>
        <Dropdown open={open} onOpenChange={setOpen}>
          <Dropdown.Trigger asChild>
            <div className="rounded-0 border-r-mastra-border-2 text-mastra-el-6 flex h-full flex-shrink-0 flex-nowrap items-center gap-2 whitespace-nowrap border-r-[0.5px] p-1 text-xs font-medium capitalize">
              {formattedFieldName || 'Select field'}
            </div>
          </Dropdown.Trigger>
          <Dropdown.Content align="start" className="w-fit">
            <Dropdown.Label className="sr-only">Choose a field</Dropdown.Label>
            {Object.entries((schema as any)?.shape || {}).map(([name, schema]) => (
              <Fragment key={`${field}-${name}`}>
                {renderConditionSubMenu({
                  title: name,
                  currentField: field,
                  path: [name],
                  updateCondition,
                  schema: schema as any,
                })}
              </Fragment>
            ))}
          </Dropdown.Content>
        </Dropdown>
      </TooltipTrigger>
      {constructFieldName ? (
        <TooltipContent side="top" className="bg-dialog-bg rounded-md p-1 px-3">
          {constructFieldName}
        </TooltipContent>
      ) : null}
    </Tooltip>
  );
};

export function renderConditionSubMenu({
  title,
  schema,
  currentField,
  path,
  updateCondition,
}: {
  title: string;
  path: string[];
  currentField: string;
  schema: ZodSchema<unknown>;
  updateCondition: ({ field }: { field: string }) => void;
}) {
  if (schema instanceof ZodOptional) {
    return renderConditionSubMenu({
      title,
      currentField,
      path,
      updateCondition,
      schema: schema?._def?.innerType as any,
    });
  }
  if (!(schema instanceof ZodObject)) {
    const checked = currentField === path.join('.');

    return (
      <Dropdown.Item
        onClick={() => {
          updateCondition({ field: path.join('.') });
        }}
      >
        <span className="text-sm font-medium capitalize">{lodashTitleCase(title)}</span>
        {checked ? <Icon name="check-in-circle" className="text-accent-1 ml-auto text-base" /> : null}
      </Dropdown.Item>
    );
  }

  return (
    <Dropdown.Sub>
      <Dropdown.SubTrigger>{lodashTitleCase(title)}</Dropdown.SubTrigger>
      <Dropdown.Portal>
        <Dropdown.SubContent>
          {Object.entries((schema as any)?.shape || {}).map(([field, schema]) => {
            const newPath = [...path, field];
            const checked = currentField === newPath.join('.');

            if (schema instanceof ZodObject) {
              return (
                <Fragment key={`${field}-${currentField}`}>
                  {renderConditionSubMenu({
                    title: field,
                    schema,
                    currentField,
                    path: newPath,
                    updateCondition,
                  })}
                </Fragment>
              );
            }

            return (
              <Dropdown.Item
                key={field}
                onClick={() => {
                  updateCondition({ field: newPath.join('.') });
                }}
              >
                <span className="text-sm font-medium capitalize">{lodashTitleCase(field)}</span>
                {checked ? <Icon name="check-in-circle" className="text-accent-1 ml-auto text-base" /> : null}
              </Dropdown.Item>
            );
          })}
        </Dropdown.SubContent>
      </Dropdown.Portal>
    </Dropdown.Sub>
  );
}

const FilterOperator = ({
  operator,
  field,
  updateCondition,
  selectedBlock,
  open,
  setOpen,
  selectedBlockType,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  operator: string;
  field: string;
  updateCondition: ({ operator }: { operator: string }) => void;
  selectedBlock: WorkflowAction | WorkflowTrigger;
  selectedBlockType: 'action' | 'trigger';
}) => {
  const { frameworkApis, frameworkEvents } = useWorkflowContext();
  const systemData = selectedBlockType === 'action' ? frameworkApis : frameworkEvents;
  //@ts-ignore
  const systemObj = systemData?.find(sys => sys?.type === selectedBlock?.type);

  const schema =
    selectedBlockType === 'action'
      ? getActionOutputSchema({
          block: systemObj! as RefinedIntegrationApi,
          payload: selectedBlock?.payload!,
        })
      : getTriggerOutputSchema({
          block: systemObj! as RefinedIntegrationEvent,
          payload: selectedBlock?.payload!,
        });

  const systemField = getFieldSchema({ schema, field });

  if (!systemObj || !systemField) {
    return null;
  }

  const fieldConfig = getFormConfigTypesFromSchemaDef({ schema: systemField });

  return (
    <Dropdown open={open} onOpenChange={setOpen}>
      <Dropdown.Trigger asChild>
        <div role="button" className="text-mastra-el-4 h-full min-w-[28px] flex-shrink-0 p-1 text-xs">
          {FilterOperatorEnum[operator?.toUpperCase() as FilterOperatorType]}
        </div>
      </Dropdown.Trigger>
      <Dropdown.Content align="start" className="w-fit">
        <Dropdown.Label className="sr-only">Choose a filter operator</Dropdown.Label>
        {schemaToFilterOperator(fieldConfig.type).map(op => (
          <Dropdown.Item
            key={op}
            onClick={() => {
              updateCondition({ operator: op });
            }}
          >
            <Icon name={operatorToIconMap[op]} className="text-icon w-2.5" />
            <span className="text-sm font-medium">{FilterOperatorEnum[op]}</span>
            {operator === op ? <Icon name="check-in-circle" className="text-accent-1 ml-auto text-base" /> : null}
          </Dropdown.Item>
        ))}
      </Dropdown.Content>
    </Dropdown>
  );
};

const FilterValue = ({
  field,
  value: filterValue,
  updateCondition,
  selectedBlock,
  selectedBlockType,
}: {
  field: string;
  value: string;
  updateCondition: ({ value }: { value: string }) => void;
  selectedBlock: WorkflowAction | WorkflowTrigger;
  selectedBlockType: 'action' | 'trigger';
}) => {
  const [value, setValue] = useState(filterValue || '');
  const { frameworkApis, frameworkEvents } = useWorkflowContext();
  const systemData = selectedBlockType === 'action' ? frameworkApis : frameworkEvents;
  //@ts-ignore
  const systemObj = systemData?.find(sys => sys?.type === selectedBlock?.type);

  const schema =
    selectedBlockType === 'action'
      ? getActionOutputSchema({
          block: systemObj! as RefinedIntegrationApi,
          payload: selectedBlock?.payload!,
        })
      : getTriggerOutputSchema({
          block: systemObj! as RefinedIntegrationEvent,
          payload: selectedBlock?.payload!,
        });

  const systemField = getFieldSchema({ schema, field });

  const handleUpdateValue = useDebouncedCallback(updateCondition, 1000);

  useEffect(() => {
    setValue(filterValue);
  }, [filterValue]);

  if (!systemObj || !systemField) {
    return null;
  }

  const fieldConfig = getFormConfigTypesFromSchemaDef({ schema: systemField });

  if (fieldConfig.type === FormConfigType.DATE) {
    const date = new Date(value);
    const isValidDate = isValid(date);
    return (
      <DatePicker
        value={isValidDate ? date : undefined}
        setValue={date => {
          if (date) {
            setValue(date.toDateString());
            updateCondition({ value: date.toDateString() });
          }
        }}
      >
        <Input
          value={isValidDate ? formatDate(date, { month: 'short' }) || '' : ''}
          placeholder="Date"
          type="text"
          className="border-l-mastra-border-2 h-full max-w-[100px] rounded-none border-b-0 border-l-[0.5px] border-t-0 bg-transparent"
        />
      </DatePicker>
    );
  }

  return (
    <Input
      value={value}
      type={fieldConfig.type === FormConfigType.NUMBER ? 'number' : 'text'}
      onChange={e => {
        setValue(e.target.value);
        handleUpdateValue({
          value: e.target.value,
        });
      }}
      onKeyDown={e => {
        if (((e.ctrlKey || e.metaKey) && e.key === 'Enter') || e.key === 'Enter') {
          updateCondition({ value });
        }
      }}
      placeholder={fieldConfig.type === FormConfigType.NUMBER ? 'Number' : 'Text'}
      className="border-l-mastra-border-2 h-full max-w-[100px] rounded-none border-b-0 border-l-[0.5px] border-t-0 bg-transparent"
    />
  );
};
