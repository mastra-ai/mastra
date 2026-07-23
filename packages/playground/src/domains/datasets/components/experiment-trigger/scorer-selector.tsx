import { Combobox } from '@mastra/playground-ui/components/Combobox';
import { Label } from '@mastra/playground-ui/components/Label';
import { useScorers } from '@/domains/scores/hooks/use-scorers';

export interface ScorerSelectorProps {
  selectedScorers: string[];
  setSelectedScorers: (scorers: string[]) => void;
  disabled?: boolean;
  container?: React.RefObject<HTMLElement | null>;
  label?: string;
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
    <div className="grid gap-2">
      <Label>{label}</Label>
      {helperText ? <p className="text-xs text-muted-foreground">{helperText}</p> : null}
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
    </div>
  );
}
