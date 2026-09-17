import { Txt } from '@mastra/playground-ui/components/Txt';
import type { RequestContextSchemaFormRenderProps } from '@mastra/playground-ui/domains/request-context';
import { useMemo } from 'react';
import { parse } from 'superjson';
import { DynamicForm } from './dynamic-form';
import { jsonSchemaToZodRuntime } from './json-schema-to-zod-runtime';
import { RequestContextFormDraft } from './request-context-form-draft';

/** Renders a request context JSON schema through the playground `DynamicForm`. */
export function RequestContextSchemaFormRenderer({
  requestContextSchema,
  defaultValues,
  onValuesChange,
  onSave,
}: RequestContextSchemaFormRenderProps) {
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
      <div className="text-neutral3">
        <Txt variant="ui-sm">Failed to parse request context schema</Txt>
      </div>
    );
  }

  // No `onSubmit`: DynamicForm then renders no submit button; run options own the single "Save".
  return (
    <DynamicForm schema={zodSchema} onValuesChange={onValuesChange} defaultValues={defaultValues}>
      <RequestContextFormDraft schema={zodSchema} defaultValues={defaultValues} onSave={onSave} />
    </DynamicForm>
  );
}
