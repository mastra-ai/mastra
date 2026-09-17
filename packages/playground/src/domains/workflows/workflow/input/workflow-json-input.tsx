import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
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
      {errors.length > 0 && (
        <div role="alert" className="border-accent2/30 bg-accent2/5 text-ui-sm text-accent2 rounded-lg border p-3">
          <ul className="list-inside list-disc">
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      <CodeEditor value={value} onChange={onChange} editable={!isSubmitLoading} />
      {children}
      <FormSubmitRow {...submitProps} isSubmitLoading={isSubmitLoading} onSubmit={onSubmit} />
    </div>
  );
}
