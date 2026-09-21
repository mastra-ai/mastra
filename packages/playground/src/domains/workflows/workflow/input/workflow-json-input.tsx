import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { FieldBlock, fieldErrorId } from '@mastra/playground-ui/components/FormFieldBlocks';
import type { WorkflowInputDataProps } from '../workflow-input-data';
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
      <CodeEditor
        value={value}
        onChange={onChange}
        editable={!isSubmitLoading}
        aria-invalid={errors.length > 0 ? true : undefined}
        aria-describedby={errors.length > 0 ? fieldErrorId('workflow-json-input') : undefined}
      />
      {errors.length > 0 && (
        <FieldBlock.ErrorMsg name="workflow-json-input">
          <span className="space-y-1">
            {errors.map(error => (
              <span key={error} className="block">
                {error}
              </span>
            ))}
          </span>
        </FieldBlock.ErrorMsg>
      )}
      {children}
      <FormSubmitRow {...submitProps} isSubmitLoading={isSubmitLoading} onSubmit={onSubmit} />
    </div>
  );
}
