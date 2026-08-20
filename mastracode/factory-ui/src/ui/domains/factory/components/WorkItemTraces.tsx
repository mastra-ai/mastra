import { Txt } from '@mastra/playground-ui/components/Txt';
import { useRef, useState, type ReactNode } from 'react';

import { useHostWidth } from '../../../../hooks/useHostWidth';
import type { WorkItem } from '../services/workItems';
import { stageLabel, stagePaint } from '../stages';
import { buildShape, DRAWN_STAGES, ROW, type Row, type Segment, type TraceWindow } from '../traces';
import { BoardOccupancy } from './BoardOccupancy';
import { pointIn, TraceTooltip, type Point } from './TraceTooltip';

/** Rows arrive in reading order; past this the stagger is a wait, not a flourish. */
const STAGGER_CAP = 400;

interface Opened {
  row: Row;
  segment: Segment | null;
  pinned: boolean;
  at: Point;
}

/** One row per card: length is time, colour is the stage that held it. */
export function WorkItemTraces({
  traced,
  running,
  window: traceWindow,
  now,
}: {
  traced: WorkItem[];
  running: ReadonlySet<string>;
  window: TraceWindow;
  now: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const cursor = useRef<Point | null>(null);
  const width = useHostWidth(host);
  const [open, setOpen] = useState<Opened | null>(null);
  const shape = buildShape(width, traced, running, traceWindow, now);

  // keyboard focus has no pointer to ride, so the row itself is the anchor
  const anchor = (row: Row): Point => cursor.current ?? { x: shape.gutter + 24, y: row.mid };
  const hover = (row: Row, segment: Segment | null) => {
    if (!open?.pinned) setOpen({ row, segment, pinned: false, at: anchor(row) });
  };
  const leave = (row: Row) => {
    setOpen(current => (current?.pinned || current?.row.key !== row.key ? current : null));
  };
  const pin = (row: Row, segment: Segment | null) => {
    setOpen(current =>
      current?.pinned && current.row.key === row.key ? null : { row, segment, pinned: true, at: anchor(row) },
    );
  };

  if (shape.rows.length === 0) {
    return (
      <Txt as="p" variant="ui-sm" className="text-icon3 m-0">
        No card moved in this window.
      </Txt>
    );
  }

  return (
    <div ref={host} className="flex flex-col gap-3">
      <BoardOccupancy shape={shape} window={traceWindow} />

      <div
        className="relative"
        onPointerMove={event => {
          cursor.current = pointIn(event);
        }}
      >
        <svg
          viewBox={`0 0 ${shape.width.toFixed(0)} ${shape.height.toFixed(0)}`}
          role="group"
          aria-label={`Work item traces over the last ${traceWindow.label}`}
          className="block h-auto w-full"
        >
          {shape.ticks.map(tick => (
            <g key={tick.x}>
              <line x1={tick.x} y1={26} x2={tick.x} y2={shape.height} className="stroke-border1" />
              {tick.label ? (
                <text x={tick.x} y={18} textAnchor="middle" className="fill-icon2 font-mono text-[9.5px]">
                  {tick.label}
                </text>
              ) : null}
            </g>
          ))}
          <line x1={shape.nowX} y1={26} x2={shape.nowX} y2={shape.height} className="stroke-positive1 opacity-60" />
          <text
            x={shape.nowX - 4}
            y={18}
            textAnchor="end"
            className="fill-positive1 font-mono text-[9.5px] tracking-widest"
          >
            NOW
          </text>

          {shape.rows.map((row, index) => (
            <g
              key={row.key}
              role="button"
              tabIndex={0}
              aria-label={row.described}
              className="group animate-trace-in focus-visible:outline-accent1 cursor-pointer focus-visible:outline-2 motion-reduce:animate-none"
              style={{ animationDelay: `${Math.min(index * 18, STAGGER_CAP)}ms` }}
              onMouseEnter={() => hover(row, null)}
              onMouseMove={() => hover(row, null)}
              onMouseLeave={() => leave(row)}
              onFocus={() => hover(row, null)}
              onBlur={() => leave(row)}
              onClick={() => pin(row, null)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  pin(row, null);
                }
              }}
            >
              <rect
                x={0}
                y={row.y}
                width={shape.width}
                height={ROW}
                className={`transition-colors duration-100 ${open?.row.key === row.key ? 'fill-surface4' : 'group-hover:fill-surface4 fill-transparent'}`}
              />
              <text x={10} y={row.mid + 7} className="fill-icon2 font-mono text-[10.5px]">
                {row.cardKey}
              </text>
              {shape.gutter > 200 ? (
                <text
                  x={72}
                  y={row.mid + 7}
                  className="fill-icon3 group-hover:fill-icon5 text-[11.5px] transition-colors duration-100"
                >
                  {clip(row.title, 36)}
                </text>
              ) : null}
              {row.segments.map(segment => (
                <rect
                  key={segment.key}
                  x={segment.x}
                  y={row.mid}
                  width={segment.width}
                  height={7}
                  rx={3}
                  opacity={segmentOpacity(segment, open?.segment ?? null)}
                  className={`${segment.fill} transition-opacity duration-100`}
                  onMouseMove={event => {
                    event.stopPropagation();
                    hover(row, segment);
                  }}
                  onClick={event => {
                    event.stopPropagation();
                    pin(row, segment);
                  }}
                />
              ))}
              {row.hops.map(path => (
                <path key={path} d={path} fill="none" strokeWidth={1.1} className="stroke-warning1 opacity-85" />
              ))}
              {row.canceledAt === null ? null : (
                <path d={crossPath(row.canceledAt, row.mid)} fill="none" strokeWidth={1.4} className="stroke-icon2" />
              )}
              {row.shippedAt === null ? null : (
                <circle cx={row.shippedAt} cy={row.mid + 3.5} r={3.5} className="fill-positive1" />
              )}
              {row.liveAt === null ? null : (
                <>
                  <circle
                    cx={row.liveAt}
                    cy={row.mid + 3.5}
                    r={6.5}
                    className="fill-positive1 animate-live-pulse opacity-25 motion-reduce:animate-none"
                  />
                  <circle cx={row.liveAt} cy={row.mid + 3.5} r={3.5} className="fill-positive1" />
                </>
              )}
            </g>
          ))}
        </svg>

        {open ? (
          <TraceTooltip at={open.at} hostWidth={shape.width}>
            <span className="text-icon6">{open.row.title}</span>
            <span className="text-icon3 font-mono">
              {[open.row.cardKey, ...open.row.detail].filter(Boolean).join(' · ')}
            </span>
            {open.segment ? <span className="text-icon4">{open.segment.detail}</span> : null}
          </TraceTooltip>
        ) : null}
      </div>

      <div className="text-ui-xs text-icon3 flex flex-wrap items-center gap-x-5 gap-y-2">
        {DRAWN_STAGES.map(stage => (
          <Key key={stage} fill={stagePaint(stage).fill}>
            {stageLabel(stage)}
          </Key>
        ))}
        <Key fill="fill-positive1" shape="dot">
          Shipped
        </Key>
        <Key fill="stroke-warning1" shape="arc">
          Sent back
        </Key>
        {shape.hidden > 0 ? <span className="ml-auto">{shape.hidden} older cards not drawn</span> : null}
      </div>
    </div>
  );
}

/** The stage under the cursor reads at full strength; intake stays held back. */
function segmentOpacity(segment: Segment, focused: Segment | null): number {
  if (focused?.key === segment.key) return 1;
  return segment.faded ? 0.32 : segment.open ? 0.95 : 0.7;
}

function crossPath(x: number, mid: number): string {
  const arm = 4;
  return `M${(x - arm).toFixed(1)} ${mid - 1} l${arm * 2} ${arm * 2 + 1} m0 ${-(arm * 2 + 1)} l${-arm * 2} ${arm * 2 + 1}`;
}

function clip(text: string, characters: number): string {
  return text.length > characters ? `${text.slice(0, characters - 1)}…` : text;
}

function Key({ fill, shape = 'bar', children }: { fill: string; shape?: 'bar' | 'dot' | 'arc'; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <svg width={10} height={10} aria-hidden="true" className="shrink-0">
        {shape === 'bar' ? <rect x={0} y={3} width={10} height={4} rx={2} className={fill} /> : null}
        {shape === 'dot' ? <circle cx={5} cy={5} r={3.5} className={fill} /> : null}
        {shape === 'arc' ? <path d="M1 8 C 1 2, 9 2, 9 8" fill="none" strokeWidth={1.3} className={fill} /> : null}
      </svg>
      {children}
    </span>
  );
}
