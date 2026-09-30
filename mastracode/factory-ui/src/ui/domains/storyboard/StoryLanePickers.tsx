import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { ProviderLogo } from '@mastra/playground-ui/domains/llm/provider-logo';

import type { Plan, Provider } from './cast';
import { providerDisplayName } from '../settings/components/provider-display-name';
import { modelsFrom, PROVIDERS, providerOf, THINKING_LEVELS } from './cast';
import type { Storyboard } from './StoryboardProvider';
import type { FactoryWorkFunding, LaneModel, StoryState } from './storyState';
import { factoryKeys, laneAutoOn, laneRunsOn, ownPlansAllowed } from './storyState';

const DEFAULT_MODEL = 'default';

function isFunding(value: unknown): value is FactoryWorkFunding {
  return value === 'shared' || value === 'owner';
}

const FUNDING_LABELS: Record<FactoryWorkFunding, string> = {
  shared: 'The Factory account',
  owner: "Each card's owner",
};

export function LanePayerPicker({
  storyboard: { state, patch },
  stageId,
}: {
  storyboard: Storyboard;
  stageId: string;
}) {
  const boardDefault = state.factoryWorkRunsOn;
  const ownerLane = laneRunsOn(state, stageId) === 'owner';
  const auto = laneAutoOn(state, stageId);
  return (
    <>
      <DropdownMenu.Label>Who pays for runs here</DropdownMenu.Label>
      <DropdownMenu.RadioGroup
        value={laneRunsOn(state, stageId)}
        onValueChange={value => {
          if (!isFunding(value)) return;
          const laneFunding = { ...state.laneFunding, [stageId]: value === boardDefault ? undefined : value };
          patch({ laneFunding });
        }}
      >
        {(['shared', 'owner'] satisfies FactoryWorkFunding[]).map(value => (
          <DropdownMenu.RadioItem key={value} value={value} disabled={value === 'owner' && !ownPlansAllowed(state)}>
            {FUNDING_LABELS[value]}
            {value === boardDefault && <span className="text-muted-foreground">· board default</span>}
            {value === 'owner' && !ownPlansAllowed(state) && (
              <span className="text-muted-foreground">· members' plans are off in Settings</span>
            )}
          </DropdownMenu.RadioItem>
        ))}
      </DropdownMenu.RadioGroup>
      <DropdownMenu.Item
        role="menuitemcheckbox"
        aria-checked={auto}
        disabled={ownerLane}
        closeOnClick={false}
        onClick={() => patch({ laneAuto: { ...state.laneAuto, [stageId]: !auto } })}
      >
        <span className="flex min-w-0 flex-col items-start">
          Auto-start when a card arrives
          <span className="text-muted-foreground text-xs">
            {ownerLane ? 'Only when the Factory account pays' : auto ? 'No click needed' : 'Someone clicks Run'}
          </span>
        </span>
        <Switch checked={auto} disabled={ownerLane} tabIndex={-1} aria-hidden className="pointer-events-none ml-auto" />
      </DropdownMenu.Item>
      <DropdownMenu.Separator />
    </>
  );
}

export type ModelSource = { defaultLabel: string; defaultModel?: string; usable: (provider: Provider) => boolean };

export function factorySource(state: StoryState, account: Plan): ModelSource {
  const covered = factoryKeys(state).map(key => key.provider);
  return {
    defaultLabel: `Board default · ${account.model}`,
    defaultModel: account.model,
    usable: provider => covered.includes(provider),
  };
}

export const OWNER_SOURCE: ModelSource = { defaultLabel: "Each owner's usual model", usable: () => true };

function ModelChoices({ source }: { source: ModelSource }) {
  return (
    <>
      <DropdownMenu.RadioItem value={DEFAULT_MODEL}>{source.defaultLabel}</DropdownMenu.RadioItem>
      {PROVIDERS.map(provider => {
        const usable = source.usable(provider);
        return (
          <DropdownMenu.Group key={provider}>
            <DropdownMenu.Label className="flex items-center gap-1.5">
              <ProviderLogo providerId={provider} size={12} />
              {providerDisplayName(provider)}
              {!usable && <span className="font-normal">· add a Factory key first</span>}
            </DropdownMenu.Label>
            {modelsFrom(provider).map(model => (
              <DropdownMenu.RadioItem key={model} value={model} disabled={!usable}>
                {model}
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.Group>
        );
      })}
    </>
  );
}

export function LanePickers({
  storyboard,
  stageId,
  source,
  lockable,
}: {
  storyboard: Storyboard;
  stageId: string;
  source: ModelSource;
  lockable: boolean;
}) {
  const { state, patch } = storyboard;
  const lane = state.laneModels[stageId];
  const setLane = (next: LaneModel | undefined) => patch({ laneModels: { ...state.laneModels, [stageId]: next } });
  const currentModel = lane?.model ?? source.defaultModel;
  const thinking = lane?.thinking ?? 'medium';

  return (
    <>
      <DropdownMenu.Label>Model</DropdownMenu.Label>
      <DropdownMenu.RadioGroup
        value={lane?.model ?? DEFAULT_MODEL}
        onValueChange={value => {
          const provider = providerOf(String(value));
          setLane(provider && source.usable(provider) ? { thinking, model: String(value) } : undefined);
        }}
      >
        <ModelChoices source={source} />
      </DropdownMenu.RadioGroup>
      <DropdownMenu.Separator />
      <DropdownMenu.Label>Thinking{currentModel ? '' : ' · pick a model first'}</DropdownMenu.Label>
      <DropdownMenu.RadioGroup
        value={lane?.thinking ?? null}
        onValueChange={value => {
          const level = THINKING_LEVELS.find(option => option.value === value);
          if (level && currentModel) setLane({ model: currentModel, thinking: level.value });
        }}
      >
        {THINKING_LEVELS.map(level => (
          <DropdownMenu.RadioItem key={level.value} value={level.value} disabled={!currentModel}>
            {level.label}
          </DropdownMenu.RadioItem>
        ))}
      </DropdownMenu.RadioGroup>
      {lane && lockable && (
        <DropdownMenu.CheckboxItem
          checked={lane.locked ?? false}
          onCheckedChange={locked => setLane({ ...lane, locked })}
          closeOnClick={false}
        >
          Use it for every card here
        </DropdownMenu.CheckboxItem>
      )}
      <DropdownMenu.Separator />
    </>
  );
}
