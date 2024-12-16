'use client';

import type { ActionVariables } from '@mastra/core';
import { useCallback, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import RichText, { RichTextRefProps } from '@/components/ui/rich-text';

import useVariables from '@/domains/workflows/hooks/use-manage-variables';

import VariableBadgeList from '../../utils/variable-badge-list';

function RichTextField({
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
  const [value, setValue] = useState<string>(field.value || '');

  const richTextRef = useRef<RichTextRefProps>(null);

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

  return (
    <div className="flex flex-col gap-1">
      <RichText
        value={value}
        setValue={val => {
          setValue(val);
          updateVariables(val);
          onBlur({ key: field.name, value: val });
        }}
        ref={richTextRef}
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
              richTextRef.current?.updateContent(`{{${varPlaceholder}}}`);
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

export default RichTextField;
