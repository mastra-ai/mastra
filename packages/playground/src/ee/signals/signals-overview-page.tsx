import { SignalsOverviewPage as SignalsEmptyState } from '@mastra/playground-ui/ee/signals';

import { Link } from '../../lib/link';
import { useThemeEntities } from './hooks';
import { SankeySignals } from './sankey-signals';
import { SignalsLoadingSkeleton } from './signals-loading-skeleton';
import type { TraceSignalName } from './types';

const SIGNAL_ORDER: TraceSignalName[] = ['goal', 'outcome', 'behavior', 'sentiment'];

export function SignalsOverviewPage() {
  const entitiesQuery = useThemeEntities('agent');

  if (entitiesQuery.isPending) {
    return <SignalsLoadingSkeleton />;
  }

  if (entitiesQuery.isError) {
    return <p>Unable to load signal entities.</p>;
  }

  const entity = entitiesQuery.data?.entities.find(currentEntity => currentEntity.availableSignals.length >= 2);

  if (!entity) {
    return <SignalsEmptyState LinkComponent={Link} />;
  }

  const signalNames = SIGNAL_ORDER.filter(signalName => entity.availableSignals.includes(signalName));

  if (signalNames.length < 2) {
    return <SignalsEmptyState LinkComponent={Link} />;
  }

  return <SankeySignals entityId={entity.entityId} entityType="agent" signalNames={signalNames} />;
}
