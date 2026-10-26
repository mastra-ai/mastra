import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';

import { useFactoryProjectQuery } from '../../../../hooks/useFactoryDefaultModel';
import {
  MODEL_DEFAULTS_TONES,
  MODEL_DEFAULTS_UNUSED_NOTE,
  MODEL_LANE_ICONS,
  MODEL_LANE_LABELS,
  lanesUsing,
  savedModelScope,
} from './models/routing/model-routes';
import type { ModelDefaults, ModelLane } from './models/routing/model-routes';

export function MemoryUsedBy({ factoryId, defaults }: { factoryId: string; defaults: ModelDefaults }) {
  const projectQuery = useFactoryProjectQuery(factoryId);
  if (!projectQuery.data) return null;

  const lanes = lanesUsing(savedModelScope(projectQuery.data), defaults);
  if (lanes.length === 0) {
    return (
      <Txt as="span" variant="meta" tone="muted">
        {MODEL_DEFAULTS_UNUSED_NOTE}
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
