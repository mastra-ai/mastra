'use client';

import { jsonSchemaToZod } from 'json-schema-to-zod';
import { useCallback, useMemo } from 'react';
import { SubmitHandler, UseFormReturn } from 'react-hook-form';
import { z, ZodSchema } from 'zod';

import { getWorkflowFormFieldMap } from '@/domains/workflows/components/utils/constants';
import { resolveSerializedZodOutput, schemaToFormFieldRenderer } from '@/domains/workflows/schema';

export type DynamicFormProps = {
  jsonSchema: Record<string, any>;
  form: UseFormReturn<any>;
  onSubmit: SubmitHandler<any>;
};

export const DynamicForm = ({ jsonSchema, form, onSubmit }: DynamicFormProps) => {
  const allValues = form.watch();

  const schema: ZodSchema = useMemo(() => {
    return resolveSerializedZodOutput(jsonSchemaToZod(jsonSchema));
  }, [jsonSchema]);

  const handleFieldChange = useCallback(
    ({ key, value }: { key: any; value: any }) => {
      form.setValue(key, value);
    },
    [form],
  );

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {Object.entries(((schema as any) || {}).shape).map(([field, schema]) => {
        if (schema instanceof z.ZodDefault) return;

        return (
          <div key={field} className="flex flex-col gap-1">
            {schemaToFormFieldRenderer({
              schema: schema as any,
              schemaField: field as string,
              renderFieldMap: getWorkflowFormFieldMap(),
              onFieldChange: handleFieldChange,
              values: allValues,
              control: form.control,
              errors: form.formState.errors,
            })}
          </div>
        );
      })}
    </form>
  );
};
