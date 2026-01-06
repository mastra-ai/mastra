import { useEffect, useRef } from 'react';
import { useForm, FormProvider, DefaultValues } from 'react-hook-form';
import { parseSchema, getDefaultValues } from '@autoform/core';
import { AutoFormProps, AutoFormProvider } from '@autoform/react';
import { CustomAutoFormField } from './components/CustomAutoFormField';
import { removeEmptyValues } from './utils';

export function CustomAutoForm<T extends Record<string, any>>({
  schema,
  onSubmit = () => {},
  defaultValues,
  values,
  children,
  uiComponents,
  formComponents,
  withSubmit = false,
  onFormInit = () => {},
  formProps = {},
}: AutoFormProps<T>) {
  const parsedSchema = parseSchema(schema);
  const methods = useForm<T>({
    defaultValues: {
      ...(getDefaultValues(schema) as Partial<T>),
      ...defaultValues,
    } as DefaultValues<T>,
    values: values as T,
  });

  // Track if onFormInit has been called to prevent re-running on every render
  const onFormInitCalledRef = useRef(false);

  useEffect(() => {
    if (onFormInit && !onFormInitCalledRef.current) {
      onFormInitCalledRef.current = true;
      const cleanup = onFormInit(methods);
      // Return cleanup function if one was provided
      return typeof cleanup === 'function' ? cleanup : undefined;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Intentionally run only once on mount - onFormInit is meant to initialize the form, not re-run on changes
  }, []);

  const handleSubmit = async (dataRaw: T) => {
    const data = removeEmptyValues(dataRaw);
    const validationResult = schema.validateSchema(data as T);
    if (validationResult.success) {
      await onSubmit(validationResult.data, methods);
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
  };

  return (
    <FormProvider {...methods}>
      <AutoFormProvider
        value={{
          schema: parsedSchema,
          uiComponents,
          formComponents,
        }}
      >
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
