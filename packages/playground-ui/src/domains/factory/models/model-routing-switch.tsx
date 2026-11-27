import { MODEL_LANES, MODEL_ROUTES, MODEL_SCOPE_LABELS, connectorPath } from './model-routes';
import type { FactoryModelScope, ModelDefaults, ModelLane } from './model-routes';

import { SegmentedControl, SegmentedControlItem } from '@/ds/components/SegmentedControl';

const GLYPH_LANE_Y: Record<ModelLane, number> = { chats: 4, runs: 12 };
const GLYPH_DEFAULTS_Y: Record<ModelDefaults, number> = { personal: 4, factory: 12 };

export function ModelRoutingSwitch({
  value,
  pending,
  disabled,
  onValueChange,
}: {
  value: FactoryModelScope;
  pending: boolean;
  disabled?: boolean;
  onValueChange: (scope: FactoryModelScope) => void;
}) {
  return (
    <SegmentedControl
      aria-label="Model routing"
      aria-busy={pending}
      disabled={disabled}
      value={value}
      onValueChange={onValueChange}
    >
      <SegmentedControlItem value="user">
        <RouteGlyph scope="user" />
        {MODEL_SCOPE_LABELS.user}
      </SegmentedControlItem>
      <SegmentedControlItem value="hybrid">
        <RouteGlyph scope="hybrid" />
        {MODEL_SCOPE_LABELS.hybrid}
      </SegmentedControlItem>
      <SegmentedControlItem value="factory">
        <RouteGlyph scope="factory" />
        {MODEL_SCOPE_LABELS.factory}
      </SegmentedControlItem>
    </SegmentedControl>
  );
}

function RouteGlyph({ scope }: { scope: FactoryModelScope }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden>
      {MODEL_LANES.map(lane => (
        <path key={lane} d={connectorPath(1, GLYPH_LANE_Y[lane], 15, GLYPH_DEFAULTS_Y[MODEL_ROUTES[scope][lane]])} />
      ))}
    </svg>
  );
}
