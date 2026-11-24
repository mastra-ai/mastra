import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { Field, FieldLabel } from '@mastra/playground-ui/components/Field';
import { RequestContextForm } from './request-context-form';

export interface RequestContextFieldProps {
  schema?: Record<string, unknown>;
  raw: string;
  onRawChange: (raw: string) => void;
  onValuesChange: (values: Record<string, unknown>) => void;
}

/** A form when the dataset has a request context schema, a JSON editor otherwise. */
export function RequestContextField({ schema, raw, onRawChange, onValuesChange }: RequestContextFieldProps) {
  if (schema) return <RequestContextForm requestContextSchema={schema} onChange={onValuesChange} />;

  return (
    <Field>
      <FieldLabel>Request context (JSON)</FieldLabel>
      <CodeEditor
        value={raw}
        onChange={onRawChange}
        showCopyButton={false}
        aria-label="Request context JSON"
        className="min-h-[120px]"
      />
    </Field>
  );
}
