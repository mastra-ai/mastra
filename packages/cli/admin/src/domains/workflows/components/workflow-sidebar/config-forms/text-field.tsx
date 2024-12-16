'use client';

import type { ActionVariables } from '@mastra/core';
import { useCallback, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import useVariables from '@/domains/workflows/hooks/use-manage-variables';

import VariableBadgeList from '../../utils/variable-badge-list';

function TextField({
  isNullable,
  onBlur,
  field,
  initialVariables,
  canUseVariables = false,
}: {
  field: any;
  onBlur: (props: { key: string; value: any; variables?: ActionVariables }) => void;
  initialVariables?: ActionVariables;
  canUseVariables?: boolean;
  isNullable?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [value, setValue] = useState<string>(field.value || '');

  const cb = useCallback(
    ({ variablePayload }: { variablePayload: ActionVariables }) => {
      onBlur({ key: field.name, value: value ?? (isNullable ? null : value), variables: variablePayload });
    },
    [field.name, value],
  );

  const { variables, variablePayload, handleUpdateVariablePayload, updateVariables } = useVariables({
    initialVariables,
    fieldValue: value,
    cb,
  });

  function handleBlur(e: any, onBlur: any) {
    const key = e.target.name;
    const value = e.target.value;
    updateVariables(value);
    onBlur({ key, value: value ?? (isNullable ? null : value), variables: variablePayload });
  }

  function handleChange(e: any) {
    const value = e.target.value;
    updateVariables(value);
  }

  return (
    <div className="flex flex-col gap-1">
      <Input
        {...field}
        type="text"
        ref={inputRef}
        id={field.name}
        value={value}
        onChange={e => {
          field.onChange(e);
          setValue(e.target.value);
        }}
        onBlur={e => handleBlur(e, onBlur)}
        onKeyUp={e => handleChange(e)}
        className="input"
      />
      {canUseVariables && (
        <>
          <VariableBadgeList
            className="mt-0"
            handleUpdateVariablePayload={handleUpdateVariablePayload}
            variablePayload={variablePayload}
            variables={variables}
          />
          <Button
            type="button"
            onClick={e => {
              const varPlaceholder = `${field.name}_${variablePayload?.length || new Date().getTime()}`;
              setValue(prev => `${prev || ''} {{${varPlaceholder}}}`.trim());
              inputRef.current?.focus();
            }}
            className="group flex w-max items-center gap-1 rounded bg-white/[0.025] p-1"
            variant={'secondary'}
          >
            <span className="text-white/70 transition-colors duration-150 ease-in-out group-hover:text-white/80">{`{{}}`}</span>
            <span className="text-[0.75rem] text-white/30 transition-colors duration-150 ease-in-out group-hover:text-white/80">
              use variables
            </span>
          </Button>
        </>
      )}
    </div>
  );
}

export default TextField;
