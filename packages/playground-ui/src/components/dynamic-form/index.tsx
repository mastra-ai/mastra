'use client';

import { Loader2 } from 'lucide-react';
import { Button } from '../../ds/components/Button';
import { ScrollArea } from '../ui/scroll-area';
import { AutoForm } from '@/components/ui/autoform';
import type { ExtendableAutoFormProps } from '@autoform/react';
import z, { ZodObject } from 'zod';
import { Label } from '../ui/label';
import { Icon } from '@/ds/icons';
import { ZodProvider, fieldConfig } from '@autoform/zod/v4';
import { CustomZodProvider } from '../ui/autoform/zodProvider';

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
  const isNotZodObject = !(schema instanceof ZodObject);
  if (!schema) {
    console.error('no form schema found');
    return null;
  }

  const normalizedSchema = (schema: z.ZodSchema) => {
    if (isEmptyZodObject(schema)) {
      return z.object({});
    }
    if (isNotZodObject) {
      // using a non-printable character to avoid conflicts with the form data
      return z.object({
        '\u200B': schema,
      });
    }
    return schema;
  };

  const schemaProvider = new CustomZodProvider(normalizedSchema(schema) as any);

  const formProps: ExtendableAutoFormProps<any> = {
    schema: schemaProvider,
    onSubmit: async (values: any) => {
      await onSubmit?.(isNotZodObject ? values['\u200B'] || {} : values);
    },
    defaultValues: isNotZodObject ? (defaultValues ? { '\u200B': defaultValues } : undefined) : (defaultValues as any),
    formProps: {
      className,
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
