'use client';

import { Loader2 } from 'lucide-react';
import { Button } from '../../ds/components/Button';
import { ScrollArea } from '../ui/scroll-area';
import { AutoForm, CustomZodProvider } from '@/components/ui/autoform';
import type { ExtendableAutoFormProps } from '@autoform/react';
import z, { ZodObject } from 'zod';
import { Label } from '../ui/label';
import { Icon } from '@/ds/icons';

interface DynamicFormProps<T extends z.ZodSchema> {
  schema: T;
  onSubmit?: (values: z.infer<T>) => void | Promise<void>;
  defaultValues?: z.infer<T>;
  isSubmitLoading?: boolean;
  submitButtonLabel?: string;
  className?: string;
  readOnly?: boolean;
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
  submitButtonLabel,
  className,
  readOnly,
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
      await onSubmit?.(values?.['\u200B'] || {});
    },
    defaultValues: defaultValues ? { '\u200B': defaultValues } : undefined,
    formProps: {
      className: '',
    },
    uiComponents: {
      SubmitButton: ({ children }) =>
        onSubmit ? (
          <Button variant="light" className="w-full" size="lg" disabled={isSubmitLoading}>
            {isSubmitLoading ? (
              <Icon>
                <Loader2 className="animate-spin" />
              </Icon>
            ) : (
              submitButtonLabel || children
            )}
          </Button>
        ) : null,
    },
    formComponents: {
      Label: ({ value }) => <Label className="text-sm font-normal">{value}</Label>,
    },
    withSubmit: true,
  };

  return <AutoForm {...formProps} readOnly={readOnly} />;
}
