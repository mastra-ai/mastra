import { Button } from '@mastra/playground-ui/components/Button';
import type { ButtonProps } from '@mastra/playground-ui/components/Button';
import { Label } from '@mastra/playground-ui/components/Label';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useRef, useCallback, useMemo } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { AutoForm } from './auto-form';
import { isEmptyZodObject } from './is-empty-zod-object';
import { CustomZodProvider } from './zod-provider';
import { getShape } from './zod-provider/compat';

interface DynamicFormProps {
  schema: any;
  onSubmit?: (values: any) => void | Promise<void>;
  onValuesChange?: (values: any) => void;
  defaultValues?: any;
  isSubmitLoading?: boolean;
  submitButtonLabel?: string;
  submitButtonClassName?: string;
  submitButtonIcon?: ReactNode;
  submitButtonVariant?: ButtonProps['variant'];
  submitButtonFullWidth?: boolean;
  disableSubmit?: boolean;
  className?: string;
  readOnly?: boolean;
  children?: React.ReactNode;
  submitActions?: React.ReactNode;
  leftActions?: React.ReactNode;
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
  submitButtonClassName,
  submitButtonIcon,
  submitButtonVariant,
  submitButtonFullWidth,
  disableSubmit,
  className,
  readOnly,
  children,
  submitActions,
  leftActions,
}: DynamicFormProps) {
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const formRef = useRef<UseFormReturn<any> | null>(null);
  const isNotZodObject = !isZodObjectLike(schema);
  const onValuesChangeRef = useRef(onValuesChange);
  onValuesChangeRef.current = onValuesChange;

  useEffect(() => {
    return () => {
      subscriptionRef.current?.unsubscribe();
    };
  }, []);

  const subscribeToValues = useCallback(
    (form: UseFormReturn<any>) => {
      subscriptionRef.current?.unsubscribe();
      subscriptionRef.current = null;

      if (!onValuesChangeRef.current) return;

      subscriptionRef.current = form.watch(values => {
        const normalizedValues = isNotZodObject
          ? values && Object.prototype.hasOwnProperty.call(values, '\u200B')
            ? values['\u200B']
            : {}
          : values;
        onValuesChangeRef.current?.(normalizedValues);
      });
    },
    [isNotZodObject],
  );

  const shouldSubscribeToValues = Boolean(onValuesChange);

  useEffect(() => {
    if (formRef.current) {
      subscribeToValues(formRef.current);
    }
  }, [shouldSubscribeToValues, subscribeToValues]);

  const handleFormInit = useCallback(
    (form: UseFormReturn<any>) => {
      formRef.current = form;
      subscribeToValues(form);
    },
    [subscribeToValues],
  );

  const schemaProvider = useMemo(() => {
    if (!schema) {
      return null;
    }

    const normalizeSchema = (s: any) => {
      if (isEmptyZodObject(s)) {
        return z.object({});
      }
      if (isNotZodObject) {
        const rootSchema = s.description ? s : s.describe('Input');

        // using a non-printable character to avoid conflicts with the form data
        return z.object({
          '\u200B': rootSchema,
        });
      }
      return s;
    };

    return new CustomZodProvider(normalizeSchema(schema) as any);
  }, [schema, isNotZodObject]);

  const uiComponents = useMemo(
    () => ({
      SubmitButton: ({ children: buttonChildren }: { children: React.ReactNode }) =>
        onSubmit ? (
          <div className={cn('flex items-center justify-between gap-1', submitButtonFullWidth && 'block')}>
            {!submitButtonFullWidth && (leftActions ?? <div />)}
            <div className={cn('flex items-center gap-1', submitButtonFullWidth && 'w-full')}>
              {submitActions}
              <Button
                variant={submitButtonVariant}
                disabled={isSubmitLoading || disableSubmit}
                className={cn(submitButtonFullWidth && 'w-full justify-center', submitButtonClassName)}
              >
                {isSubmitLoading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <>
                    {submitButtonIcon}
                    {submitButtonLabel || buttonChildren}
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : null,
    }),
    [
      onSubmit,
      isSubmitLoading,
      submitButtonLabel,
      submitButtonClassName,
      submitButtonIcon,
      submitButtonVariant,
      submitButtonFullWidth,
      submitActions,
      leftActions,
      disableSubmit,
    ],
  );

  const formComponents = useMemo(
    () => ({
      Label: ({ value }: { value: string }) => <Label className="text-sm font-normal">{value}</Label>,
    }),
    [],
  );

  const formPropsObj = useMemo(
    () => ({
      className,
      noValidate: true,
    }),
    [className],
  );

  const normalizedDefaultValues = useMemo(
    () =>
      isNotZodObject ? (defaultValues === undefined ? undefined : { '\u200B': defaultValues }) : (defaultValues as any),
    [isNotZodObject, defaultValues],
  );

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
