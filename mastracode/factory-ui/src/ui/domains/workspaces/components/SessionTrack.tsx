import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';

import { stageTintClass } from '../../factory/components/BoardIcons';
import type { FactoryMentionMember } from '../../factory/services/members';
import { stageLabel } from '../../factory/stages';
import { trackStartLabel } from '../services/sessionTrack';
import type { TrackLayout, TrackPin } from '../services/sessionTrack';

const MIN_LABELLED_STAGE_PERCENT = 16;

function pinCaption(pin: TrackPin, name: string): string {
  return pin.stage === undefined ? `${name} took over` : `${name} moved it to ${stageLabel(pin.stage)}`;
}

function agentRunCount(runs: number): string {
  if (runs === 0) return '';
  return runs === 1 ? '1 agent run' : `${runs} agent runs`;
}

function trackSummary(layout: TrackLayout, nameOf: (personId: string) => string): string {
  const stages = layout.stages.map(stage => stageLabel(stage.stage)).join(', ');
  const pins = layout.pins.map(pin => pinCaption(pin, nameOf(pin.personId)));
  return ['Session timeline', stages, agentRunCount(layout.runs.length), ...pins].filter(Boolean).join('. ');
}

/** Stage colours the track, agent runs sit inside it, an avatar marks where a person stepped in. */
export function SessionTrack({
  layout,
  startedAt,
  now,
  people,
}: {
  layout: TrackLayout;
  startedAt: number;
  now: number;
  people: ReadonlyMap<string, FactoryMentionMember>;
}) {
  const nameOf = (personId: string) => people.get(personId)?.name ?? personId;

  return (
    <div role="img" aria-label={trackSummary(layout, nameOf)} className="flex flex-col gap-1">
      <div aria-hidden className="relative h-3">
        {layout.stages
          .filter(stage => stage.width >= MIN_LABELLED_STAGE_PERCENT)
          .map(stage => (
            <Txt
              key={`${stage.stage}-${stage.left}`}
              as="span"
              variant="meta"
              tone="muted"
              className="absolute top-0 truncate leading-3"
              style={{ left: `${stage.left}%`, maxWidth: `${stage.width}%` }}
            >
              {stageLabel(stage.stage)}
            </Txt>
          ))}
      </div>
      <div aria-hidden className="relative h-2.5">
        {layout.stages.map(stage => (
          <span
            key={`${stage.stage}-${stage.left}`}
            title={stageLabel(stage.stage)}
            className={cn('absolute inset-y-0 rounded-[3px]', stageTintClass(stage.stage))}
            style={{ left: `${stage.left}%`, width: `max(calc(${stage.width}% - 2px), 2px)` }}
          />
        ))}
        {layout.runs.map(run => (
          <span
            key={run.left}
            className="bg-span-agent absolute top-[3px] h-1 min-w-0.5 rounded-xs"
            style={{ left: `${run.left}%`, width: `${run.width}%` }}
          />
        ))}
        {layout.pins.map(pin => {
          const person = people.get(pin.personId);
          return (
            <span
              key={`${pin.personId}-${pin.at}`}
              title={pinCaption(pin, nameOf(pin.personId))}
              className="ring-popover absolute -top-px flex -translate-x-1/2 rounded-full ring-2"
              style={{ left: `${pin.left}%` }}
            >
              <Avatar src={person?.avatarUrl} name={nameOf(pin.personId)} size="xs" />
            </span>
          );
        })}
      </div>
      <div aria-hidden className="flex justify-between">
        <Txt as="span" variant="meta" tone="faint">
          {trackStartLabel(startedAt, now)}
        </Txt>
        <Txt as="span" variant="meta" tone="muted">
          now
        </Txt>
      </div>
    </div>
  );
}
