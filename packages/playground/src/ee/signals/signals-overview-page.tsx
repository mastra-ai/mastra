import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui/components/Select';
import { SignalsOverviewPage as SignalsEmptyState } from '@mastra/playground-ui/ee/signals';
import { useState } from 'react';

import { Link } from '../../lib/link';
import { useThemeEntities } from './hooks';
import { SankeySignals } from './sankey-signals';
import { SignalsLoadingSkeleton } from './signals-loading-skeleton';
import type { ThemeLearningEntity, TraceSignalName } from './types';

const SIGNAL_ORDER: TraceSignalName[] = ['goal', 'outcome', 'behavior', 'sentiment'];

function formatSignalName(signalName: TraceSignalName) {
  return signalName.charAt(0).toUpperCase() + signalName.slice(1);
}

function AgentSelector({
  entities,
  selectedEntityId,
  onEntityChange,
}: {
  entities: ThemeLearningEntity[];
  selectedEntityId: string;
  onEntityChange: (entityId: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-6 pt-6">
      <label className="text-xs font-medium text-neutral4" htmlFor="signals-agent-selector">
        Agent
      </label>
      <Select value={selectedEntityId} onValueChange={onEntityChange}>
        <SelectTrigger className="w-64" id="signals-agent-selector" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {entities.map(entity => (
            <SelectItem key={entity.entityId} value={entity.entityId}>
              {entity.entityId}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function SignalsOverviewPage() {
  const entitiesQuery = useThemeEntities('agent');
  const [selectedEntityId, setSelectedEntityId] = useState<string>();

  if (entitiesQuery.isPending) {
    return <SignalsLoadingSkeleton />;
  }

  if (entitiesQuery.isError) {
    return <p>Unable to load signal entities.</p>;
  }

  const entities = entitiesQuery.data?.entities ?? [];
  const entity = entities.find(currentEntity => currentEntity.entityId === selectedEntityId) ?? entities[0];

  if (!entity) {
    return <SignalsEmptyState LinkComponent={Link} />;
  }

  const signalNames = SIGNAL_ORDER.filter(signalName => entity.availableSignals.includes(signalName));

  return (
    <>
      <AgentSelector entities={entities} selectedEntityId={entity.entityId} onEntityChange={setSelectedEntityId} />
      {signalNames.length >= 2 ? (
        <SankeySignals key={entity.entityId} entityId={entity.entityId} entityType="agent" signalNames={signalNames} />
      ) : (
        <section
          className="m-6 rounded-lg border border-border1 bg-surface2 p-6"
          aria-labelledby="signals-data-heading"
        >
          <h1 className="text-lg font-semibold text-neutral6" id="signals-data-heading">
            Not enough signal data yet
          </h1>
          <p className="mt-2 text-sm text-neutral3">
            At least two signal types are needed to show how themes connect across traces.
          </p>
          <p className="mt-4 text-xs text-neutral4">
            Available signals: {signalNames.length > 0 ? signalNames.map(formatSignalName).join(', ') : 'None'}
          </p>
        </section>
      )}
    </>
  );
}
