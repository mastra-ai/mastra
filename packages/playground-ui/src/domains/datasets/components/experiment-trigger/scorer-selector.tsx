import { useScorers } from '@/domains/scores/hooks/use-scorers';
import { Checkbox } from '@/ds/components/Checkbox';
import { Label } from '@/ds/components/Label';
import { Skeleton } from '@/ds/components/Skeleton';

export interface ScorerSelectorProps {
  selectedScorers: string[];
  setSelectedScorers: (scorers: string[]) => void;
  disabled?: boolean;
}

export function ScorerSelector({ selectedScorers, setSelectedScorers, disabled = false }: ScorerSelectorProps) {
  const { data: scorers, isLoading } = useScorers();

  const scorersList = Object.entries(scorers ?? {}).map(([id, scorer]) => ({
    id,
    name: scorer.scorer?.config?.name ?? id,
    description: scorer.scorer?.config?.description,
  }));

  const handleScorerToggle = (scorerId: string) => {
    if (selectedScorers.includes(scorerId)) {
      setSelectedScorers(selectedScorers.filter(id => id !== scorerId));
    } else {
      setSelectedScorers([...selectedScorers, scorerId]);
    }
  };

  if (isLoading) {
    return (
      <div className="grid gap-2">
        <Label>Scorers (Optional)</Label>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-6 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (scorersList.length === 0) {
    return (
      <div className="grid gap-2">
        <Label>Scorers (Optional)</Label>
        <p className="text-ui-sm text-neutral3">
          No scorers configured. Scorers can be added to evaluate the run results.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <Label>Scorers (Optional)</Label>
      <p className="text-ui-sm text-neutral3 mb-2">Select scorers to evaluate the run results.</p>
      <div className="space-y-3 max-h-48 overflow-y-auto">
        {scorersList.map(scorer => (
          <label
            key={scorer.id}
            className="flex items-start gap-3 cursor-pointer hover:bg-surface3 rounded-md p-2 -m-2 transition-colors"
          >
            <Checkbox
              checked={selectedScorers.includes(scorer.id)}
              onCheckedChange={() => handleScorerToggle(scorer.id)}
              disabled={disabled}
            />
            <div className="grid gap-0.5">
              <span className="text-ui-sm text-neutral5">{scorer.name}</span>
              {scorer.description && <span className="text-ui-xs text-neutral3">{scorer.description}</span>}
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
