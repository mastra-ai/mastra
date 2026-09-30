import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';

import { PERSONA_IDS } from './cast';
import { memberLine } from './modelRouting';
import type { Storyboard } from './StoryboardProvider';
import { MemberStack, PlanChip } from './StoryPayee';
import type { FactoryWorkFunding } from './storyState';
import { factoryKeys, laneRunsOn, ownPlansAllowed } from './storyState';
import { storyBoardLanes } from './storyBoards';

function RunsOnOption({
  value,
  picked,
  onPick,
  title,
  summary,
  disabled = false,
  children,
}: {
  value: FactoryWorkFunding;
  picked: boolean;
  onPick: (value: FactoryWorkFunding) => void;
  title: string;
  summary: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <label
      className={cn(
        'flex items-start gap-3 rounded-lg border p-3',
        disabled ? 'cursor-not-allowed border-dashed opacity-60' : 'cursor-pointer',
        'has-[:focus-visible]:ring-foreground has-[:focus-visible]:ring-2',
        picked ? 'border-foreground bg-fill-subtle' : 'border-border hover:border-border-strong',
      )}
    >
      <input
        type="radio"
        name="board-work-runs-on"
        value={value}
        checked={picked}
        disabled={disabled}
        onChange={() => onPick(value)}
        className="accent-foreground mt-0.5 size-4 shrink-0"
      />
      <span className="flex min-w-0 flex-col gap-2">
        <span className="flex flex-col">
          <Txt as="span" variant="label" tone="ink">
            {title}
          </Txt>
          <Txt as="span" variant="meta" tone="muted">
            {summary}
          </Txt>
        </span>
        <span className={cn('flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1', !picked && 'opacity-60')}>
          {children}
        </span>
      </span>
    </label>
  );
}

export function StoryRunsOnChoice({ storyboard: { state, patch } }: { storyboard: Storyboard }) {
  const ownPlans = ownPlansAllowed(state);
  const members = PERSONA_IDS.map(persona => memberLine(state, persona));
  const blocked = members.filter(member => !member.ok);
  const pick = (factoryWorkRunsOn: FactoryWorkFunding) =>
    patch({
      factoryWorkRunsOn,
      laneFunding: Object.fromEntries(
        Object.entries(state.laneFunding).filter(([, funding]) => funding !== factoryWorkRunsOn),
      ),
    });
  const overrides = storyBoardLanes(state.boardLayout)
    .flatMap(board => board.lanes)
    .filter(lane => state.laneFunding[lane.stage] !== undefined);

  return (
    <fieldset className="flex flex-col gap-2 px-4 py-3">
      <legend className="contents">
        <Txt as="span" variant="label" tone="ink">
          Who pays for board work
        </Txt>
      </legend>
      <Txt as="p" variant="meta" tone="muted">
        {overrides.length === 0
          ? 'Lanes can override it.'
          : `${overrides.map(lane => lane.label).join(', ')} ${overrides.length === 1 ? 'overrides' : 'override'} it.`}
      </Txt>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <RunsOnOption
          value="shared"
          picked={laneRunsOn(state) === 'shared'}
          onPick={pick}
          title="The Factory account"
          summary="One bill for every card"
        >
          {state.sharedAccount === null ? (
            <PlanChip plan={null} missing="No Factory account" />
          ) : (
            <span className="flex flex-wrap gap-x-3">
              {factoryKeys(state).map(key => (
                <PlanChip key={key.label} plan={key} missing={key.label} />
              ))}
            </span>
          )}
          {state.sharedAccount === null && (
            <Txt as="span" variant="meta" tone="muted">
              Cards wait
            </Txt>
          )}
        </RunsOnOption>
        <RunsOnOption
          value="owner"
          picked={laneRunsOn(state) === 'owner'}
          onPick={pick}
          title="Each card's owner"
          summary={ownPlans ? 'Cards bill whoever owns them' : "Off: members' plans can't pay in this Factory"}
          disabled={!ownPlans}
        >
          {ownPlans && <MemberStack members={members} />}
          {ownPlans &&
            blocked.map(member => (
              <Txt key={member.persona} as="span" variant="meta" className="text-destructive-indicator">
                {member.name} · {member.detail}
              </Txt>
            ))}
        </RunsOnOption>
      </div>
    </fieldset>
  );
}
