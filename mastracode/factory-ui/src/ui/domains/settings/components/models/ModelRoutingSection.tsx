import { SegmentedControl, SegmentedControlItem } from '@mastra/playground-ui/components/SegmentedControl';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';

import { useFactoryProjectQuery, useSetFactoryModelScopeMutation } from '../../../../../hooks/useFactoryDefaultModel';
import { SkeletonRows } from '../../../../ui/SkeletonRows';
import type { FactoryModelScope } from '../../../workspaces/services/github';
import { FactoryThinkingControl } from '../FactoryThinkingControl';
import { SettingsSubsection } from '../SettingsSubsection';
import { MODEL_LANES, MODEL_ROUTES, connectorPath } from './model-routes';
import type { ModelDefaults, ModelLane } from './model-routes';
import { ModelRoutingMap } from './ModelRoutingMap';

const SCOPE_OPTIONS: Array<{ scope: FactoryModelScope; label: string }> = [
  { scope: 'user', label: 'Personal' },
  { scope: 'hybrid', label: 'Hybrid' },
  { scope: 'factory', label: 'Factory' },
];

const GLYPH_LANE_Y: Record<ModelLane, number> = { chats: 4, runs: 12 };
const GLYPH_DEFAULTS_Y: Record<ModelDefaults, number> = { personal: 4, factory: 12 };

export function ModelRoutingSection({ factoryId }: { factoryId: string }) {
  const projectQuery = useFactoryProjectQuery(factoryId);
  const setModelScope = useSetFactoryModelScopeMutation(factoryId);
  const pendingScope = setModelScope.isPending ? setModelScope.variables : undefined;
  const savedScope = projectQuery.data ? (projectQuery.data.modelScope ?? 'hybrid') : undefined;
  const modelScope = pendingScope ?? savedScope;
  const error = setModelScope.error ?? projectQuery.error;

  const pickScope = (scope: FactoryModelScope) => {
    if (scope === modelScope || setModelScope.isPending) return;
    setModelScope.mutate(scope);
  };

  return (
    <SettingsSubsection
      scope="factory"
      title="Model routing"
      description="Which defaults chats and work-item runs use."
      action={
        modelScope && (
          <SegmentedControl
            aria-label="Model routing"
            aria-busy={setModelScope.isPending}
            value={modelScope}
            onValueChange={pickScope}
          >
            {SCOPE_OPTIONS.map(({ scope, label }) => (
              <SegmentedControlItem key={scope} value={scope}>
                <RouteGlyph scope={scope} />
                {label}
              </SegmentedControlItem>
            ))}
          </SegmentedControl>
        )
      }
    >
      <div className="flex flex-col gap-6">
        {error && (
          <Txt as="p" variant="caption" className="text-destructive-foreground" role="alert">
            {error.message}
          </Txt>
        )}
        {projectQuery.isPending && <SkeletonRows label="Loading model routing" rows={2} rowClassName="h-36 w-full" />}
        {modelScope && <ModelRoutingMap factoryId={factoryId} modelScope={modelScope} />}
        <SettingsContainer>
          <SettingsRow
            label="Thinking"
            description="Every chat and work-item run in this Factory starts at this level."
          >
            <FactoryThinkingControl factoryId={factoryId} />
          </SettingsRow>
        </SettingsContainer>
      </div>
    </SettingsSubsection>
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
