import { SegmentedControl, SegmentedControlItem } from '@mastra/playground-ui/components/SegmentedControl';

import type { FactoryModelScope } from '../../../../workspaces/services/github';
import { MODEL_LANES, MODEL_ROUTES, connectorPath } from './model-routes';
import type { ModelDefaults, ModelLane } from './model-routes';

const GLYPH_LANE_Y: Record<ModelLane, number> = { chats: 4, runs: 12 };
const GLYPH_DEFAULTS_Y: Record<ModelDefaults, number> = { personal: 4, factory: 12 };

export function ModelRoutingSwitch({
  value,
  pending,
  onValueChange,
}: {
  value: FactoryModelScope;
  pending: boolean;
  onValueChange: (scope: FactoryModelScope) => void;
}) {
  return (
    <SegmentedControl aria-label="Model routing" aria-busy={pending} value={value} onValueChange={onValueChange}>
      <SegmentedControlItem value="user">
        <RouteGlyph scope="user" />
        Personal
      </SegmentedControlItem>
      <SegmentedControlItem value="hybrid">
        <RouteGlyph scope="hybrid" />
        Hybrid
      </SegmentedControlItem>
      <SegmentedControlItem value="factory">
        <RouteGlyph scope="factory" />
        Factory
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
