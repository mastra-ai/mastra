import { Loader2 } from 'lucide-react';
import { Button } from '@/ds/components/Button';
import { AutoForm } from './auto-form';
import type { ExtendableAutoFormProps } from '@autoform/react';
import z, { ZodObject, ZodIntersection } from 'zod';
import { Label } from '@/ds/components/Label';
import { Icon } from '@/ds/icons';
import { CustomZodProvider } from './zod-provider';

interface DynamicFormProps<T extends z.ZodSchema> {
  schema: T;
  onSubmit?: (values: z.infer<T>) => void | Promise<void>;
  defaultValues?: z.infer<T>;
  isSubmitLoading?: boolean;
  submitButtonLabel?: string;
  className?: string;
  readOnly?: boolean;
  children?: React.ReactNode;
}

function isEmptyZodObject(schema: unknown): boolean {
  if (schema instanceof ZodObject) {
    return Object.keys(schema.shape).length === 0;
  }

  if (schema instanceof ZodIntersection) {
    return isEmptyZodObject(schema._def.left) || isEmptyZodObject(schema._def.right);
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
  children,
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
      noValidate: true,
    },
    uiComponents: {
      SubmitButton: ({ children }) =>
        onSubmit ? (
          <Button variant="light" className="w-full" size="md" disabled={isSubmitLoading}>
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
    children,
  };

  return <AutoForm {...formProps} readOnly={readOnly} />;
}
