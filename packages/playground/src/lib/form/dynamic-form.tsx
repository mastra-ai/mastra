import type { ButtonProps } from '@mastra/playground-ui/components/Button';
import { Label } from '@mastra/playground-ui/components/Label';
import type { ReactNode } from 'react';
import { useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { AutoForm } from './auto-form';
import { FormSubmitRow } from './components/form-submit-row';
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
  disableSubmit?: boolean;
  submitButtonIcon?: ReactNode;
  submitButtonVariant?: ButtonProps['variant'];
  submitButtonFullWidth?: boolean;
  className?: string;
  readOnly?: boolean;
  children?: React.ReactNode;
  submitActions?: React.ReactNode;
  leftActions?: React.ReactNode;
}

function isZodObjectLike(schema: any): boolean {
  return getShape(schema) !== undefined;
}

const ROOT_FIELD_KEY = '\u200B';

function getFormInput(values: Record<string, unknown>, isWrapped: boolean) {
  return isWrapped ? values[ROOT_FIELD_KEY] : values;
}

export function DynamicForm({
  schema,
  onSubmit,
  onValuesChange,
  defaultValues,
  isSubmitLoading,
  submitButtonLabel,
  submitButtonClassName,
  disableSubmit,
  submitButtonIcon,
  submitButtonVariant,
  submitButtonFullWidth,
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
  useLayoutEffect(() => {
    onValuesChangeRef.current = onValuesChange;
  }, [onValuesChange]);

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
        onValuesChangeRef.current?.(getFormInput(values, isNotZodObject));
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
      onValuesChangeRef.current?.(getFormInput(form.getValues(), isNotZodObject));
    },
    [subscribeToValues, isNotZodObject],
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

        return z.object({
          [ROOT_FIELD_KEY]: rootSchema,
        });
      }
      return s;
    };

    return new CustomZodProvider(normalizeSchema(schema));
  }, [schema, isNotZodObject]);

  const uiComponents = useMemo(
    () => ({
      SubmitButton: ({ children: buttonChildren }: { children: React.ReactNode }) =>
        onSubmit ? (
          <FormSubmitRow
            isSubmitLoading={isSubmitLoading}
            submitButtonLabel={submitButtonLabel}
            submitButtonClassName={submitButtonClassName}
            disableSubmit={disableSubmit}
            submitButtonIcon={submitButtonIcon}
            submitButtonVariant={submitButtonVariant}
            submitButtonFullWidth={submitButtonFullWidth}
            submitActions={submitActions}
            leftActions={leftActions}
          >
            {buttonChildren}
          </FormSubmitRow>
        ) : null,
    }),
    [
      onSubmit,
      isSubmitLoading,
      submitButtonLabel,
      submitButtonClassName,
      disableSubmit,
      submitButtonIcon,
      submitButtonVariant,
      submitButtonFullWidth,
      submitActions,
      leftActions,
    ],
  );

  const formComponents = useMemo(
    () => ({
      Label: ({ value }: { value: string }) => <Label className="text-ui-md font-normal">{value}</Label>,
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
      isNotZodObject ? (defaultValues === undefined ? undefined : { [ROOT_FIELD_KEY]: defaultValues }) : defaultValues,
    [isNotZodObject, defaultValues],
  );

  const handleSubmit = useCallback(
    async (values: any) => {
      await onSubmit?.(getFormInput(values, isNotZodObject));
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
