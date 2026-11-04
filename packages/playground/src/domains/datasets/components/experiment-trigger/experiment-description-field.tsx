import { Field, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Textarea } from '@mastra/playground-ui/components/Textarea';

export interface ExperimentDescriptionFieldProps {
  description: string;
  onDescriptionChange: (description: string) => void;
  disabled: boolean;
}

export function ExperimentDescriptionField({
  description,
  onDescriptionChange,
  disabled,
}: ExperimentDescriptionFieldProps) {
  return (
    <Field>
      <FieldLabel>Description</FieldLabel>
      <Textarea
        value={description}
        onChange={event => onDescriptionChange(event.target.value)}
        placeholder="Optional"
        rows={2}
        disabled={disabled}
      />
    </Field>
  );
}
