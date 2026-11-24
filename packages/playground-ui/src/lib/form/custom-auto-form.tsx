import { parseSchema, getDefaultValues } from '@autoform/core';
import type { AutoFormProps } from '@autoform/react';
import { AutoFormProvider } from '@autoform/react';
import { useEffect, useMemo, useCallback } from 'react';
import type { DefaultValues } from 'react-hook-form';
import { useForm, FormProvider } from 'react-hook-form';
import { CustomAutoFormField } from './components/custom-auto-form-field';

export function CustomAutoForm<T extends Record<string, any>>({
  schema,
  onSubmit,
  defaultValues,
  values,
  children,
  uiComponents,
  formComponents,
  withSubmit = false,
  onFormInit,
  formProps = {},
}: AutoFormProps<T>) {
  const parsedSchema = useMemo(() => parseSchema(schema), [schema]);
  const methods = useForm<T>({
    defaultValues: {
      ...(getDefaultValues(schema) as Partial<T>),
      ...defaultValues,
    } as DefaultValues<T>,
    values: values as T,
  });

  useEffect(() => {
    if (onFormInit) {
      onFormInit(methods);
    }
  }, [onFormInit, methods]);

  const handleSubmit = useCallback(
    async (dataRaw: T) => {
      const validationResult = schema.validateSchema(dataRaw);
      if (validationResult.success) {
        await onSubmit?.(validationResult.data, methods);
      } else {
        methods.clearErrors();
        let isFocused: boolean = false;
        validationResult.errors?.forEach(error => {
          const path = error.path.join('.');
          methods.setError(
            path as any,
            {
              type: 'custom',
              message: error.message,
            },
            { shouldFocus: !isFocused },
          );

          isFocused = true;

          // For some custom errors, zod adds the final element twice for some reason
          const correctedPath = error.path?.slice?.(0, -1);
          if (correctedPath?.length > 0) {
            methods.setError(correctedPath.join('.') as any, {
              type: 'custom',
              message: error.message,
            });
          }
        });
      }
    },
    [schema, onSubmit, methods],
  );

  const providerValue = useMemo(
    () => ({
      schema: parsedSchema,
      uiComponents,
      formComponents,
    }),
    [parsedSchema, uiComponents, formComponents],
  );

  return (
    <FormProvider {...methods}>
      <AutoFormProvider value={providerValue}>
        <uiComponents.Form onSubmit={methods.handleSubmit(handleSubmit)} {...formProps}>
          {parsedSchema.fields.map(field => (
            <CustomAutoFormField key={field.key} field={field} path={[field.key]} />
          ))}
          {children}
          {withSubmit && <uiComponents.SubmitButton>Submit</uiComponents.SubmitButton>}
        </uiComponents.Form>
      </AutoFormProvider>
    </FormProvider>
  );
}
