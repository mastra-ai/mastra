import { useMemo } from 'react';
import { parse } from 'superjson';
import { RequestContextLabel } from './request-context-label';
import { CopyButton } from '@/ds/components/CopyButton';
import { Txt } from '@/ds/components/Txt';
import { DynamicForm } from '@/lib/form';
import { jsonSchemaToZodRuntime } from '@/lib/form/json-schema-to-zod-runtime';

export interface RequestContextSchemaFormProps {
  /**
   * Serialized JSON schema for request context validation.
   * This component should only be rendered when a schema is provided.
   */
  requestContextSchema: string;
  labelTooltip?: string;
  values: Record<string, any>;
  onSave: (values: Record<string, any>) => void;
}

/**
 * Component that displays a schema-driven form for request context.
 * Only rendered when an agent/workflow defines a requestContextSchema.
 *
 * Form values are reported through `onSave` on explicit "Save" click.
 * Empty strings in form fields will override global values intentionally.
 */
export const RequestContextSchemaForm = ({
  labelTooltip,
  requestContextSchema,
  values,
  onSave,
}: RequestContextSchemaFormProps) => {
  const localFormValuesStr = JSON.stringify(values);

  // Parse the schema
  const zodSchema = useMemo(() => {
    try {
      const jsonSchema = parse(requestContextSchema) as Parameters<typeof jsonSchemaToZodRuntime>[0];
      return jsonSchemaToZodRuntime(jsonSchema);
    } catch (error) {
      console.error('Failed to parse requestContextSchema:', error);
      return null;
    }
  }, [requestContextSchema]);

  if (!zodSchema) {
    return (
      <div className="text-muted-foreground">
        <Txt variant="caption">Failed to parse request context schema</Txt>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <RequestContextLabel tooltip={labelTooltip}>Request Context</RequestContextLabel>
        <CopyButton content={localFormValuesStr} />
      </div>

      <DynamicForm schema={zodSchema} onSubmit={onSave} submitButtonLabel="Save" defaultValues={values} />
    </div>
  );
};
