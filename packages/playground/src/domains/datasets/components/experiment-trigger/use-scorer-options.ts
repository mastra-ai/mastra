import type { ScorerOption } from './experiment-trigger-options';
import { useScorers } from '@/domains/scores/hooks/use-scorers';

/** The registered scorers, for picking which ones grade the outputs. */
export function useScorerOptions(): ScorerOption[] {
  const { data: scorers } = useScorers();
  return Object.entries(scorers ?? {})
    .filter(([, scorer]) => scorer.isRegistered)
    .map(([id, scorer]) => ({
      value: id,
      label: scorer.scorer?.config?.name || id,
      description: scorer.scorer?.config?.description || undefined,
    }));
}
