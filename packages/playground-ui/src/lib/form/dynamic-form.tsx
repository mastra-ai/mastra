import { Loader2 } from 'lucide-react';
import { useMemo, useRef, useCallback } from 'react';
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

// Internal component that uses hooks - only called when schema is valid
function DynamicFormInternal<T extends z.ZodSchema>({
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
}: DynamicFormProps<T> & { schema: NonNullable<DynamicFormProps<T>['schema']> }) {
  // Store the initial schema in a ref to prevent remounting when parent re-renders
  // with a new schema reference that has the same structure
  const schemaRef = useRef(schema);
  const stableSchema = schemaRef.current;

  const isNotZodObject = !(stableSchema instanceof ZodObject);

  // Use refs to store callbacks so they don't cause re-renders
  const onChangeRef = useRef(onChange);
  const onSubmitRef = useRef(onSubmit);
  onChangeRef.current = onChange;
  onSubmitRef.current = onSubmit;

  // Memoize the schema provider to prevent form remounting
  // Uses stableSchema from ref to maintain consistent reference
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
    return new CustomZodProvider(normalizedSchema(stableSchema) as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    withSubmit: !hideSubmitButton,
    children,
  };

  return <AutoForm {...formProps} readOnly={readOnly} />;
}

// Wrapper component that handles early returns before hooks
export function DynamicForm<T extends z.ZodSchema>(props: DynamicFormProps<T>) {
  // Early return happens here, before any hooks are called
  if (!props.schema) {
    console.error('no form schema found');
    return null;
  }

  // Now that we've validated schema exists, pass to internal component with hooks
  return <DynamicFormInternal {...props} schema={props.schema} />;
}
