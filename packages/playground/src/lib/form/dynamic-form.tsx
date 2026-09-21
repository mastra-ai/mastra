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

function getFormInput(values: Record<string, unknown>, isWrapped: boolean) {
  return isWrapped ? values[ROOT_FIELD_KEY] : values;
}

function normalizeSchema(schema: z.ZodType, isWrapped: boolean) {
  if (isEmptyZodObject(schema)) return z.object({});
  if (!isWrapped) return schema;
  return z.object({ [ROOT_FIELD_KEY]: schema.description ? schema : schema.describe('Input') });
}

const SubmitRowContext = createContext<FormSubmitRowProps | null>(null);

// Defined once, outside any hook: AutoForm renders `uiComponents.SubmitButton` as a component
// type, so recreating it per render would unmount and remount everything in `submitActions`.
const SubmitButton = ({ children }: { children: ReactNode }) => {
  const rowProps = useContext(SubmitRowContext);
  return rowProps ? <FormSubmitRow {...rowProps}>{children}</FormSubmitRow> : null;
};

const uiComponents = { SubmitButton };

const formComponents = {
  Label: ({ value }: { value: string }) => <Label className="font-normal">{value}</Label>,
};

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
  const isWrapped = getShape(schema) === undefined;
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const onValuesChangeRef = useRef(onValuesChange);
  useLayoutEffect(() => {
    onValuesChangeRef.current = onValuesChange;
  }, [onValuesChange]);

  useEffect(() => () => subscriptionRef.current?.unsubscribe(), []);

  const hasValuesListener = Boolean(onValuesChange);

  const handleFormInit = useCallback(
    (form: UseFormReturn<any>) => {
      subscriptionRef.current?.unsubscribe();
      subscriptionRef.current = null;

      if (!hasValuesListener) return;

      subscriptionRef.current = form.watch(values => onValuesChangeRef.current?.(getFormInput(values, isWrapped)));
      onValuesChangeRef.current?.(getFormInput(form.getValues(), isWrapped));
    },
    [hasValuesListener, isWrapped],
  );

  const schemaProvider = useMemo(
    () => (schema ? new CustomZodProvider(normalizeSchema(schema, isWrapped)) : null),
    [schema, isWrapped],
  );

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

  const normalizedDefaultValues = useMemo(
    () => (isWrapped ? (defaultValues === undefined ? undefined : { [ROOT_FIELD_KEY]: defaultValues }) : defaultValues),
    [isWrapped, defaultValues],
  );

  const handleSubmit = useCallback(
    async (values: any) => {
      await onSubmit?.(getFormInput(values, isWrapped));
    },
    [onSubmit, isWrapped],
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
        formProps={{ className, noValidate: true }}
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
