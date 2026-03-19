import { useMemo } from 'react';
import { Txt } from '@/ds/components/Txt';
import { DynamicForm } from '@/lib/form';
import { resolveSerializedZodOutput } from '@/lib/form/utils';
import { jsonSchemaToZod } from '@mastra/schema-compat/json-to-zod';
import { parse } from 'superjson';
import { useSchemaRequestContext } from '../context/schema-request-context';
import { CopyButton } from '@/ds/components/CopyButton';

export interface RequestContextSchemaFormProps {
  /**
   * Serialized JSON schema for request context validation.
   * This component should only be rendered when a schema is provided.
   */
  requestContextSchema: string;
}

/**
 * Component that displays a schema-driven form for request context.
 * Only rendered when an agent/workflow defines a requestContextSchema.
 *
 * This component syncs form values to the SchemaRequestContext on explicit "Save" click,
 * allowing the agent chat to use these values (which override global context).
 * Empty strings in form fields will override global values intentionally.
 */
export const RequestContextSchemaForm = ({ requestContextSchema }: RequestContextSchemaFormProps) => {
  const { setSchemaValues, schemaValues } = useSchemaRequestContext();
  // Local state for schema-driven form (does NOT update global store)

  const localFormValuesStr = JSON.stringify(schemaValues);

  // Parse the schema
  const zodSchema = useMemo(() => {
    try {
      const jsonSchema = parse(requestContextSchema) as Parameters<typeof jsonSchemaToZod>[0];
      return resolveSerializedZodOutput(jsonSchemaToZod(jsonSchema));
    } catch (error) {
      console.error('Failed to parse requestContextSchema:', error);
      return null;
    }
  }, [requestContextSchema]);

  if (!zodSchema) {
    return (
      <div className="text-neutral3">
        <Txt variant="ui-sm">Failed to parse request context schema</Txt>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Txt as="span" variant="ui-md" className="text-neutral3">
          Request Context
        </Txt>
        <CopyButton content={localFormValuesStr} />
      </div>

      <DynamicForm
        schema={zodSchema}
        onSubmit={setSchemaValues}
        submitButtonLabel="Save"
        defaultValues={schemaValues}
      />
    </div>
  );
};
