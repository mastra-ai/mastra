import { Button } from '@mastra/playground-ui/components/Button';
import { useId, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import { AUDIT_CATEGORIES, auditCategory, type AuditNamespace, type AuditTimeRange } from '../../auditPresentation';
import type { AuditEvent } from '../../services/audit';
import { AuditCategoryFilter } from './AuditCategoryFilter';
import { AuditMobileDateRange } from './AuditMobileDateRange';

type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

interface AuditMark {
  id: string;
  at: number;
  actorType: AuditEvent['actorType'];
}

interface AuditLane {
  category: AuditCategory;
  marks: AuditMark[];
}

const WIDTH = 1000;
const TRACK_START = 48;
const TRACK_END = 988;
const TOP = 22;
const LANE_HEIGHT = 13;
const BOTTOM = 38;
const MINUTE = 60_000;
const DAY = 86_400_000;
const AUDIT_WINDOW = 7 * DAY;

function auditEventTime(event: AuditEvent): number | undefined {
  const at = Date.parse(event.occurredAt);
  return Number.isFinite(at) ? at : undefined;
}

export function eventInAuditRange(event: AuditEvent, range: AuditTimeRange): boolean {
  const at = auditEventTime(event);
  return at !== undefined && at >= range.from && at <= range.to;
}

function eventBounds(events: AuditEvent[]): AuditTimeRange | undefined {
  let from = Number.POSITIVE_INFINITY;
  let to = Number.NEGATIVE_INFINITY;

  for (const event of events) {
    const at = auditEventTime(event);
    if (at === undefined) continue;
    from = Math.min(from, at);
    to = Math.max(to, at);
  }

  if (!Number.isFinite(from) || !Number.isFinite(to)) return undefined;
  if (from === to) return { from: from - 30 * MINUTE, to: to + 30 * MINUTE };
  return { from, to };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function rangeAround(center: number, span: number, bounds: AuditTimeRange): AuditTimeRange {
  const boundedSpan = Math.min(span, bounds.to - bounds.from);
  const from = clamp(center - boundedSpan / 2, bounds.from, bounds.to - boundedSpan);
  return { from, to: from + boundedSpan };
}

function rangeBetween(anchor: number, current: number, bounds: AuditTimeRange): AuditTimeRange {
  const from = clamp(Math.min(anchor, current), bounds.from, bounds.to);
  const to = clamp(Math.max(anchor, current), bounds.from, bounds.to);
  const minimumSpan = Math.min(Math.max((bounds.to - bounds.from) * 0.03, 5 * MINUTE), bounds.to - bounds.from);
  return to - from >= minimumSpan ? { from, to } : rangeAround((from + to) / 2, minimumSpan, bounds);
}

function shiftRange(range: AuditTimeRange, delta: number, bounds: AuditTimeRange): AuditTimeRange {
  const span = range.to - range.from;
  const from = clamp(range.from + delta, bounds.from, bounds.to - span);
  return { from, to: from + span };
}

function keyboardRange(
  key: string,
  current: AuditTimeRange | undefined,
  bounds: AuditTimeRange,
): AuditTimeRange | undefined | null {
  if (key === 'Escape') return undefined;

  const total = bounds.to - bounds.from;
  const range = current ?? rangeAround((bounds.from + bounds.to) / 2, total / 3, bounds);
  const span = range.to - range.from;

  switch (key) {
    case 'ArrowLeft':
      return shiftRange(range, -Math.max(span * 0.1, total * 0.02), bounds);
    case 'ArrowRight':
      return shiftRange(range, Math.max(span * 0.1, total * 0.02), bounds);
    case 'ArrowUp':
      return rangeAround((range.from + range.to) / 2, span * 0.8, bounds);
    case 'ArrowDown':
      return rangeAround((range.from + range.to) / 2, span * 1.25, bounds);
    case 'Home':
      return { from: bounds.from, to: bounds.from + span };
    case 'End':
      return { from: bounds.to - span, to: bounds.to };
    default:
      return null;
  }
}

function markOffset(id: string): number {
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) % 7;
  return hash - 3;
}

function timelineTick(at: number, span: number): string {
  const date = new Date(at);
  if (span > 2 * 86_400_000) return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function rangeLabel(range: AuditTimeRange): string {
  const from = new Date(range.from);
  const to = new Date(range.to);
  const sameDay = from.toDateString() === to.toDateString();
  const fromLabel = from.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const toLabel = to.toLocaleString(undefined, {
    month: sameDay ? undefined : 'short',
    day: sameDay ? undefined : 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${fromLabel} – ${toLabel}`;
}

function boundaryLabel(at: number): string {
  return new Date(at).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AuditTimeline({
  events,
  range,
  selectedCategories,
  onRangeChange,
  onToggleCategory,
  onClearCategories,
}: {
  events: AuditEvent[];
  range: AuditTimeRange | undefined;
  selectedCategories: ReadonlySet<AuditNamespace>;
  onRangeChange: (range: AuditTimeRange | undefined) => void;
  onToggleCategory: (category: AuditNamespace) => void;
  onClearCategories: () => void;
}) {
  const anchor = useRef<number | null>(null);
  const [dragRange, setDragRange] = useState<AuditTimeRange>();
  const selectionGradientId = useId().replace(/:/g, '');
  const selectionShadowId = useId().replace(/:/g, '');
  const now = Date.now();
  const bounds = eventBounds(events) ?? { from: now - AUDIT_WINDOW, to: now };

  const lanes: AuditLane[] = AUDIT_CATEGORIES.map(category => ({ category, marks: [] }));
  for (const event of events) {
    const at = auditEventTime(event);
    const category = auditCategory(event.action);
    if (at === undefined || !category) continue;
    lanes
      .find(lane => lane.category.namespace === category.namespace)
      ?.marks.push({
        id: event.id,
        at,
        actorType: event.actorType,
      });
  }
  const height = TOP + lanes.length * LANE_HEIGHT + BOTTOM;
  const plotWidth = TRACK_END - TRACK_START;
  const span = bounds.to - bounds.from;
  const xAt = (at: number) => TRACK_START + ((at - bounds.from) / span) * plotWidth;
  const selection = dragRange ?? range ?? bounds;
  const hasActiveSelection = dragRange !== undefined || range !== undefined;
  const selectionFromX = xAt(selection.from);
  const selectionToX = xAt(selection.to);
  const selectionWidth = Math.max(1, selectionToX - selectionFromX);
  const selectionTop = TOP - 7;
  const selectionBottom = height - BOTTOM + 8;
  const labelsAreTight = selectionToX - selectionFromX < 190;
  const resetButtonCenterX = clamp((selectionFromX + selectionToX) / 2, TRACK_START + 32, TRACK_END - 32);
  const selectionLabel = rangeLabel(selection);
  let selectedCount = 0;
  for (const event of events) {
    if (eventInAuditRange(event, selection)) selectedCount += 1;
  }

  const pointerTime = (event: ReactPointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width === 0) return bounds.from;
    const x = ((event.clientX - box.left) / box.width) * WIDTH;
    return bounds.from + ((clamp(x, TRACK_START, TRACK_END) - TRACK_START) / plotWidth) * span;
  };

  const settlePointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    const start = anchor.current;
    if (start === null) return;
    const next = rangeBetween(start, pointerTime(event), bounds);
    anchor.current = null;
    setDragRange(undefined);
    onRangeChange(next);
  };

  return (
    <>
      <AuditMobileDateRange bounds={bounds} range={range} onRangeChange={onRangeChange} />
      <div className="max-w-full overflow-visible lg:overflow-x-auto lg:overscroll-x-contain">
        <div className="relative min-w-0 lg:min-w-[45rem]">
          <svg
            viewBox={`0 0 ${WIDTH} ${height}`}
            role="slider"
            aria-label="Audit time range"
            aria-orientation="horizontal"
            aria-valuemin={bounds.from}
            aria-valuemax={bounds.to}
            aria-valuenow={(selection.from + selection.to) / 2}
            aria-valuetext={selectionLabel}
            tabIndex={0}
            className="group/timeline block h-auto w-full cursor-default touch-pan-y overflow-visible rounded-md outline-none select-none lg:cursor-crosshair lg:touch-none"
            onKeyDown={event => {
              const next = keyboardRange(event.key, range, bounds);
              if (next === null) return;
              event.preventDefault();
              onRangeChange(next);
            }}
            onPointerDown={event => {
              if (event.pointerType === 'touch') return;
              event.preventDefault();
              event.currentTarget.focus();
              const at = pointerTime(event);
              anchor.current = at;
              setDragRange(rangeBetween(at, at, bounds));
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={event => {
              const start = anchor.current;
              if (start !== null) setDragRange(rangeBetween(start, pointerTime(event), bounds));
            }}
            onPointerUp={settlePointer}
            onPointerCancel={() => {
              anchor.current = null;
              setDragRange(undefined);
            }}
          >
            <title>
              Drag to select a time range. Arrow keys move it; up and down change its width; Escape resets it.
            </title>
            <defs>
              <linearGradient id={selectionGradientId} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="var(--neutral6)" stopOpacity={0.09} />
                <stop offset="55%" stopColor="var(--neutral6)" stopOpacity={0.05} />
                <stop offset="100%" stopColor="var(--neutral6)" stopOpacity={0.025} />
              </linearGradient>
              <filter
                id={selectionShadowId}
                x="-8%"
                y="-12%"
                width="116%"
                height="124%"
                colorInterpolationFilters="sRGB"
              >
                <feComponentTransfer in="SourceAlpha" result="inverseAlpha">
                  <feFuncA type="table" tableValues="1 0" />
                </feComponentTransfer>
                <feGaussianBlur in="inverseAlpha" stdDeviation={2.5} result="blurredInverse" />
                <feOffset in="blurredInverse" dy={1.5} result="offsetBlur" />
                <feFlood floodColor="white" floodOpacity={0.16} result="highlightColor" />
                <feComposite in="highlightColor" in2="offsetBlur" operator="in" result="innerHighlight" />
                <feComposite in="innerHighlight" in2="SourceAlpha" operator="in" result="clippedHighlight" />
                <feComposite in="clippedHighlight" in2="SourceGraphic" operator="over" />
              </filter>
            </defs>
            {[0, 0.25, 0.5, 0.75, 1].map(position => {
              const at = bounds.from + span * position;
              const x = TRACK_START + plotWidth * position;
              return (
                <g
                  key={position}
                  className={position === 0 || position === 0.5 || position === 1 ? undefined : 'hidden lg:block'}
                >
                  <line x1={x} y1={TOP - 7} x2={x} y2={height - BOTTOM} className="stroke-border1" />
                  <text x={x} y={11} textAnchor="middle" className="fill-neutral2 text-[20px] lg:text-[9px]">
                    {timelineTick(at, span)}
                  </text>
                </g>
              );
            })}

            {lanes.map((lane, index) => {
              const y = TOP + index * LANE_HEIGHT + LANE_HEIGHT / 2;
              return (
                <g key={lane.category.namespace}>
                  {lane.marks.map(mark => (
                    <rect
                      key={mark.id}
                      x={xAt(mark.at) - 1}
                      y={y - 4 + markOffset(mark.id)}
                      width={2}
                      height={8}
                      rx={1}
                      opacity={mark.actorType === 'agent' ? 1 : 0.65}
                      className={lane.category.fillClass}
                    />
                  ))}
                </g>
              );
            })}

            {hasActiveSelection ? (
              <>
                <rect
                  x={selectionFromX}
                  y={selectionTop}
                  width={selectionWidth}
                  height={selectionBottom - selectionTop}
                  rx={7}
                  fill={`url(#${selectionGradientId})`}
                  filter={`url(#${selectionShadowId})`}
                />
                <text
                  x={selectionFromX + 6}
                  y={selectionBottom + (labelsAreTight ? 12 : 14)}
                  textAnchor="start"
                  className="fill-neutral3 text-[18px] opacity-50 lg:text-[9px]"
                >
                  {boundaryLabel(selection.from)}
                </text>
                <text
                  x={selectionToX - 6}
                  y={selectionBottom + (labelsAreTight ? 24 : 14)}
                  textAnchor="end"
                  className="fill-neutral3 text-[18px] opacity-50 lg:text-[9px]"
                >
                  {boundaryLabel(selection.to)}
                </text>
              </>
            ) : null}
            <rect
              x={hasActiveSelection ? selectionFromX : TRACK_START}
              y={selectionTop}
              width={hasActiveSelection ? selectionWidth : plotWidth}
              height={selectionBottom - selectionTop}
              rx={7}
              fill={`url(#${selectionGradientId})`}
              className="pointer-events-none opacity-0 transition-opacity group-focus-visible/timeline:opacity-45 motion-reduce:transition-none"
            />
            <line
              x1={TRACK_END}
              y1={TOP - 6}
              x2={TRACK_END}
              y2={height - BOTTOM + 6}
              className="stroke-positive1 opacity-60"
            />
          </svg>
          {range && !dragRange ? (
            <Button
              type="button"
              variant="default"
              size="xs"
              onClick={() => onRangeChange(undefined)}
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${(resetButtonCenterX / WIDTH) * 100}%`,
                top: `${(selectionTop / height) * 100}%`,
              }}
            >
              Reset
            </Button>
          ) : null}
        </div>
      </div>

      <AuditCategoryFilter
        selectedCategories={selectedCategories}
        countLabel={hasActiveSelection ? `${selectedCount} of ${events.length} loaded` : `${events.length} loaded`}
        onToggleCategory={onToggleCategory}
        onClearCategories={onClearCategories}
      />
    </>
  );
}
