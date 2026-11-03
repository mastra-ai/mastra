import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useState } from 'react';
import type { CSSProperties } from 'react';

import { formatDuration } from '../../../../lib/date/formatDuration';
import { stageStrongTintClass, stageTintClass } from '../../factory/components/BoardIcons';
import type { FactoryMentionMember } from '../../factory/services/members';
import { stageLabel } from '../../factory/stages';
import { trackMomentLabel, trackStartLabel } from '../services/sessionTrack';
import type { TrackLayout, TrackPin, TrackSpan, TrackStage } from '../services/sessionTrack';

const MIN_LABELLED_STAGE_PERCENT = 16;
const MIN_HIT_WIDTH = '8px';
const FADE_CLASSES = 'transition-[opacity,background-color] duration-150 motion-reduce:transition-none';

/** The piece of the track under the pointer, as the header and axis read it out. */
interface TrackFocus {
  key: string;
  label: string;
  duration?: string;
  from: number;
  to?: number;
}

const stageKey = (stage: TrackStage) => `stage:${stage.stage}:${stage.from}`;
const runKey = (run: TrackSpan) => `run:${run.from}`;
const pinKey = (pin: TrackPin) => `pin:${pin.personId}:${pin.at}`;

function pinCaption(pin: TrackPin, name: string): string {
  return pin.stage === undefined ? `${name} took over` : `${name} moved it to ${stageLabel(pin.stage)}`;
}

function stageFocus(stage: TrackStage): TrackFocus {
  const { from, to } = stage;
  return { key: stageKey(stage), label: stageLabel(stage.stage), duration: formatDuration(to - from), from, to };
}

function runFocus(run: TrackSpan): TrackFocus {
  const { from, to } = run;
  return { key: runKey(run), label: 'Agent run', duration: formatDuration(to - from), from, to };
}

function pinFocus(pin: TrackPin, name: string): TrackFocus {
  return { key: pinKey(pin), label: pinCaption(pin, name), from: pin.at };
}

function axisEndLabel(focus: TrackFocus | undefined, now: number): string {
  if (!focus) return 'now';
  if (focus.to === undefined) return '';
  return focus.to >= now ? 'now' : trackMomentLabel(focus.to, now);
}

function agentRunCount(runs: number): string {
  if (runs === 0) return '';
  return runs === 1 ? '1 agent run' : `${runs} agent runs`;
}

function trackSummary(layout: TrackLayout, nameOf: (personId: string) => string): string {
  const stages = layout.stages.map(stage => `${stageLabel(stage.stage)} ${formatDuration(stage.to - stage.from)}`);
  const pins = layout.pins.map(pin => pinCaption(pin, nameOf(pin.personId)));
  return ['Session timeline', stages.join(', '), agentRunCount(layout.runs.length), ...pins].filter(Boolean).join('. ');
}

/** Centred on the span and never narrower than a pointer can land on, while the drawn span keeps its true length. */
function hitAreaStyle(span: TrackSpan): CSSProperties {
  return { left: `${span.left + span.width / 2}%`, width: `max(${span.width}%, ${MIN_HIT_WIDTH})` };
}

/** Wide enough to name and clear of the previous label: an item can sit in several stages at once. */
function labelledStages(stages: readonly TrackStage[]): TrackStage[] {
  return stages.reduce<TrackStage[]>((labelled, stage) => {
    const previous = labelled.at(-1);
    const clearOfPrevious = previous === undefined || stage.from >= previous.to;
    return stage.width >= MIN_LABELLED_STAGE_PERCENT && clearOfPrevious ? [...labelled, stage] : labelled;
  }, []);
}

/** Narrowest last, so a sliver's widened hit area sits above its neighbour's edge. */
function widestFirst<Span extends TrackSpan>(spans: readonly Span[]): Span[] {
  return spans.toSorted((a, b) => b.width - a.width);
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
  const [focus, setFocus] = useState<TrackFocus>();
  const nameOf = (personId: string) => people.get(personId)?.name ?? personId;
  const fadedUnlessFocused = (key: string) => focus !== undefined && focus.key !== key && 'opacity-40';

  return (
    <div role="img" aria-label={trackSummary(layout, nameOf)} className="flex flex-col gap-1">
      <div aria-hidden className="relative h-3">
        {focus ? (
          <div className="flex min-w-0 gap-1">
            <Txt as="span" variant="meta" tone="ink" className="truncate leading-3">
              {focus.label}
            </Txt>
            {focus.duration && (
              <Txt as="span" variant="meta" tone="muted" className="shrink-0 leading-3">
                {focus.duration}
              </Txt>
            )}
          </div>
        ) : (
          labelledStages(layout.stages).map(stage => (
            <Txt
              key={stageKey(stage)}
              as="span"
              variant="meta"
              tone="muted"
              className="absolute top-0 truncate leading-3"
              style={{ left: `${stage.left}%`, maxWidth: `${stage.width}%` }}
            >
              {stageLabel(stage.stage)}
            </Txt>
          ))
        )}
      </div>
      <div aria-hidden className="relative h-2.5" onPointerLeave={() => setFocus(undefined)}>
        {layout.stages.map(stage => (
          <span
            key={stageKey(stage)}
            className={cn(
              'pointer-events-none absolute inset-y-0 rounded-[3px]',
              FADE_CLASSES,
              focus?.key === stageKey(stage) ? stageStrongTintClass(stage.stage) : stageTintClass(stage.stage),
              fadedUnlessFocused(stageKey(stage)),
            )}
            style={{ left: `${stage.left}%`, width: `max(calc(${stage.width}% - 2px), 2px)` }}
          />
        ))}
        {layout.runs.map(run => (
          <span
            key={runKey(run)}
            className={cn(
              'bg-span-agent pointer-events-none absolute top-[3px] h-1 min-w-0.5 rounded-xs',
              FADE_CLASSES,
              fadedUnlessFocused(runKey(run)),
            )}
            style={{ left: `${run.left}%`, width: `${run.width}%` }}
          />
        ))}
        {widestFirst(layout.stages).map(stage => (
          <span
            key={stageKey(stage)}
            data-track-hit={stageLabel(stage.stage)}
            className="absolute -inset-y-1 -translate-x-1/2"
            style={hitAreaStyle(stage)}
            onPointerEnter={() => setFocus(stageFocus(stage))}
          />
        ))}
        {widestFirst(layout.runs).map(run => (
          <span
            key={runKey(run)}
            data-track-hit="Agent run"
            className="absolute top-0.5 h-1.5 -translate-x-1/2"
            style={hitAreaStyle(run)}
            onPointerEnter={() => setFocus(runFocus(run))}
          />
        ))}
        {layout.pins.map(pin => {
          const person = people.get(pin.personId);
          return (
            <span
              key={pinKey(pin)}
              className={cn(
                'ring-popover absolute -top-px flex -translate-x-1/2 rounded-full ring-2',
                FADE_CLASSES,
                fadedUnlessFocused(pinKey(pin)),
              )}
              data-track-hit={pinCaption(pin, nameOf(pin.personId))}
              style={{ left: `${pin.left}%` }}
              onPointerEnter={() => setFocus(pinFocus(pin, nameOf(pin.personId)))}
            >
              <Avatar src={person?.avatarUrl} name={nameOf(pin.personId)} size="xs" />
            </span>
          );
        })}
      </div>
      <div aria-hidden className="flex justify-between">
        <Txt as="span" variant="meta" tone="faint">
          {focus ? trackMomentLabel(focus.from, now) : trackStartLabel(startedAt, now)}
        </Txt>
        <Txt as="span" variant="meta" tone="muted">
          {axisEndLabel(focus, now)}
        </Txt>
      </div>
    </div>
  );
}
