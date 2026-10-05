import { CrumbSkeleton, crumbSwitcherTriggerProps } from '@mastra/playground-ui/components/Breadcrumb';
import { useStoredScorer } from '@mastra/react/hooks';
import { useParams } from 'react-router';
import { ScorerCombobox } from './components/scorer-combobox';
import { useScorers } from './hooks/use-scorers';

export function ScorerCrumb() {
  const { scorerId } = useParams<{ scorerId: string }>();
  const { data: scorers, isLoading } = useScorers();
  if (!scorerId) return null;
  if (isLoading) return <CrumbSkeleton />;

  return scorers?.[scorerId]?.scorer.config.name || scorerId;
}

export function ScorerSwitcher() {
  const { scorerId } = useParams<{ scorerId: string }>();
  if (!scorerId) return null;

  return <ScorerCombobox value={scorerId} {...crumbSwitcherTriggerProps} aria-label="Switch scorer" />;
}

export function StoredScorerCrumb() {
  const { scorerId } = useParams<{ scorerId: string }>();
  const { data: scorer, isLoading } = useStoredScorer({
    scorerId: scorerId,
    status: 'draft',
    queryOptions: { enabled: Boolean(scorerId) },
  });

  if (!scorerId) return null;
  if (isLoading) return <CrumbSkeleton />;

  return scorer?.name ?? 'Scorer not found';
}
