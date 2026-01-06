'use client';

import { Loader2 } from 'lucide-react';
import { useMemo, useRef, useCallback } from 'react';
import { Button } from '../../ds/components/Button';
import { AutoForm } from '@/components/ui/autoform';
import type { ExtendableAutoFormProps } from '@autoform/react';
import z, { ZodObject, ZodIntersection } from 'zod';
import { Label } from '../ui/label';
import { Icon } from '@/ds/icons';
import { CustomZodProvider } from '../ui/autoform/zodProvider';

interface DynamicFormProps<T extends z.ZodSchema> {
  schema: T;
  onSubmit?: (values: z.infer<T>) => void | Promise<void>;
  onChange?: (values: z.infer<T>) => void;
  defaultValues?: z.infer<T>;
  isSubmitLoading?: boolean;
  submitButtonLabel?: string;
  className?: string;
  readOnly?: boolean;
  hideSubmitButton?: boolean;
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
  onChange,
  defaultValues,
  isSubmitLoading,
  submitButtonLabel,
  className,
  readOnly,
  hideSubmitButton,
  children,
}: DynamicFormProps<T>) {
  const isNotZodObject = !(schema instanceof ZodObject);

  // Use refs to store callbacks so they don't cause re-renders
  const onChangeRef = useRef(onChange);
  const onSubmitRef = useRef(onSubmit);
  onChangeRef.current = onChange;
  onSubmitRef.current = onSubmit;

  // Memoize the schema provider to prevent form remounting
  const schemaProvider = useMemo(() => {
    const normalizedSchema = (s: z.ZodSchema) => {
      if (isEmptyZodObject(s)) {
        return z.object({});
      }
      if (!(s instanceof ZodObject)) {
        // using a non-printable character to avoid conflicts with the form data
        return z.object({
          '\u200B': s,
        });
      }
      return s;
    };
    return new CustomZodProvider(normalizedSchema(schema) as any);
  }, [schema]);

  // Memoize onFormInit to prevent useEffect re-runs in CustomAutoForm
  const onFormInit = useCallback(
    (form: any) => {
      // Subscribe to form changes using ref to get latest onChange
      const subscription = form.watch((values: any) => {
        const currentOnChange = onChangeRef.current;
        if (currentOnChange) {
          currentOnChange(isNotZodObject ? values['\u200B'] || {} : values);
        }
      });
      // Return cleanup function
      return () => subscription.unsubscribe();
    },
    [isNotZodObject],
  );

  // Memoize submit handler
  const handleSubmit = useCallback(
    async (values: any) => {
      const currentOnSubmit = onSubmitRef.current;
      await currentOnSubmit?.(isNotZodObject ? values['\u200B'] || {} : values);
    },
    [isNotZodObject],
  );

  // Memoize default values
  const normalizedDefaultValues = useMemo(() => {
    return isNotZodObject ? (defaultValues ? { '\u200B': defaultValues } : undefined) : (defaultValues as any);
  }, [isNotZodObject, defaultValues]);

  if (!schema) {
    console.error('no form schema found');
    return null;
  }

  const formProps: ExtendableAutoFormProps<any> = {
    schema: schemaProvider,
    onSubmit: handleSubmit,
    onFormInit,
    defaultValues: normalizedDefaultValues,
    formProps: {
      className,
      noValidate: true,
    },
    uiComponents: {
      SubmitButton: ({ children }) =>
        hideSubmitButton ? null : onSubmit ? (
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
    withSubmit: !hideSubmitButton,
    children,
  };

  return <AutoForm {...formProps} readOnly={readOnly} />;
}
