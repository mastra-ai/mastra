import { Fieldset, FieldsetLegend } from '@mastra/playground-ui/components/Field';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { DynamicForm } from '@mastra/playground-ui/lib/form/dynamic-form';
import { jsonSchemaToZodRuntime } from '@mastra/playground-ui/lib/form/json-schema-to-zod-runtime';
import { useState } from 'react';

function toZodSchema(requestContextSchema: Record<string, unknown>) {
  try {
    return jsonSchemaToZodRuntime(requestContextSchema);
  } catch (error) {
    console.error('Failed to parse requestContextSchema:', error);
    return undefined;
  }
}

export interface RequestContextFormProps {
  requestContextSchema: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
}

/**
 * Schema-driven request context form. Converts the dataset's plain JSON Schema into a zod schema and
 * surfaces values via onChange (no global store coupling). The schema is converted once per mount, so
 * DynamicForm keeps a stable schema; key this on the dataset to pick up a new one.
 */
export function RequestContextForm({ requestContextSchema, onChange }: RequestContextFormProps) {
  const [zodSchema] = useState(() => toZodSchema(requestContextSchema));

  if (!zodSchema) {
    return (
      <div role="alert">
        <Notice variant="destructive">Failed to parse request context schema</Notice>
      </div>
    );
  }

  return (
    <Fieldset>
      <FieldsetLegend>Request context</FieldsetLegend>
      <DynamicForm schema={zodSchema} onValuesChange={onChange} className="[&_button[type=submit]]:hidden" />
    </Fieldset>
  );
}
