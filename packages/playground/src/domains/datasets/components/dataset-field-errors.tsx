import { FieldBlock } from '@mastra/playground-ui/components/FormFieldBlocks';

export interface DatasetFieldErrorsProps {
  name: string;
  field: string;
  errors: Array<{ path: string; message: string }>;
}

export function DatasetFieldErrors({ name, field, errors }: DatasetFieldErrorsProps) {
  if (errors.length === 0) return null;

  return (
    <FieldBlock.ErrorMsg name={name}>
      <span className="space-y-1">
        {errors.map(error => (
          <span key={`${error.path}:${error.message}`} className="block">
            <code className="bg-destructive/10 rounded px-1">
              {field}
              {error.path !== '/' ? error.path : ''}
            </code>
            : {error.message}
          </span>
        ))}
      </span>
    </FieldBlock.ErrorMsg>
  );
}
