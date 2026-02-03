import * as React from 'react';
import { cn } from '@/lib/utils';
import { useJSONSchemaForm } from './json-schema-form-context';
import { useJSONSchemaFormField } from './json-schema-form-field-context';
import { JSONSchemaFormNestedProvider } from './json-schema-form-nested-context';
import { createField } from './types';

export interface JSONSchemaFormNestedFieldsProps {
  className?: string;
  children?: React.ReactNode;
}

export function NestedFields({ className, children }: JSONSchemaFormNestedFieldsProps) {
  const { maxDepth, updateField } = useJSONSchemaForm();
  const { field, parentPath, depth } = useJSONSchemaFormField();

  const isNestable = field.type === 'object' || field.type === 'array';
  const isAtMaxDepth = depth >= maxDepth;

  React.useEffect(() => {
    if (field.type === 'object' && !field.properties) {
      updateField(parentPath, field.id, { properties: [] });
    }
    if (field.type === 'array' && !field.items) {
      updateField(parentPath, field.id, {
        items: createField({ name: 'items', type: 'object', properties: [] }),
      });
    }
  }, [field.type, field.properties, field.items, field.id, parentPath, updateField]);

  if (!isNestable || isAtMaxDepth) {
    return null;
  }

  const nestedPath = [...parentPath, field.id];
  const nestedDepth = depth + 1;

  // For objects, show properties directly
  // For arrays, show the items schema's properties (items is always an object)
  const nestedFields =
    field.type === 'object'
      ? field.properties || []
      : field.type === 'array' && field.items
        ? field.items.properties || []
        : [];

  return (
    <JSONSchemaFormNestedProvider value={{ parentPath: nestedPath, depth: nestedDepth, fields: nestedFields }}>
      <div className={cn('pl-4 border-l border-border1 mt-2', className)}>{children}</div>
    </JSONSchemaFormNestedProvider>
  );
}
