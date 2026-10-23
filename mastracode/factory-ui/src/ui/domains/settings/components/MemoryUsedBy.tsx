import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';

import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { useFactoryProjectQuery } from '../../../../hooks/useFactoryDefaultModel';
import {
  MODEL_DEFAULTS_TONES,
  MODEL_LANE_ICONS,
  MODEL_LANE_LABELS,
  lanesUsing,
  savedModelScope,
} from './models/routing/model-routes';
import type { ModelDefaults, ModelLane } from './models/routing/model-routes';

export function MemoryUsedBy({ factoryId, defaults }: { factoryId: string; defaults: ModelDefaults }) {
  const authQuery = useFactoryAuth();
  const projectQuery = useFactoryProjectQuery(factoryId);
  if (!authQuery.data || !projectQuery.data) return null;

  // Sign-in off: one process-wide credential set pays for every thread, so all read the Factory's row.
  const memoryScope = authQuery.data.authEnabled ? savedModelScope(projectQuery.data) : 'factory';
  const lanes = lanesUsing(memoryScope, defaults);
  if (lanes.length === 0) {
    return (
      <Txt as="span" variant="meta" tone="muted">
        Not used in this scope
      </Txt>
    );
  }

  return (
    <Txt as="span" variant="meta" tone="muted" className="flex items-center gap-2">
      Used by
      {lanes.map(lane => (
        <LaneBadge key={lane} lane={lane} defaults={defaults} />
      ))}
    </Txt>
  );
}

function LaneBadge({ lane, defaults }: { lane: ModelLane; defaults: ModelDefaults }) {
  const LaneIcon = MODEL_LANE_ICONS[lane];
  return (
    <span className="bg-fill-subtle text-foreground inline-flex h-6 items-center gap-1.5 rounded-md px-2">
      <LaneIcon className={cn('size-3.5', MODEL_DEFAULTS_TONES[defaults])} aria-hidden="true" />
      {MODEL_LANE_LABELS[lane]}
    </span>
  );
}
