import type { WorkflowInputDataProps } from '../workflow-input-data';
import { CodeEditor } from '@/ds/components/CodeEditor';
import { Field, FieldError } from '@/ds/components/Field';
import { FormSubmitRow } from '@/lib/form/components/form-submit-row';

type WorkflowJsonInputProps = Omit<WorkflowInputDataProps, 'schema' | 'defaultValues' | 'onSubmit'> & {
  value: string;
  onChange: (value: string) => void;
  errors: string[];
  onSubmit: () => void;
};

export function WorkflowJsonInput({
  value,
  onChange,
  errors,
  children,
  isSubmitLoading,
  onSubmit,
  ...submitProps
}: WorkflowJsonInputProps) {
  return (
    <div className="flex flex-col gap-4">
      <Field invalid={errors.length > 0}>
        <CodeEditor value={value} onChange={onChange} editable={!isSubmitLoading} />
        <FieldError>
          {errors.length > 0 && (
            <span className="space-y-1">
              {errors.map(error => (
                <span key={error} className="block">
                  {error}
                </span>
              ))}
            </span>
          )}
        </FieldError>
      </Field>
      {children}
      <FormSubmitRow {...submitProps} isSubmitLoading={isSubmitLoading} onSubmit={onSubmit} />
    </div>
  );
}
