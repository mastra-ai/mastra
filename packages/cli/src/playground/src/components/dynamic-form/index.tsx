'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';

import { customZodUnionResolver } from './resolvers';
import { resolveSchema } from './schema-resolver';

interface DynamicFormProps<T extends z.ZodSchema> {
  schema: T;
  onSubmit: (values: z.infer<T>) => void | Promise<void>;
  onChange?: (values: Partial<z.infer<T>>) => void;
  isSubmitLoading?: boolean;
  submitButtonLabel?: string;
}

export function DynamicForm<T extends z.ZodSchema>({
  schema,
  onSubmit,
  onChange,
  isSubmitLoading,
  submitButtonLabel = 'Submit',
}: DynamicFormProps<T>) {
  const schemaTypeName = (schema as any)?._def?.typeName;
  const discriminatedUnionSchemaOptions = (schema as any)?._def?.options;
  const discriminatedUnionSchemaDiscriminator = (schema as any)?._def?.discriminator;

  const form = useForm<z.infer<T>>({
    resolver:
      schemaTypeName === 'ZodDiscriminatedUnion'
        ? customZodUnionResolver(schema as any, discriminatedUnionSchemaDiscriminator)
        : zodResolver(schema as any),
  });

  const { control, handleSubmit, watch } = form;
  const formValues = form.watch();

  const discriminatorValue = discriminatedUnionSchemaDiscriminator
    ? watch(discriminatedUnionSchemaDiscriminator)
    : undefined;

  const resolvedSchema =
    schemaTypeName === 'ZodDiscriminatedUnion'
      ? discriminatedUnionSchemaOptions?.find(
          (option: any) => option?.shape?.[discriminatedUnionSchemaDiscriminator]?._def?.value === discriminatorValue,
        ) || z.object({ [discriminatedUnionSchemaDiscriminator]: z.string() })
      : schema;

  React.useEffect(() => {
    onChange?.(formValues);
  }, [formValues, onChange]);

  function handleFieldChange({ key, value }: { key: keyof z.infer<T>; value: any }) {
    if (key === discriminatedUnionSchemaDiscriminator) {
      form.setValue(key as any, value);
      onChange?.({ ...formValues, [key]: value });
    } else {
      form.setValue(key as any, value);
      onChange?.({ ...formValues, [key]: value });
    }
  }

  return (
    <ScrollArea className="h-full w-full">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 p-4">
        {resolveSchema({
          schema: resolvedSchema,
          parentField: '',
          control,
          formValues,
          errors: form.formState.errors,
          handleFieldChange,
        })}
        <Button disabled={isSubmitLoading} type="submit">
          {isSubmitLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : submitButtonLabel}
        </Button>
      </form>
    </ScrollArea>
  );
}
