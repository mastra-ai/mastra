'use client';

import type { ActionVariables } from '@mastra/core';

import BaseSelect from './base-select';

function SingleSelect({
  options,
  field,
  onSelect,
  selected,
  initialVariables,
  canUseVariables = false,
}: {
  options: { label: string; value: string }[];
  field: any;
  onSelect: any;
  selected?: string;
  canUseVariables?: boolean;
  initialVariables?: ActionVariables;
}) {
  const allOptions = options.length ? options : [];

  return (
    <BaseSelect
      allOptions={allOptions}
      onSelect={onSelect}
      canUseVariables={canUseVariables}
      selected={selected}
      initialVariables={initialVariables}
      field={field.name}
      fieldValue={field.value}
    />
  );
}

export default SingleSelect;
