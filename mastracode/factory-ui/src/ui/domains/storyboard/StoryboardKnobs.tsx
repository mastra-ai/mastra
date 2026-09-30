import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ChevronRight } from 'lucide-react';

import type { Actor, PersonaId } from './cast';
import { PERSONA_IDS, PLANS, actorName } from './cast';
import type { Storyboard } from './StoryboardProvider';
import { WORK_LANES } from './storyBoards';
import type { FactoryWorkFunding } from './storyState';

type KnobOption<Value extends string> = { value: Value; label: string };

const PERSONA_OPTIONS: KnobOption<PersonaId>[] = PERSONA_IDS.map(id => ({ value: id, label: actorName(id) }));
const NO_LANE = 'none';
const LANE_OPTIONS: KnobOption<string>[] = [
  { value: NO_LANE, label: 'Not on the board' },
  ...WORK_LANES.map(lane => ({ value: lane.stage, label: lane.label })),
];
const OWNER_OPTIONS: KnobOption<Actor>[] = [...PERSONA_OPTIONS, { value: 'factory', label: actorName('factory') }];
const RUNS_ON_OPTIONS: KnobOption<FactoryWorkFunding>[] = [
  { value: 'shared', label: 'Factory account' },
  { value: 'owner', label: 'Owner’s plan' },
];

export function KnobSelect<Value extends string>({
  label,
  value,
  options,
  onChange,
  popupContainer,
  wide = false,
}: {
  label: string;
  value: Value;
  options: KnobOption<Value>[];
  onChange: (next: Value) => void;
  popupContainer: HTMLElement | null;
  wide?: boolean;
}) {
  return (
    <div className={wide ? 'flex flex-col gap-1' : 'flex items-center justify-between gap-2'}>
      <Txt as="span" variant="caption" tone="muted">
        {label}
      </Txt>
      <Select
        value={value}
        onValueChange={next => {
          const picked = options.find(option => option.value === next);
          if (picked) onChange(picked.value);
        }}
      >
        <SelectTrigger size="sm" aria-label={label} className={wide ? 'w-full' : 'w-36'}>
          <span className="truncate">{options.find(option => option.value === value)?.label}</span>
        </SelectTrigger>
        <SelectContent container={popupContainer}>
          {options.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function KnobSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Txt as="span" variant="caption" tone="muted">
        {label}
      </Txt>
      <Switch aria-label={label} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function StoryboardKnobs({
  storyboard,
  popupContainer,
}: {
  storyboard: Storyboard;
  popupContainer: HTMLElement | null;
}) {
  const { state, patch, patchCard } = storyboard;
  const focusCard = state.cards[0];

  return (
    <Collapsible>
      <CollapsibleTrigger className="text-muted-foreground flex w-full items-center gap-1 py-1 text-left">
        <ChevronRight className="size-3" />
        <Txt as="span" variant="caption">
          Knobs
        </Txt>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-2 pt-2">
          <KnobSelect
            label="Viewer"
            value={state.viewer}
            options={PERSONA_OPTIONS}
            onChange={viewer => patch({ viewer })}
            popupContainer={popupContainer}
          />
          <KnobSwitch
            label="Factory account"
            checked={state.sharedAccount !== null}
            onChange={connected => patch({ sharedAccount: connected ? PLANS.companyAnthropicKey : null })}
          />
          <KnobSelect
            label="Factory work on"
            value={state.factoryWorkRunsOn}
            options={RUNS_ON_OPTIONS}
            onChange={factoryWorkRunsOn => patch({ factoryWorkRunsOn })}
            popupContainer={popupContainer}
          />
          <KnobSwitch
            label="Agent running"
            checked={state.cards[0]?.running ?? false}
            onChange={running =>
              patch({ cards: state.cards.map((card, index) => (index === 0 ? { ...card, running } : card)) })
            }
          />
          <KnobSwitch
            label="Steering hint seen"
            checked={state.steerHintSeen}
            onChange={steerHintSeen => patch({ steerHintSeen })}
          />
          <KnobSwitch
            label="Personal sessions"
            checked={state.personalSessions}
            onChange={personalSessions => patch({ personalSessions })}
          />
          <KnobSwitch label="Auto-start runs" checked={state.autoRun} onChange={autoRun => patch({ autoRun })} />
          <KnobSwitch
            label="Memory model broken"
            checked={state.memory.broken}
            onChange={broken => patch({ memory: { ...state.memory, broken } })}
          />
          {focusCard && (
            <KnobSelect
              label="Focus card owner"
              value={focusCard.owner}
              options={OWNER_OPTIONS}
              onChange={owner => patchCard(0, { ...focusCard, owner })}
              popupContainer={popupContainer}
            />
          )}
          {focusCard && (
            <KnobSelect
              label="Focus card lane"
              value={focusCard.lane ?? NO_LANE}
              options={LANE_OPTIONS}
              onChange={lane => patchCard(0, { ...focusCard, lane: lane === NO_LANE ? undefined : lane })}
              popupContainer={popupContainer}
            />
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
