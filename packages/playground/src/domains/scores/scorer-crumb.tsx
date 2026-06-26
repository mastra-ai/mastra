import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { useParams } from 'react-router';
import { ScorerCombobox } from './components/scorer-combobox';
import { useStoredScorer } from './hooks/use-stored-scorers';

export function ScorerCrumb() {
  const { scorerId } = useParams<{ scorerId: string }>();
  if (!scorerId) return null;

  return <ScorerCombobox value={scorerId} variant="ghost" />;
}

export function StoredScorerCrumb() {
  const { scorerId } = useParams<{ scorerId: string }>();
  const { data: scorer, isLoading } = useStoredScorer(scorerId, { status: 'draft' });

  if (!scorerId) return null;
  if (isLoading) return <Skeleton className="h-5 w-36" />;

  return scorer?.name ?? 'Scorer not found';
}
