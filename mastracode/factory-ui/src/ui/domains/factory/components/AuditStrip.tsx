import type { AuditNamespace } from '@mastra/factory/storage/domains/audit/actions';
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

import { useHostWidth } from '../../../../hooks/useHostWidth';
import {
  AUDIT_NAMESPACES,
  NAMESPACE_LABELS,
  NAMESPACE_PAINT,
  namespaceOf,
  sliceBetween,
  type TimeSlice,
} from '../audit-log';
import type { AuditEvent } from '../services/audit';

const LANE = 26;
const HEAD = 24;
const FOOT = 18;
const NARROW_BELOW = 700;
const DAY = 86_400_000;
const HOUR = 3_600_000;

/** Ticks that would land on the same pixel add nothing but paint. */
const JITTER = 9;

function laneOffset(id: string): number {
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) % JITTER;
  return (hash / JITTER) * (LANE - 14);
}

function midnightAfter(at: number): number {
  const midnight = new Date(at);
  midnight.setHours(0, 0, 0, 0);
  return midnight.getTime() <= at ? midnight.getTime() + DAY : midnight.getTime();
}

function dayLabel(at: number): string {
  return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * The shape of the window, lane by lane, and the handle that narrows it: drag
 * across the strip to pick a slice, and the log underneath follows.
 */
export function AuditStrip({
  events,
  from,
  to,
  slice,
  onSlice,
  shown,
}: {
  events: AuditEvent[];
  from: number;
  to: number;
  slice: TimeSlice;
  onSlice: (slice: TimeSlice) => void;
  /** Namespaces the filters keep — the rest stay drawn but dimmed. */
  shown: ReadonlySet<AuditNamespace>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const strip = useRef<SVGSVGElement>(null);
  const anchor = useRef<number | null>(null);
  const [drag, setDrag] = useState<TimeSlice | null>(null);
  const width = useHostWidth(host);

  const pad = width < NARROW_BELOW ? 74 : 104;
  const plot = Math.max(width - pad - 22, 120);
  // an empty lane spends 30px saying nothing happened; the filters still list every namespace
  const lanes = AUDIT_NAMESPACES.map(namespace => ({
    namespace,
    ticks: events.filter(event => namespaceOf(event.action) === namespace),
  })).filter(lane => lane.ticks.length > 0);
  const height = lanes.length * LANE + HEAD + FOOT;
  const at = (moment: number) => pad + ((moment - from) / (to - from)) * plot;
  const timeAt = (x: number) => from + ((x - pad) / plot) * (to - from);

  const step = plot < 460 ? DAY : 12 * HOUR;
  const ticks: number[] = [];
  // stepped off local midnight, so a day label lands on the day it names
  for (let moment = midnightAfter(from); moment <= to; moment += step) ticks.push(moment);

  const brush = drag ?? slice;

  const pointerTime = (event: ReactPointerEvent<SVGSVGElement>) => {
    const box = strip.current!.getBoundingClientRect();
    return timeAt(((event.clientX - box.left) * width) / box.width);
  };

  const track = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (anchor.current === null) return;
    setDrag(sliceBetween(anchor.current, pointerTime(event), { from, to }));
  };

  const settle = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (anchor.current === null) return;
    const picked = sliceBetween(anchor.current, pointerTime(event), { from, to });
    anchor.current = null;
    setDrag(null);
    onSlice(picked);
  };

  const cancel = () => {
    anchor.current = null;
    setDrag(null);
  };

  return (
    <div ref={host}>
      <svg
        ref={strip}
        viewBox={`0 0 ${width.toFixed(0)} ${height}`}
        role="img"
        aria-label="Audit events across the window — drag to narrow the log"
        className="block h-auto w-full cursor-crosshair touch-none select-none"
        onPointerDown={event => {
          // a drag across the strip is a brush, not a text selection
          event.preventDefault();
          anchor.current = pointerTime(event);
          strip.current?.setPointerCapture(event.pointerId);
        }}
        onPointerMove={track}
        onPointerUp={settle}
        onPointerCancel={cancel}
      >
        {ticks.map(moment => {
          const midnight = new Date(moment).getHours() === 0;
          return (
            <g key={moment}>
              <line
                x1={at(moment)}
                y1={HEAD - 4}
                x2={at(moment)}
                y2={height - FOOT}
                className={midnight ? 'stroke-border2' : 'stroke-border1'}
              />
              {midnight ? (
                <text
                  x={at(moment)}
                  y={13}
                  textAnchor="middle"
                  className="fill-icon2 font-mono text-[8.5px] tracking-[0.12em] uppercase"
                >
                  {dayLabel(moment)}
                </text>
              ) : null}
            </g>
          );
        })}

        {lanes.map(({ namespace, ticks: lane }, index) => {
          const y = HEAD + index * LANE;
          return (
            <g key={namespace} opacity={shown.has(namespace) ? 1 : 0.22}>
              <line x1={pad} y1={y + LANE - 5} x2={pad + plot} y2={y + LANE - 5} className="stroke-border1" />
              <text
                x={pad - 12}
                y={y + LANE / 2 - 2}
                textAnchor="end"
                className="fill-icon3 font-mono text-[8.5px] tracking-[0.12em] uppercase"
              >
                {NAMESPACE_LABELS[namespace]}
              </text>
              <text x={pad - 12} y={y + LANE / 2 + 10} textAnchor="end" className="fill-icon2 font-mono text-[10px]">
                {lane.length}
              </text>
              {lane.map(event => {
                const agent = event.actorType === 'agent';
                return (
                  <rect
                    key={event.id}
                    x={at(Date.parse(event.occurredAt)) - 1}
                    y={y + 4 + laneOffset(event.id)}
                    width={2}
                    height={7}
                    rx={1}
                    opacity={agent ? 0.9 : 0.55}
                    className={agent ? NAMESPACE_PAINT[namespace].fill : 'fill-icon3'}
                  />
                );
              })}
            </g>
          );
        })}

        {/* the slice is what stays lit — dimming around it needs no colour of its own */}
        <rect
          x={pad}
          y={HEAD - 4}
          width={at(brush.from) - pad}
          height={height - FOOT - HEAD + 4}
          className="fill-surface1 opacity-65"
        />
        <rect
          x={at(brush.to)}
          y={HEAD - 4}
          width={Math.max(0, pad + plot - at(brush.to))}
          height={height - FOOT - HEAD + 4}
          className="fill-surface1 opacity-65"
        />
        <line x1={at(brush.from)} y1={HEAD - 4} x2={at(brush.from)} y2={height - FOOT} className="stroke-icon4" />
        <line x1={at(brush.to)} y1={HEAD - 4} x2={at(brush.to)} y2={height - FOOT} className="stroke-icon4" />
        <line x1={at(to)} y1={HEAD - 4} x2={at(to)} y2={height - FOOT} className="stroke-positive1 opacity-60" />
        <text
          x={at(to) - 4}
          y={height - 6}
          textAnchor="end"
          className="fill-positive1 font-mono text-[8.5px] tracking-[0.18em]"
        >
          NOW
        </text>
      </svg>
    </div>
  );
}
