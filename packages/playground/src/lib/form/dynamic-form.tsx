import { Button, Label } from '@mastra/playground-ui';
import { Loader2 } from 'lucide-react';
import { useEffect, useRef, useCallback, useMemo } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { AutoForm } from './auto-form';
import { CustomZodProvider } from './zod-provider';
import { getShape, getIntersection } from './zod-provider/compat';

interface DynamicFormProps {
  schema: any;
  onSubmit?: (values: any) => void | Promise<void>;
  onValuesChange?: (values: any) => void;
  defaultValues?: any;
  isSubmitLoading?: boolean;
  submitButtonLabel?: string;
  className?: string;
  readOnly?: boolean;
  children?: React.ReactNode;
}

function isEmptyZodObject(schema: unknown): boolean {
  const shape = getShape(schema);
  if (shape) {
    return Object.keys(shape).length === 0;
  }

  const intersection = getIntersection(schema);
  if (intersection) {
    return isEmptyZodObject(intersection.left) && isEmptyZodObject(intersection.right);
  }

  return false;
}

function isZodObjectLike(schema: any): boolean {
  return getShape(schema) !== undefined;
}

export function DynamicForm({
  schema,
  onSubmit,
  onValuesChange,
  defaultValues,
  isSubmitLoading,
  submitButtonLabel,
  className,
  readOnly,
  children,
}: DynamicFormProps) {
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const isNotZodObject = !isZodObjectLike(schema);
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
          const normalizedValues = isNotZodObject
            ? values && Object.prototype.hasOwnProperty.call(values, '\u200B')
              ? values['\u200B']
              : {}
            : values;
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

    const normalizeSchema = (s: any) => {
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
          <Button className="w-full" disabled={isSubmitLoading}>
            {isSubmitLoading ? <Loader2 className="animate-spin" /> : submitButtonLabel || buttonChildren}
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
    () =>
      isNotZodObject ? (defaultValues === undefined ? undefined : { '\u200B': defaultValues }) : (defaultValues as any),
    [isNotZodObject, defaultValues],
  );

  // Memoize the submit handler
  const handleSubmit = useCallback(
    async (values: any) => {
      const normalizedValues = isNotZodObject
        ? values && Object.prototype.hasOwnProperty.call(values, '\u200B')
          ? values['\u200B']
          : {}
        : values;
      await onSubmit?.(normalizedValues);
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
