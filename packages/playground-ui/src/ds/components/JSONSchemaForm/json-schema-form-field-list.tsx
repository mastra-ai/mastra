import * as React from 'react';
import { cn } from '@/lib/utils';
import { useJSONSchemaForm } from './json-schema-form-context';
import { useJSONSchemaFormNestedContext } from './json-schema-form-nested-context';
import type { SchemaField } from './types';

export interface JSONSchemaFormFieldListProps {
  className?: string;
  children: (field: SchemaField, index: number, context: { parentPath: string[]; depth: number }) => React.ReactNode;
}

export function FieldList({ className, children }: JSONSchemaFormFieldListProps) {
  const { fields: rootFields } = useJSONSchemaForm();
  const nestedContext = useJSONSchemaFormNestedContext();

  // Use nested context if available, otherwise use root fields
  const fields = nestedContext ? nestedContext.fields : rootFields;
  const parentPath = nestedContext ? nestedContext.parentPath : [];
  const depth = nestedContext ? nestedContext.depth : 0;

  if (fields.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {fields.map((field, index) => children(field, index, { parentPath, depth }))}
    </div>
  );
}
