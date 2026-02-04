import * as React from 'react';
import { cn } from '@/lib/utils';
import type { JsonSchema } from '@/lib/json-schema';
import { JSONSchemaFormProvider } from './json-schema-form-context';
import type { SchemaField } from './types';
import { createField } from './types';
import { fieldsToJSONSchema, addFieldAtPath, removeFieldAtPath, updateFieldAtPath } from './utils';

export interface JSONSchemaFormRootProps {
  onChange?: (schema: JsonSchema) => void;
  onFieldsChange?: (fields: SchemaField[]) => void;
  defaultValue?: SchemaField[];
  maxDepth?: number;
  className?: string;
  children: React.ReactNode;
}

export function Root({
  onChange,
  onFieldsChange,
  defaultValue,
  maxDepth = 5,
  className,
  children,
}: JSONSchemaFormRootProps) {
  const [fields, setFields] = React.useState<SchemaField[]>(() => defaultValue || []);

  const previousSchemaRef = React.useRef<string>('');

  React.useEffect(() => {
    const schema = fieldsToJSONSchema(fields);
    const schemaString = JSON.stringify(schema);

    if (schemaString !== previousSchemaRef.current) {
      previousSchemaRef.current = schemaString;
      onChange?.(schema);
    }
  }, [fields, onChange]);

  React.useEffect(() => {
    onFieldsChange?.(fields);
  }, [fields, onFieldsChange]);

  const addField = React.useCallback((parentPath: string[]) => {
    const newField = createField();
    setFields(prev => addFieldAtPath(prev, parentPath, newField));
  }, []);

  const removeField = React.useCallback((parentPath: string[], fieldId: string) => {
    setFields(prev => removeFieldAtPath(prev, parentPath, fieldId));
  }, []);

  const updateField = React.useCallback((parentPath: string[], fieldId: string, updates: Partial<SchemaField>) => {
    setFields(prev => updateFieldAtPath(prev, parentPath, fieldId, updates));
  }, []);

  const contextValue = React.useMemo(
    () => ({
      fields,
      addField,
      removeField,
      updateField,
      maxDepth,
    }),
    [fields, addField, removeField, updateField, maxDepth],
  );

  return (
    <JSONSchemaFormProvider value={contextValue}>
      <div className={cn(className)}>{children}</div>
    </JSONSchemaFormProvider>
  );
}
