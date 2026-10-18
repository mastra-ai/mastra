import { Combobox } from '@mastra/playground-ui/components/Combobox';
import { Field, FieldDescription, FieldLabel } from '@mastra/playground-ui/components/Field';
import { useScorers } from '@/domains/scores/hooks/use-scorers';

export interface ScorerSelectorProps {
  selectedScorers: string[];
  setSelectedScorers: (scorers: string[]) => void;
  disabled?: boolean;
  container?: React.RefObject<HTMLElement | null>;
  label?: React.ReactNode;
  helperText?: string;
}

export function ScorerSelector({
  selectedScorers,
  setSelectedScorers,
  disabled = false,
  container,
  label = 'Scorers (Optional)',
  helperText,
}: ScorerSelectorProps) {
  const { data: scorers, isLoading } = useScorers();
  const options = Object.entries(scorers ?? {})
    .filter(([, scorer]) => scorer.isRegistered)
    .map(([id, scorer]) => ({
      value: id,
      label: scorer.scorer?.config?.name || id,
      description: scorer.scorer?.config?.description || '',
    }));

  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Combobox
        multiple
        options={options}
        value={selectedScorers}
        onValueChange={setSelectedScorers}
        placeholder="Select scorers..."
        searchPlaceholder="Search scorers..."
        emptyText="No scorers available"
        disabled={disabled || isLoading}
        container={container}
      />
      {helperText && <FieldDescription>{helperText}</FieldDescription>}
    </Field>
  );
}
