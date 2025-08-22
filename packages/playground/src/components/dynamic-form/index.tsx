'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';

import { customZodUnionResolver } from './resolvers';
import { resolveSchema } from './schema-resolver';

interface DynamicFormProps<T extends z.ZodSchema> {
  schema: T;
  onSubmit: (values: z.infer<T>) => void | Promise<void>;
  defaultValues?: z.infer<T>;
  isSubmitLoading?: boolean;
  submitButtonLabel?: string;
}

export function DynamicForm<T extends z.ZodSchema>({
  schema,
  onSubmit,
  defaultValues,
  isSubmitLoading,
  submitButtonLabel = 'Submit',
}: DynamicFormProps<T>) {
  const schemaTypeName = (schema as any)?._def?.typeName;
  const discriminatedUnionSchemaOptions = (schema as any)?._def?.options;
  const discriminatedUnionSchemaDiscriminator = (schema as any)?._def?.discriminator;

  // Wrap non-object schemas in a container object
  const wrappedSchema = schemaTypeName !== 'ZodObject' ? z.object({ items: schema }) : schema;

  const form = useForm<z.infer<typeof wrappedSchema>>({
    resolver:
      schemaTypeName === 'ZodDiscriminatedUnion'
        ? customZodUnionResolver(wrappedSchema as any, discriminatedUnionSchemaDiscriminator)
        : zodResolver(wrappedSchema as any),
    defaultValues,
  });

  const { control, handleSubmit, watch } = form;
  const formValues = form.watch();

  const discriminatorValue = discriminatedUnionSchemaDiscriminator
    ? (watch(discriminatedUnionSchemaDiscriminator) as any)
    : undefined;

  const resolvedSchema =
    schemaTypeName === 'ZodDiscriminatedUnion'
      ? discriminatedUnionSchemaOptions?.find(
          (option: any) => option?.shape?.[discriminatedUnionSchemaDiscriminator]?._def?.value === discriminatorValue,
        ) || z.object({ [discriminatedUnionSchemaDiscriminator]: z.string() })
      : wrappedSchema;

  function handleFieldChange({ key, value }: { key: keyof z.infer<T>; value: any }) {
    if (key === discriminatedUnionSchemaDiscriminator) {
      form.setValue(key as any, value);
    } else {
      form.setValue(key as any, value);
    }
  }

  const wrappedOnSubmit = (values: z.infer<typeof wrappedSchema>) => {
    if (schemaTypeName !== 'ZodObject') {
      return onSubmit(values.items);
    }
    return onSubmit(values as any);
  };

  return (
    <ScrollArea className="h-full w-full">
      <form onSubmit={handleSubmit(wrappedOnSubmit)} className="flex flex-col gap-4 p-4 w-full">
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
