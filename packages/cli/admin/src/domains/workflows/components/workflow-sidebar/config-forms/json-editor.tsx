'use client';

import type { ActionVariables } from '@mastra/core';
import { useCallback, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';

import useVariables from '@/domains/workflows/hooks/use-manage-variables';

import VariableBadgeList from '../../utils/variable-badge-list';

function JsonEditor({
  onBlur,
  field,
  initialVariables,
  canUseVariables = false,
}: {
  field: any;
  onBlur: (props: { key: string; value: any; variables?: ActionVariables }) => void;
  initialVariables?: ActionVariables;
  canUseVariables?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const [value, setValue] = useState<string>(JSON.stringify(field.value, null, 2));

  const cb = useCallback(
    ({ variablePayload }: { variablePayload: ActionVariables }) =>
      onBlur({ key: field.name, value, variables: variablePayload }),
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

    let jsonValue = {};

    try {
      jsonValue = JSON.parse(value);
    } catch (e) {
      setLocalError('Invalid JSON');
    }

    onBlur({ key, value: jsonValue, variables: variablePayload });
  }

  function handleChange(e: any) {
    setLocalError(null);
    const value = e.target.value;
    updateVariables(value);
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[0.65rem] text-mastra-el-2">{`{} JSON`}</span>
      <div className="w-full flex flex-col gap-1">
        <Textarea
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
          className="text-area"
        />
        <Text size="xs" className="text-red-500">
          {localError}
        </Text>
      </div>
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

export default JsonEditor;
