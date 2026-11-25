import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';

import type { FactoryModelScope } from '../../../../workspaces/services/github';
import {
  MODEL_DEFAULTS_TONES,
  MODEL_DEFAULTS_UNUSED_NOTE,
  MODEL_LANE_ICONS,
  MODEL_LANE_LABELS,
  lanesUsing,
} from './model-routes';
import type { ModelDefaults, ModelLane } from './model-routes';

export function UsedByLanes({ scope, defaults }: { scope: FactoryModelScope; defaults: ModelDefaults }) {
  const lanes = lanesUsing(scope, defaults);
  if (lanes.length === 0) {
    return (
      <Txt as="span" variant="meta" tone="muted">
        {MODEL_DEFAULTS_UNUSED_NOTE}
      </Txt>
    );
  }

  return (
    <Txt as="span" variant="meta" tone="muted" className="flex flex-wrap items-center gap-2">
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
