'use client';

import type { ActionVariables } from '@mastra/core';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Icon } from '@/components/icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import IconButton from '@/components/ui/icon-button';
import SelectDropDown from '@/components/ui/select-dropdown';

import { lodashTitleCase } from '@/lib/string';
import { cn } from '@/lib/utils';

import useVariables from '@/domains/workflows/hooks/use-manage-variables';

import VariableBadgeList from '../../utils/variable-badge-list';

function MultiSelect({
  options,
  field,
  onSelect,
  selected,
  canUseVariables = true,
  initialVariables,
}: {
  options: { label: string; value: string }[];
  field: any;
  onSelect: any;
  selected?: string[];
  canUseVariables?: boolean;
  initialVariables?: ActionVariables;
}) {
  const [selectedValues, setSelectedValues] = useState((selected || []).map(value => ({ id: value, name: value })));

  const cb = useCallback(
    ({ variablePayload }: { variablePayload: ActionVariables }) =>
      onSelect({ key: field.name, value: formatSelection(), variables: variablePayload }),
    [field.name, formatSelection],
  );

  const { variables, variablePayload, handleUpdateVariablePayload, updateVariables } = useVariables({
    initialVariables,
    fieldValue: field.value,
    cb,
  });

  const allOptions = options.length ? options : [];

  const variableSelections = useMemo(() => {
    return selectedValues?.filter(value => value?.id?.includes('{{') && value?.id?.includes('}}'));
  }, [selectedValues]);

  const totalVariablesSelection = variableSelections.length;

  function formatSelection() {
    return selectedValues.map((value: any) => {
      return value.id;
    });
  }

  useEffect(() => {
    updateVariables(variableSelections.map(value => value.id));
  }, [variableSelections]);

  const mappedValues = allOptions.map(value => {
    return {
      id: value.value,
      name: value.label,
    };
  });

  return (
    <SelectDropDown
      placeholder={`Add ${lodashTitleCase(field.name)}`}
      data={mappedValues as any}
      selectedValues={selectedValues}
      setSelectedValues={newValues => {
        setSelectedValues(newValues);
        onSelect({
          key: field.name,
          value: newValues.map((value: any) => {
            return value.id;
          }),
        });
      }}
      emptyMessage={`No options found.`}
    >
      <div className="w-full">
        {!selectedValues.length ? (
          <Button
            type="button"
            role="combobox"
            variant={'outline'}
            className={cn(
              'ring-white/[0.05] w-full bg-transparent text-text-dim h-8 justify-between text-[0.75rem] ring-[0.5px]',
            )}
          >
            Add {lodashTitleCase(field.name.split('.').pop() || '')}
            <Icon name="down-caret" className="text-icon h-3.5 w-3.5" />
          </Button>
        ) : (
          <div className=" min-h-8 relative flex h-auto w-full max-w-full flex-wrap items-center gap-1 overflow-auto rounded px-2 py-1 ring-1 ring-white/[0.05]">
            {selectedValues.map((value, idx) => (
              <Badge
                key={idx}
                variant={'secondary'}
                className="flex h-[1.5rem] max-w-[5.5rem] items-center gap-1 rounded px-1"
                onClick={e => e.stopPropagation()}
              >
                <span className="truncate whitespace-nowrap text-[0.675rem]">{value.name}</span>
                <IconButton
                  onClick={() => {
                    setSelectedValues(selectedValues.filter(selectedValue => selectedValue.id !== value.id));
                    onSelect({
                      key: field.name,
                      value: selectedValues.filter(selectedValue => selectedValue.id !== value.id)?.map(({ id }) => id),
                    });
                  }}
                  icon="cancel"
                  name="cancel"
                  size={'default'}
                  className="group h-4 rounded p-1 hover:bg-white/10 hover:text-mastra-el-6"
                  iconClassname="text-mastra-el-3 h-3 w-3 group-hover:text-mastra-el-6"
                  type="button"
                />
              </Badge>
            ))}

            <IconButton
              type="button"
              className="absolute inset-auto right-2"
              name="down-caret"
              iconClassname="text-icon h-3.5 w-3.5"
            />
          </div>
        )}
        <div className="flex w-max max-w-full flex-col gap-2" onClick={e => e.stopPropagation()}>
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
                setSelectedValues(prev => [
                  ...prev,
                  {
                    id: `{{${field.name}${totalVariablesSelection}}}`,
                    name: `{{${field.name}${totalVariablesSelection}}}`,
                  },
                ]);
                onSelect({ key: field.name, value: [`{{${field.name}${totalVariablesSelection}}}`] });
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
      </div>
    </SelectDropDown>
  );
}

export default MultiSelect;
