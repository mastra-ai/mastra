import { cn } from '@mastra/playground-ui/utils/cn';
import { Fragment, useRef, useState, type ReactNode } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';

import { clamp, type AuditTimeRange } from '../../auditPresentation';
import {
  AUDIT_AXIS_TICKS,
  auditRangeShifted,
  auditRangeUnlessFull,
  auditRangeWithBoundary,
  auditRulerStep,
  auditRulerTicks,
  type AuditBoundary,
} from '../../auditRuler';
import { AuditRangePresets } from './AuditRangePresets';

const MINOR_TICKS = 110;
const DAY = 86_400_000;
const BOUNDARIES = ['from', 'to'] satisfies AuditBoundary[];
const EDGE_LABELS_FIT_ABOVE = 8;
const LABEL_CLEARANCE = 6;
const LABEL_INSET = '1.5rem';
const EDGE_FADE = '[mask-image:linear-gradient(to_right,transparent,black_3%,black_97%,transparent)]';
const LENS_SHADOW = 'shadow-[0_2px_16px_-6px_oklch(0%_0_0deg/25%)]';

interface AuditDrag {
  mode: AuditBoundary | 'pan';
  origin: AuditTimeRange;
  at: number;
}

function dayLabel(at: number): string {
  return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function timeLabel(at: number): string {
  return new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function weekdayLabel(at: number): string {
  return new Date(at).toLocaleDateString(undefined, { weekday: 'short' });
}

function opensADay(at: number, previous: number | undefined): boolean {
  return previous === undefined || new Date(at).toDateString() !== new Date(previous).toDateString();
}

/**
 * The chart and the window it is read through, on one time axis: drag the lens'
 * sides to resize, its body to slide. A phone gets chips instead — a full-width
 * drag surface leaves no room for a handle and swallows the page scroll.
 */
export function AuditRangePicker({
  bounds,
  range,
  onRangeChange,
  children,
}: {
  bounds: AuditTimeRange;
  range: AuditTimeRange | undefined;
  onRangeChange: (range: AuditTimeRange | undefined) => void;
  children: ReactNode;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<AuditDrag>();
  const span = bounds.to - bounds.from;
  const minorStep = auditRulerStep(span, MINOR_TICKS);
  const majorStep = auditRulerStep(span, AUDIT_AXIS_TICKS);
  const majorTicks = auditRulerTicks(bounds, majorStep);
  const isMajor = new Set(majorTicks);
  const selection = range ?? bounds;
  const positionOf = (at: number) => ((at - bounds.from) / span) * 100;
  const left = positionOf(selection.from);
  const right = positionOf(selection.to);
  const showEndLabels = right - left >= EDGE_LABELS_FIT_ABOVE;
  const nearSelection = (position: number) =>
    Math.abs(position - left) < LABEL_CLEARANCE || (showEndLabels && Math.abs(position - right) < LABEL_CLEARANCE);
  const labelLeft = (at: number) => `clamp(${LABEL_INSET}, ${positionOf(at)}%, calc(100% - ${LABEL_INSET}))`;

  const commit = (next: AuditTimeRange) => onRangeChange(auditRangeUnlessFull(next, bounds));

  const timeAtPointer = (clientX: number) => {
    const box = trackRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) return bounds.from;
    return bounds.from + (clamp(clientX - box.left, 0, box.width) / box.width) * span;
  };

  const startDrag = (mode: AuditDrag['mode']) => (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ mode, origin: selection, at: timeAtPointer(event.clientX) });
  };

  const continueDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const at = timeAtPointer(event.clientX);
    commit(
      drag.mode === 'pan'
        ? auditRangeShifted(drag.origin, at - drag.at, bounds)
        : auditRangeWithBoundary(drag.origin, drag.mode, at, bounds),
    );
  };

  const nudge = (boundary: AuditBoundary) => (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const at = selection[boundary];
    if (event.key === 'Escape') onRangeChange(undefined);
    else if (event.key === 'ArrowLeft') commit(auditRangeWithBoundary(selection, boundary, at - minorStep, bounds));
    else if (event.key === 'ArrowRight') commit(auditRangeWithBoundary(selection, boundary, at + minorStep, bounds));
    else if (event.key === 'Home') commit(auditRangeWithBoundary(selection, boundary, bounds.from, bounds));
    else if (event.key === 'End') commit(auditRangeWithBoundary(selection, boundary, bounds.to, bounds));
    else return;
    event.preventDefault();
  };

  return (
    <div>
      {children}

      <AuditRangePresets className="pt-2 sm:hidden" bounds={bounds} range={range} onRangeChange={onRangeChange} />

      <div ref={trackRef} className="relative hidden h-20 w-full touch-none select-none sm:block">
        <div className={cn('absolute inset-0', EDGE_FADE)}>
          {majorTicks.map((at, index) => {
            const position = positionOf(at);
            if (nearSelection(position)) return null;
            return (
              <Fragment key={at}>
                {opensADay(at, majorTicks[index - 1]) ? (
                  <span
                    className="text-ui-xs text-neutral6/50 absolute top-0 -translate-x-1/2 font-medium whitespace-nowrap tabular-nums"
                    style={{ left: `${position}%` }}
                  >
                    {dayLabel(at)}
                  </span>
                ) : null}
                <span
                  className="text-ui-xs text-neutral6/50 absolute bottom-0 -translate-x-1/2 font-medium whitespace-nowrap tabular-nums"
                  style={{ left: `${position}%` }}
                >
                  {majorStep < DAY ? timeLabel(at) : weekdayLabel(at)}
                </span>
              </Fragment>
            );
          })}

          {auditRulerTicks(bounds, minorStep).map(at => (
            <span
              key={at}
              aria-hidden
              className={cn(
                'absolute top-1/2 w-px -translate-1/2 rounded-full',
                isMajor.has(at) ? 'h-5' : 'h-2.5',
                at >= selection.from && at <= selection.to ? 'bg-neutral3' : 'bg-neutral1/35',
              )}
              style={{ left: `${positionOf(at)}%` }}
            />
          ))}
        </div>

        {BOUNDARIES.map(boundary =>
          boundary === 'to' && !showEndLabels ? null : (
            <Fragment key={boundary}>
              <span
                className="text-ui-xs text-neutral6/80 pointer-events-none absolute top-0 -translate-x-1/2 font-semibold whitespace-nowrap tabular-nums"
                style={{ left: labelLeft(selection[boundary]) }}
              >
                {dayLabel(selection[boundary])}
              </span>
              <span
                className="text-ui-xs text-neutral6/80 pointer-events-none absolute bottom-0 -translate-x-1/2 font-semibold whitespace-nowrap tabular-nums"
                style={{ left: labelLeft(selection[boundary]) }}
              >
                {timeLabel(selection[boundary])}
              </span>
            </Fragment>
          ),
        )}

        <div
          className={cn(
            'bg-surface1/30 ring-border2 dark:bg-white/5 absolute top-1/2 flex h-8 min-w-8 -translate-y-1/2 cursor-grab items-stretch justify-between rounded-lg backdrop-blur-xs ring-1 active:cursor-grabbing',
            LENS_SHADOW,
            drag === undefined && 'transition-[left,width] duration-150 ease-out motion-reduce:transition-none',
          )}
          style={{ left: `${left}%`, width: `${right - left}%` }}
          onPointerDown={startDrag('pan')}
          onPointerMove={continueDrag}
          onPointerUp={() => setDrag(undefined)}
          onPointerCancel={() => setDrag(undefined)}
        >
          {BOUNDARIES.map(boundary => (
            <div
              key={boundary}
              role="slider"
              tabIndex={0}
              aria-label={boundary === 'from' ? 'Range start' : 'Range end'}
              aria-orientation="horizontal"
              aria-valuemin={bounds.from}
              aria-valuemax={bounds.to}
              aria-valuenow={selection[boundary]}
              aria-valuetext={`${dayLabel(selection[boundary])} ${timeLabel(selection[boundary])}`}
              className="focus-visible:ring-neutral3 group flex w-3.5 shrink-0 cursor-ew-resize items-center justify-center rounded-lg outline-none focus-visible:ring-2"
              onPointerDown={startDrag(boundary)}
              onKeyDown={nudge(boundary)}
            >
              <span
                className={cn(
                  'group-hover:bg-neutral4 group-focus-visible:bg-neutral4 h-4 w-0.5 rounded-full transition-[background-color,scale] duration-150 ease-out group-hover:scale-110 motion-reduce:transition-none',
                  drag?.mode === boundary ? 'bg-neutral5 scale-110' : 'bg-neutral2',
                )}
                aria-hidden
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
