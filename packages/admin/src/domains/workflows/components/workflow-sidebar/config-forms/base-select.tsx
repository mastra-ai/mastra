'use client';

import type { ActionVariables } from '@mastra/core';
import { useCallback, useEffect, useId, useState } from 'react';

import { Icon } from '@/components/icon';
import { Button } from '@/components/ui/button';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Text } from '@/components/ui/text';

import { lodashTitleCase, toTitleCase } from '@/lib/string';
import { cn } from '@/lib/utils';

import useVariables from '@/domains/workflows/hooks/use-manage-variables';

import VariableBadgeList from '../../utils/variable-badge-list';

function BaseSelect({
  allOptions = [],
  field,
  fieldValue,
  canUseVariables,
  initialVariables,
  selected,
  onSelect,
  withoutClearSelection,
}: {
  allOptions: { label: string; value: string }[];
  field: string;
  selected?: string;
  canUseVariables?: boolean;
  initialVariables?: ActionVariables;
  fieldValue: any;
  onSelect: (arg0: { key: string; value?: string; variables?: ActionVariables }) => void;
  withoutClearSelection?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(selected);
  const isVariableOptionSelected = value?.startsWith('{{') && value.endsWith('}}');

  const cb = useCallback(
    ({ variablePayload }: { variablePayload: ActionVariables }) =>
      onSelect({ key: field, value, variables: variablePayload }),
    [field, value],
  );
  const { variables, variablePayload, handleUpdateVariablePayload, updateVariables } = useVariables({
    initialVariables,
    fieldValue: fieldValue,
    cb,
  });

  useEffect(() => {
    updateVariables(value || '');
  }, [value]);

  function getValueLabel(value: string = '') {
    if (isVariableOptionSelected) return `Variable`;
    return allOptions?.find(opt => opt.value === value)?.label || '';
  }

  const valueLabel = getValueLabel(value);

  const id = useId();

  return (
    <div className="flex flex-col gap-2">
      <Popover key={id} open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            role="combobox"
            variant="ghost"
            className={cn(
              'border-mastra-border-7 border-[0.5px] h-8 justify-between border-solid bg-[rgba(217,217,217,0.03)] text-sm opacity-80 transition-opacity hover:opacity-100',
            )}
          >
            {!!valueLabel ? (
              <Text size="xs" className=" text-mastra-el-6">
                {toTitleCase(valueLabel || '')}
              </Text>
            ) : (
              <Text size="xs" className="text-mastra-el-6">
                Choose {lodashTitleCase(field.split('.').pop() || '')}
              </Text>
            )}
            <Icon name="down-caret" className="text-icon-dim h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="border-1 border-neutral-750 bg-neutral-750/50 w-[var(--radix-popover-trigger-width)] p-0 backdrop-blur-md">
          <Command
            value={value}
            filter={(value, search) => {
              const label = getValueLabel(value).toLowerCase();
              if (label.includes(search.toLowerCase())) return 1;
              return 0;
            }}
          >
            <CommandInput placeholder="Find..." className="h-9 placeholder:text-neutral-500" />
            {!allOptions?.length && !value && (
              <div className="grid h-[5rem] w-full place-items-center">
                <span className="text-mastra-el-4 text-[0.85rem]">No Options</span>
              </div>
            )}
            <CommandGroup className="max-h-[50vh] overflow-auto">
              {!withoutClearSelection && !value && (
                <CommandList>
                  <CommandItem
                    key={`clear-selection`}
                    value="vvv"
                    className="group mt-0.5 flex w-full !cursor-pointer justify-between gap-2 first:mt-0"
                    onSelect={e => {
                      setOpen(false);
                      setValue('');
                      onSelect({ key: field, value: '' });
                    }}
                  >
                    <span>Clear selection</span>
                    <Icon className="text-mastra-el-3 group-hover:text-mastra-el-6 transition-colors" name="cancel" />
                  </CommandItem>
                </CommandList>
              )}
              <CommandList>
                {(allOptions || [])?.map(opt => {
                  return (
                    <CommandItem
                      value={opt.value}
                      key={opt.value}
                      className="group mt-0.5 flex w-full !cursor-pointer gap-2 first:mt-0"
                      onSelect={e => {
                        setOpen(false);
                        setValue(opt.value);
                        onSelect({ key: field, value: opt.value });
                      }}
                    >
                      <span>{toTitleCase(opt.label)}</span>
                    </CommandItem>
                  );
                })}
              </CommandList>
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
      {canUseVariables && (
        <VariableBadgeList
          className="mt-0"
          handleUpdateVariablePayload={handleUpdateVariablePayload}
          variablePayload={variablePayload}
          variables={variables}
        />
      )}
      {canUseVariables && (
        <Button
          type="button"
          onClick={e => {
            e.stopPropagation();
            setOpen(false);
            setValue(`{{${field}}}`);
            onSelect({ key: field, value: `{{${field}}}` });
          }}
          className="group flex w-max items-center gap-1 rounded bg-white/[0.025] p-1"
          variant={'secondary'}
        >
          <span className="text-white/70 transition-colors duration-150 ease-in-out group-hover:text-white/80">{`{{}}`}</span>
          <span className="text-[0.75rem] text-white/30 transition-colors duration-150 ease-in-out group-hover:text-white/80">
            use variables
          </span>
        </Button>
      )}
    </div>
  );
}

export default BaseSelect;
