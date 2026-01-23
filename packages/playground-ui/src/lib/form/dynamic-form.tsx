import { Loader2 } from 'lucide-react';
import { useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from '@/ds/components/Button';
import { AutoForm } from './auto-form';
import type { UseFormReturn } from 'react-hook-form';
import z, { ZodObject, ZodIntersection } from 'zod';
import { Label } from '@/ds/components/Label';
import { Icon } from '@/ds/icons';
import { CustomZodProvider } from './zod-provider';

interface DynamicFormProps<T extends z.ZodSchema> {
  schema: T;
  onSubmit?: (values: z.infer<T>) => void | Promise<void>;
  onValuesChange?: (values: z.infer<T>) => void;
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
  onValuesChange,
  defaultValues,
  isSubmitLoading,
  submitButtonLabel,
  className,
  readOnly,
  children,
}: DynamicFormProps<T>) {
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const isNotZodObject = !(schema instanceof ZodObject);
  const onValuesChangeRef = useRef(onValuesChange);

  // Keep the callback ref up to date
  useEffect(() => {
    onValuesChangeRef.current = onValuesChange;
  }, [onValuesChange]);

  // Clean up subscription on unmount
  useEffect(() => {
    return () => {
      subscriptionRef.current?.unsubscribe();
    };
  }, []);

  const handleFormInit = useCallback(
    (form: UseFormReturn<any>) => {
      // Clean up any existing subscription
      subscriptionRef.current?.unsubscribe();

      // Set up value watching for onValuesChange callback
      if (onValuesChangeRef.current) {
        subscriptionRef.current = form.watch(values => {
          const normalizedValues = isNotZodObject ? values['\u200B'] || {} : values;
          onValuesChangeRef.current?.(normalizedValues);
        });
      }
    },
    [isNotZodObject],
  );

  // Memoize the schema provider to avoid recreating it on every render
  // This prevents form fields from losing focus when parent components re-render
  const schemaProvider = useMemo(() => {
    if (!schema) {
      return null;
    }

    const normalizeSchema = (s: z.ZodSchema) => {
      if (isEmptyZodObject(s)) {
        return z.object({});
      }
      if (isNotZodObject) {
        // using a non-printable character to avoid conflicts with the form data
        return z.object({
          '\u200B': s,
        });
      }
      return s;
    };

    return new CustomZodProvider(normalizeSchema(schema) as any);
  }, [schema, isNotZodObject]);

  // Memoize UI components to prevent unnecessary re-renders
  const uiComponents = useMemo(
    () => ({
      SubmitButton: ({ children: buttonChildren }: { children: React.ReactNode }) =>
        onSubmit ? (
          <Button variant="light" className="w-full" size="md" disabled={isSubmitLoading}>
            {isSubmitLoading ? (
              <Icon>
                <Loader2 className="animate-spin" />
              </Icon>
            ) : (
              submitButtonLabel || buttonChildren
            )}
          </Button>
        ) : null,
    }),
    [onSubmit, isSubmitLoading, submitButtonLabel],
  );

  // Memoize form components to prevent unnecessary re-renders
  const formComponents = useMemo(
    () => ({
      Label: ({ value }: { value: string }) => <Label className="text-sm font-normal">{value}</Label>,
    }),
    [],
  );

  // Memoize form props object to prevent unnecessary re-renders
  const formPropsObj = useMemo(
    () => ({
      className,
      noValidate: true,
    }),
    [className],
  );

  // Memoize normalized default values
  const normalizedDefaultValues = useMemo(
    () => (isNotZodObject ? (defaultValues ? { '\u200B': defaultValues } : undefined) : (defaultValues as any)),
    [isNotZodObject, defaultValues],
  );

  // Memoize the submit handler
  const handleSubmit = useCallback(
    async (values: any) => {
      await onSubmit?.(isNotZodObject ? values['\u200B'] || {} : values);
    },
    [onSubmit, isNotZodObject],
  );

  if (!schemaProvider) {
    console.error('no form schema found');
    return null;
  }

  return (
    <AutoForm
      schema={schemaProvider}
      onSubmit={handleSubmit}
      onFormInit={handleFormInit}
      defaultValues={normalizedDefaultValues}
      formProps={formPropsObj}
      uiComponents={uiComponents}
      formComponents={formComponents}
      withSubmit={true}
      readOnly={readOnly}
    >
      {children}
    </AutoForm>
  );
}
