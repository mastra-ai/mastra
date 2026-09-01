import { useId } from 'react';

import { AUDIT_CATEGORIES, auditCategory, auditEventTime, type AuditTimeRange } from '../../auditPresentation';
import { AUDIT_AXIS_TICKS, auditRulerStep, auditRulerTicks } from '../../auditRuler';
import type { AuditEvent } from '../../services/audit';

type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

interface AuditMark {
  id: string;
  at: number;
  actorType: AuditEvent['actorType'];
  muted: boolean;
}

interface AuditLane {
  category: AuditCategory;
  marks: AuditMark[];
}

// Strokes carry their own width, so the box stretches to any width without
// distorting a mark: time is the x scale, height stays a constant 6rem.
// A lane keeps its dotted rule whether or not it holds marks: a mark is offset
// inside its lane, so without the rule it floats between categories.
// Both fades are userSpaceOnUse: a line has no area, and an objectBoundingBox
// gradient over a zero-area box paints nothing at all.
const WIDTH = 1000;
const PADDING = 6;
const LANE_HEIGHT = 14;
const MARK_HEIGHT = 8;

function markOffset(id: string): number {
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) % 7;
  return hash - 3;
}

export function AuditTimeline({
  events,
  bounds,
  range,
}: {
  events: AuditEvent[];
  bounds: AuditTimeRange;
  range: AuditTimeRange | undefined;
}) {
  const gradientId = useId().replace(/:/g, '');
  const gridGradientId = `${gradientId}-grid`;
  const laneGradientId = `${gradientId}-lane`;
  const lanes: AuditLane[] = AUDIT_CATEGORIES.map(category => ({ category, marks: [] }));
  const lanesByNamespace = new Map(lanes.map(lane => [lane.category.namespace, lane]));
  for (const event of events) {
    const at = auditEventTime(event);
    const category = auditCategory(event.action);
    if (at === undefined || !category) continue;
    lanesByNamespace.get(category.namespace)?.marks.push({
      id: event.id,
      at,
      actorType: event.actorType,
      muted: range !== undefined && (at < range.from || at > range.to),
    });
  }
  const height = PADDING * 2 + lanes.length * LANE_HEIGHT;
  const span = bounds.to - bounds.from;
  const xAt = (at: number) => ((at - bounds.from) / span) * WIDTH;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Audit events over time"
      className="block h-24 w-full select-none"
    >
      <defs>
        <linearGradient id={gridGradientId} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={0} y2={height}>
          <stop offset="0%" stopColor="var(--border2)" stopOpacity={0} />
          <stop offset="28%" stopColor="var(--border2)" stopOpacity={1} />
          <stop offset="72%" stopColor="var(--border2)" stopOpacity={1} />
          <stop offset="100%" stopColor="var(--border2)" stopOpacity={0} />
        </linearGradient>

        <linearGradient id={laneGradientId} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={WIDTH} y2={0}>
          <stop offset="0%" stopColor="var(--border2)" stopOpacity={0} />
          <stop offset="18%" stopColor="var(--border2)" stopOpacity={1} />
          <stop offset="82%" stopColor="var(--border2)" stopOpacity={1} />
          <stop offset="100%" stopColor="var(--border2)" stopOpacity={0} />
        </linearGradient>
      </defs>

      {auditRulerTicks(bounds, auditRulerStep(span, AUDIT_AXIS_TICKS)).map(at => (
        <line
          key={at}
          x1={xAt(at)}
          y1={0}
          x2={xAt(at)}
          y2={height}
          vectorEffect="non-scaling-stroke"
          stroke={`url(#${gridGradientId})`}
        />
      ))}

      {lanes.map((lane, index) => {
        const y = PADDING + index * LANE_HEIGHT + LANE_HEIGHT / 2;
        return (
          <g key={lane.category.namespace} className={lane.category.strokeClass}>
            <line
              x1={0}
              y1={y}
              x2={WIDTH}
              y2={y}
              strokeWidth={1.5}
              strokeDasharray="1 5"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              stroke={`url(#${laneGradientId})`}
            />

            {lane.marks.map(mark => {
              const center = y + markOffset(mark.id);
              return (
                <line
                  key={mark.id}
                  x1={xAt(mark.at)}
                  y1={center - MARK_HEIGHT / 2}
                  x2={xAt(mark.at)}
                  y2={center + MARK_HEIGHT / 2}
                  strokeWidth={2}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  opacity={(mark.actorType === 'agent' ? 1 : 0.65) * (mark.muted ? 0.16 : 1)}
                />
              );
            })}
          </g>
        );
      })}

      {range
        ? [range.from, range.to].map(at => (
            <line
              key={at}
              x1={xAt(at)}
              y1={PADDING / 2}
              x2={xAt(at)}
              y2={height - PADDING / 2}
              strokeDasharray="2 3"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              className="stroke-accent3/60"
            />
          ))
        : null}
    </svg>
  );
}
