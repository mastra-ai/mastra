import { FieldError } from '@mastra/playground-ui/components/Field';

export interface DatasetFieldErrorsProps {
  field: string;
  errors: Array<{ path: string; message: string }>;
}

export function DatasetFieldErrors({ field, errors }: DatasetFieldErrorsProps) {
  if (errors.length === 0) return null;

  return (
    <FieldError>
      <span className="space-y-1">
        {errors.map(error => (
          <span key={`${error.path}:${error.message}`} className="block">
            <code className="rounded bg-destructive/10 px-1">
              {field}
              {error.path !== '/' ? error.path : ''}
            </code>
            : {error.message}
          </span>
        ))}
      </span>
    </FieldError>
  );
}
