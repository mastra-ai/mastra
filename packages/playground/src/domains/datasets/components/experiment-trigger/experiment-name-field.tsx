import { Field, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Input } from '@mastra/playground-ui/components/Input';

export interface ExperimentNameFieldProps {
  name: string;
  defaultName: string;
  onNameChange: (name: string) => void;
  disabled: boolean;
}

/** The default name shows as the placeholder until the user types one. */
export function ExperimentNameField({ name, defaultName, onNameChange, disabled }: ExperimentNameFieldProps) {
  return (
    <Field>
      <FieldLabel>Experiment name</FieldLabel>
      <Input
        value={name}
        placeholder={defaultName}
        onChange={event => onNameChange(event.target.value)}
        disabled={disabled}
      />
    </Field>
  );
}
