'use client';

import type { WorkflowConditionGroup, WorkflowTrigger, UpdateTrigger } from '@mastra/core';
import { isValid } from 'date-fns';
import { Fragment, useEffect, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';

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
import { getFieldSchema, getTriggerOutputSchema, schemaToFilterOperator } from '../../utils';

import { renderConditionSubMenu } from './condition-filter-bar';

interface TriggerConditionFilterWithConj {
  conj: 'and' | 'or';
  parentCondition: WorkflowConditionGroup;
  condition: WorkflowConditionGroup;
}

interface TriggerConditionFilterWithoutConj {
  conj?: never;
  parentCondition?: never;
  condition: WorkflowConditionGroup;
}

type TriggerConditionFilterProps = {
  trigger: WorkflowTrigger;
  onUpdateTrigger: (updatedTrigger: UpdateTrigger) => void;
} & (TriggerConditionFilterWithConj | TriggerConditionFilterWithoutConj);

export const TriggerConditionFilterBar = ({
  trigger,
  onUpdateTrigger,
  condition,
  conj,
  parentCondition,
}: TriggerConditionFilterProps) => {
  const [openOperator, setOpenOperator] = useState(false);

  const handleUpdateCondition = (newCondition: Record<string, unknown>) => {
    let updatedCondition = { ...((condition as WorkflowConditionGroup) || {}), ...newCondition };
    if (conj) {
      const newConjConditions = parentCondition[conj]?.map(cond => {
        if (cond.id === condition.id) {
          return { ...cond, ...newCondition };
        }

        return cond;
      });

      updatedCondition = { ...parentCondition, [conj]: newConjConditions };
    }
    onUpdateTrigger({ condition: updatedCondition });
  };

  const handleRemoveCondition = () => {
    if (conj) {
      const newConjConditions = parentCondition[conj]?.filter(cond => cond.id !== condition.id);

      const updatedCondition = { ...parentCondition, [conj]: newConjConditions };
      onUpdateTrigger({ condition: updatedCondition });
    } else {
      let updatedCondition;
      const condExtra = condition.and || condition.or;
      const firstExtaCond = condExtra?.[0];
      if (firstExtaCond?.field) {
        const condConj = condition.and ? 'and' : 'or';
        const { id, actionId, ...rest } = firstExtaCond;
        updatedCondition = {
          ...condition,
          ...(rest as WorkflowConditionGroup),
          [condConj]: condExtra?.slice(1),
        };
      } else {
        updatedCondition = undefined;
      }

      onUpdateTrigger({ condition: updatedCondition });
    }
  };

  return (
    <TooltipProvider>
      <div className="border-mastra-border-2 divide-mastra-border-2 bg-mastra-bg-4 flex h-6 w-fit items-center divide-x-[0.5px] rounded-[0.25rem] border-[0.5px]">
        {/*this renders the field being used for the condition filter*/}
        <FilterFieldName
          field={condition?.field!}
          trigger={trigger}
          updateCondition={payload => {
            const rest = payload.field !== condition?.field ? { value: '', operator: '' } : {};
            handleUpdateCondition({ ...payload, ...rest });
            setOpenOperator(true);
          }}
        />
        {/*this renders the operator being used for the condition filter*/}
        <FilterOperator
          open={openOperator}
          setOpen={setOpenOperator}
          operator={condition.operator!}
          field={condition.field!}
          trigger={trigger}
          updateCondition={handleUpdateCondition}
        />

        {condition?.field &&
        condition?.operator !== FilterOpToValueMapEnum.SET &&
        condition?.operator !== FilterOpToValueMapEnum.NOT_SET ? (
          <>
            {/*this renders the condition filter value*/}
            <FilterValue
              value={condition.value as string}
              field={condition.field!}
              trigger={trigger}
              updateCondition={handleUpdateCondition}
            />
          </>
        ) : null}
        {!!condition?.field && (
          <IconButton
            icon="cancel"
            iconClassname="text-mastra-el-3 hover:text-mastra-el-6 transition-colors"
            className="flex h-full w-6 items-center justify-center rounded-l-none rounded-r p-1.5"
            onClick={handleRemoveCondition}
            aria-label="Clear all filters"
          />
        )}
      </div>
    </TooltipProvider>
  );
};

const FilterFieldName = ({
  field,
  trigger,
  updateCondition,
}: {
  field: string;
  updateCondition: ({ field }: { field: string }) => void;
  trigger: UpdateTrigger;
}) => {
  const { frameworkEvents } = useWorkflowContext();
  const systemObj = frameworkEvents?.find(sys => sys?.key === trigger?.type);

  const schema = getTriggerOutputSchema({
    block: systemObj!,
    payload: trigger?.payload!,
  });

  if (!systemObj) {
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

  //remove everything before the > and the >
  return (
    <Tooltip>
      <TooltipTrigger disabled={!constructFieldName}>
        <Dropdown>
          <Dropdown.Trigger asChild>
            <div
              role="button"
              className={cn(
                'text-mastra-el-6 flex h-full flex-shrink flex-nowrap items-center gap-2 text-ellipsis whitespace-nowrap rounded-l p-[0.31rem] px-1.5 text-xs font-medium capitalize opacity-80 transition-opacity hover:opacity-100',
                !field && 'rounded-r',
              )}
            >
              {formattedFieldName ? null : <Icon name="rule" />}

              {formattedFieldName || 'Add condition'}
            </div>
          </Dropdown.Trigger>

          {schema ? (
            <Dropdown.Content align="start" className="w-fit">
              <Dropdown.Label className="sr-only">Choose a field</Dropdown.Label>
              {Object.entries((schema as any)?.shape || {}).map(([name, schema]) => (
                <Fragment key={name}>
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
          ) : null}
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

const FilterOperator = ({
  operator,
  field,
  updateCondition,
  trigger,
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  operator: WorkflowConditionGroup['operator'];
  field: string;
  updateCondition: ({ operator }: { operator: string }) => void;
  trigger: WorkflowTrigger;
}) => {
  const { frameworkEvents } = useWorkflowContext();
  const systemObj = frameworkEvents?.find(sys => sys?.key === trigger?.type);

  const schema = getTriggerOutputSchema({
    block: systemObj!,
    payload: trigger?.payload!,
  });

  const systemField = getFieldSchema({ schema, field });

  if (!systemObj || !systemField || !field) {
    return null;
  }

  const fieldConfig = getFormConfigTypesFromSchemaDef({ schema: systemField });

  return (
    <Dropdown open={open} onOpenChange={setOpen}>
      <Dropdown.Trigger asChild>
        <div role="button" className="text-mastra-el-4 h-full min-w-[28px] flex-shrink-0 p-1 px-[0.38rem] text-xs">
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
  trigger,
}: {
  field: string;
  value: string;
  updateCondition: ({ value }: { value: string }) => void;
  trigger: WorkflowTrigger;
}) => {
  const [value, setValue] = useState(filterValue || '');
  const { frameworkEvents } = useWorkflowContext();
  const systemObj = frameworkEvents?.find(sys => sys?.key === trigger?.type);

  const schema = getTriggerOutputSchema({
    block: systemObj!,
    payload: trigger?.payload!,
  });

  const systemField = getFieldSchema({ schema, field });

  const handleUpdateValue = useDebouncedCallback(updateCondition, 1000);

  useEffect(() => {
    setValue(filterValue);
  }, [filterValue]);

  if (!systemObj || !systemField || !field) {
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
