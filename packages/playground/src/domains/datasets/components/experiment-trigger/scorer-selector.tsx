import { Combobox } from '@mastra/playground-ui/components/Combobox';
import { Label } from '@mastra/playground-ui/components/Label';
import { useMemo } from 'react';
import { useScorers } from '@/domains/scores/hooks/use-scorers';

export interface ScorerSelectorProps {
  selectedScorers: string[];
  setSelectedScorers: (scorers: string[]) => void;
  disabled?: boolean;
  container?: React.RefObject<HTMLElement | null>;
}

export function ScorerSelector({
  selectedScorers,
  setSelectedScorers,
  disabled = false,
  container,
}: ScorerSelectorProps) {
  const { data: scorers, isLoading } = useScorers();

  const options = useMemo(() => {
    if (!scorers) return [];
    return Object.entries(scorers).map(([id, scorer]) => ({
      value: id,
      label: (scorer as { scorer?: { config?: { name?: string } } }).scorer?.config?.name || id,
      description: (scorer as { scorer?: { config?: { description?: string } } }).scorer?.config?.description || '',
    }));
  }, [scorers]);

  return (
    <div className="grid gap-2">
      <Label>Scorers (Optional)</Label>
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
