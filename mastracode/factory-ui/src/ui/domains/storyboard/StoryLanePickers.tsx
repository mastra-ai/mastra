import { Combobox } from '@mastra/playground-ui/components/Combobox';
import type { ComboboxOption } from '@mastra/playground-ui/components/Combobox';
import { RadioGroup, RadioGroupItem } from '@mastra/playground-ui/components/RadioGroup';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ProviderLogo } from '@mastra/playground-ui/domains/llm/provider-logo';
import type { ReactNode } from 'react';

import { providerDisplayName } from '../settings/components/provider-display-name';
import type { Plan, Provider } from './cast';
import { modelLabel, providerOf, THINKING_LEVELS } from './cast';
import type { Storyboard } from './StoryboardProvider';
import { StoryProviderPicker } from './StoryProviderPicker';
import { SettingSelect } from './StorySettingControls';
import type { FactoryWorkFunding, LaneModel, StoryState } from './storyState';
import { addFactoryKey, factoryKeys, laneAutoOn, laneRunsOn, ownPlansAllowed } from './storyState';
import { useProviderModels } from './useProviderModels';

const DEFAULT_MODEL = 'default';

function isFunding(value: unknown): value is FactoryWorkFunding {
  return value === 'shared' || value === 'owner';
}

const FUNDING_LABELS: Record<FactoryWorkFunding, string> = {
  shared: 'The Factory account',
  owner: "Each card's owner",
};

export function LaneField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Txt as="span" variant="caption" tone="muted">
        {label}
      </Txt>
      {children}
    </div>
  );
}

function SwitchRow({
  label,
  hint,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="flex min-w-0 flex-col">
        <Txt as="span" variant="label" tone={disabled ? 'muted' : 'ink'}>
          {label}
        </Txt>
        <Txt as="span" variant="meta" tone="muted">
          {hint}
        </Txt>
      </span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </label>
  );
}

function fundingHint(state: StoryState, value: FactoryWorkFunding): string | null {
  if (value === 'owner' && !ownPlansAllowed(state)) return "Members' plans are off in Settings";
  return value === state.factoryWorkRunsOn ? 'Board default' : null;
}

function autoHint(ownerLane: boolean, auto: boolean): string {
  if (ownerLane) return 'Only when the Factory account pays';
  return auto ? 'No click needed' : 'Someone clicks Run';
}

export function LanePayerFields({
  storyboard: { state, patch },
  stageId,
}: {
  storyboard: Storyboard;
  stageId: string;
}) {
  const ownerLane = laneRunsOn(state, stageId) === 'owner';
  const auto = laneAutoOn(state, stageId);
  return (
    <LaneField label="Who pays for runs here">
      <RadioGroup
        aria-label="Who pays for runs here"
        value={laneRunsOn(state, stageId)}
        onValueChange={value => {
          if (!isFunding(value)) return;
          patch({
            laneFunding: { ...state.laneFunding, [stageId]: value === state.factoryWorkRunsOn ? undefined : value },
          });
        }}
        className="flex flex-col gap-2"
      >
        {(['shared', 'owner'] satisfies FactoryWorkFunding[]).map(value => {
          const hint = fundingHint(state, value);
          const disabled = value === 'owner' && !ownPlansAllowed(state);
          return (
            <label key={value} className="flex items-center gap-2">
              <RadioGroupItem value={value} disabled={disabled} />
              <Txt as="span" variant="label" tone={disabled ? 'muted' : 'ink'}>
                {FUNDING_LABELS[value]}
              </Txt>
              {hint && (
                <Txt as="span" variant="meta" tone="muted">
                  {hint}
                </Txt>
              )}
            </label>
          );
        })}
      </RadioGroup>
      <SwitchRow
        label="Auto-start when a card arrives"
        hint={autoHint(ownerLane, auto)}
        checked={auto}
        disabled={ownerLane}
        onChange={next => patch({ laneAuto: { ...state.laneAuto, [stageId]: next } })}
      />
    </LaneField>
  );
}

export type ModelSource = { defaultLabel: string; defaultModel?: string; providers: Provider[] };

function uniqueProviders(plans: (Plan | null)[]): Provider[] {
  return [...new Set(plans.flatMap(plan => (plan ? [plan.provider] : [])))];
}

export function factorySource(state: StoryState, account: Plan): ModelSource {
  return {
    defaultLabel: `Board default · ${modelLabel(account.model)}`,
    defaultModel: account.model,
    providers: uniqueProviders(factoryKeys(state)),
  };
}

export function ownerSource(state: StoryState): ModelSource {
  return { defaultLabel: "Each owner's usual model", providers: uniqueProviders(Object.values(state.memberPlans)) };
}

function modelOptions(source: ModelSource, modelsOf: (provider: Provider) => string[]): ComboboxOption[] {
  return [
    { value: DEFAULT_MODEL, label: source.defaultLabel },
    ...source.providers.flatMap(provider =>
      modelsOf(provider).map(model => ({
        value: model,
        label: modelLabel(model),
        description: providerDisplayName(provider),
        start: <ProviderLogo providerId={provider} size={14} />,
      })),
    ),
  ];
}

export function LaneModelFields({
  storyboard,
  stageId,
  source,
  factoryPays,
}: {
  storyboard: Storyboard;
  stageId: string;
  source: ModelSource;
  factoryPays: boolean;
}) {
  const { state, patch } = storyboard;
  const modelsOf = useProviderModels();
  const lane = state.laneModels[stageId];
  const setLane = (next: LaneModel | undefined) => patch({ laneModels: { ...state.laneModels, [stageId]: next } });
  const thinking = lane?.thinking ?? 'medium';
  const currentModel = lane?.model ?? source.defaultModel;

  return (
    <LaneField label="Model">
      <Combobox
        aria-label="Lane model"
        options={modelOptions(source, modelsOf)}
        value={lane?.model ?? DEFAULT_MODEL}
        onValueChange={value => setLane(providerOf(value) ? { thinking, model: value } : undefined)}
        searchPlaceholder="Search models…"
        className="w-full"
      />
      {currentModel && (
        <SettingSelect
          label="Thinking"
          value={thinking}
          options={THINKING_LEVELS}
          onChange={level => setLane({ model: currentModel, thinking: level })}
          className="w-full"
        />
      )}
      {lane && factoryPays && (
        <SwitchRow
          label="Use it for every card here"
          hint="Cards can't pick another model"
          checked={lane.locked ?? false}
          onChange={locked => setLane({ ...lane, locked })}
        />
      )}
      {factoryPays && (
        <StoryProviderPicker
          kind="api-key"
          state={state}
          label="Connect another provider"
          className="w-full"
          onPick={key => patch(addFactoryKey(state, key))}
        />
      )}
    </LaneField>
  );
}
