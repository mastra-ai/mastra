import type { ButtonProps } from '@mastra/playground-ui/components/Button';
import { Label } from '@mastra/playground-ui/components/Label';
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { AutoForm } from './auto-form';
import { FormSubmitRow } from './components/form-submit-row';
import type { FormSubmitRowProps } from './components/form-submit-row';
import { ROOT_FIELD_KEY } from './field-context';
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

function getFormInput(values: Record<string, unknown>, isWrapped: boolean) {
  return isWrapped ? values[ROOT_FIELD_KEY] : values;
}

const SubmitRowContext = createContext<FormSubmitRowProps | null>(null);

// Defined once, outside any hook: AutoForm renders `uiComponents.SubmitButton` as a component
// type, so recreating it per render would unmount and remount everything in `submitActions`.
const SubmitButton = ({ children }: { children: ReactNode }) => {
  const rowProps = useContext(SubmitRowContext);
  return rowProps ? <FormSubmitRow {...rowProps}>{children}</FormSubmitRow> : null;
};

const uiComponents = { SubmitButton };

export function DynamicForm({
  schema,
  onSubmit,
  onValuesChange,
  defaultValues,
  isSubmitLoading,
  submitButtonLabel,
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

  const submitRow = useMemo<FormSubmitRowProps | null>(
    () =>
      onSubmit
        ? {
            isSubmitLoading,
            submitButtonLabel,
            submitButtonIcon,
            submitButtonVariant,
            submitButtonFullWidth,
            submitActions,
            leftActions,
          }
        : null,
    [
      onSubmit,
      isSubmitLoading,
      submitButtonLabel,
      submitButtonIcon,
      submitButtonVariant,
      submitButtonFullWidth,
      submitActions,
      leftActions,
    ],
  );

  const formComponents = useMemo(
    () => ({
      Label: ({ value }: { value: string }) => <Label className="font-normal">{value}</Label>,
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
    <SubmitRowContext.Provider value={submitRow}>
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
    </SubmitRowContext.Provider>
  );
}
