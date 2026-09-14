import { CrumbSkeleton } from '@mastra/playground-ui/components/Breadcrumb';
import { useParams } from 'react-router';
import { ScorerCombobox } from './components/scorer-combobox';
import { useScorers } from './hooks/use-scorers';
import { useStoredScorer } from './hooks/use-stored-scorers';

export function ScorerCrumb() {
  const { scorerId } = useParams<{ scorerId: string }>();
  const { data: scorers, isLoading } = useScorers();
  if (!scorerId) return null;
  if (isLoading) return <CrumbSkeleton />;

  return scorers?.[scorerId]?.scorer.config.name || scorerId;
}

export function ScorerSwitcherAction() {
  const { scorerId } = useParams<{ scorerId: string }>();
  if (!scorerId) return null;

  return <ScorerCombobox value={scorerId} variant="ghost" size="icon-sm" align="end" aria-label="Switch scorer" />;
}

export function StoredScorerCrumb() {
  const { scorerId } = useParams<{ scorerId: string }>();
  const { data: scorer, isLoading } = useStoredScorer(scorerId, { status: 'draft' });

  if (!scorerId) return null;
  if (isLoading) return <CrumbSkeleton />;

  return scorer?.name ?? 'Scorer not found';
}
