'use client';

import { Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { AutoForm, CustomZodProvider } from '@/components/ui/autoform';
import type { ExtendableAutoFormProps } from '@autoform/react';
import z, { ZodObject } from 'zod';
import { Label } from '../ui/label';

interface DynamicFormProps<T extends z.ZodSchema> {
  schema: T;
  onSubmit: (values: z.infer<T>) => void | Promise<void>;
  defaultValues?: z.infer<T>;
  isSubmitLoading?: boolean;
  submitButtonLabel?: string;
}

function isEmptyZodObject(schema: unknown): boolean {
  if (schema instanceof ZodObject) {
    return Object.keys(schema.shape).length === 0;
  }
  return false;
}

export function DynamicForm<T extends z.ZodSchema>({
  schema,
  onSubmit,
  defaultValues,
  isSubmitLoading,
  submitButtonLabel = 'Submit',
}: DynamicFormProps<T>) {
  if (!schema) {
    console.error('no form schema found');
    return null;
  }

  const normalizedSchema = (schema: z.ZodSchema) => {
    if (isEmptyZodObject(schema)) {
      return z.object({});
    }
    // using a non-printable character to avoid conflicts with the form data
    return z.object({
      '\u200B': schema,
    });
  };

  const schemaProvider = new CustomZodProvider(normalizedSchema(schema));

  const formProps: ExtendableAutoFormProps<z.infer<T>> = {
    schema: schemaProvider,
    onSubmit: async values => {
      await onSubmit(values?.['\u200B'] || {});
    },
    defaultValues: defaultValues ? { '\u200B': defaultValues } : undefined,
    formProps: {
      className: 'space-y-4 p-4',
    },
    uiComponents: {
      SubmitButton: ({ children }) => (
        <Button className="w-full" type="submit" disabled={isSubmitLoading}>
          {isSubmitLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : children || submitButtonLabel}
        </Button>
      ),
    },
    formComponents: {
      Label: ({ value }) => <Label className="text-sm font-normal">{value}</Label>,
    },
    withSubmit: true,
  };

  return (
    <ScrollArea className="h-full w-full">
      <AutoForm {...formProps} />
    </ScrollArea>
  );
}
