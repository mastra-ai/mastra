import * as React from 'react';
import { cn } from '@/lib/utils';
import { useJSONSchemaForm } from './json-schema-form-context';
import { JSONSchemaFormFieldProvider } from './json-schema-form-field-context';
import type { SchemaField } from './types';

export interface JSONSchemaFormFieldProps {
  field: SchemaField;
  parentPath?: string[];
  depth?: number;
  className?: string;
  children: React.ReactNode;
}

export function Field({
  field,
  parentPath = [],
  depth = 0,
  className,
  children,
}: JSONSchemaFormFieldProps) {
  const { updateField, removeField } = useJSONSchemaForm();

  const update = React.useCallback(
    (updates: Partial<SchemaField>) => {
      updateField(parentPath, field.id, updates);
    },
    [updateField, parentPath, field.id],
  );

  const remove = React.useCallback(() => {
    removeField(parentPath, field.id);
  }, [removeField, parentPath, field.id]);

  const contextValue = React.useMemo(
    () => ({
      field,
      parentPath,
      depth,
      update,
      remove,
    }),
    [field, parentPath, depth, update, remove],
  );

  return (
    <JSONSchemaFormFieldProvider value={contextValue}>
      <div className={cn(className)}>{children}</div>
    </JSONSchemaFormFieldProvider>
  );
}
