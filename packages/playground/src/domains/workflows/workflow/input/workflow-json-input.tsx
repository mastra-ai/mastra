import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import type { WorkflowInputDataProps } from '../workflow-input-data';
import { WorkflowSubmitRow } from './workflow-input-submit-row';

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
  withoutSubmit,
  isReadOnly,
  onSubmit,
  ...submitProps
}: WorkflowJsonInputProps) {
  return (
    <div className="flex flex-col gap-4">
      {errors.length > 0 && (
        <div role="alert" className="rounded-lg border border-accent2/30 bg-accent2/5 p-3 text-ui-sm text-accent2">
          <ul className="list-inside list-disc">
            {errors.map(error => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      <CodeEditor value={value} onChange={onChange} editable={!isReadOnly} />
      {children}
      {!withoutSubmit && <WorkflowSubmitRow {...submitProps} onSubmit={onSubmit} />}
    </div>
  );
}
