import { useMaybeSidebarState } from '@mastra/playground-ui/components/MainSidebar';
import { Txt } from '@mastra/playground-ui/components/Txt';
import {
  Ban,
  Bot,
  CircleCheck,
  CircleDot,
  CircleHelp,
  Clock,
  GitMerge,
  MoveRight,
  TrendingDown,
  type LucideIcon,
} from 'lucide-react';
import { useId, useState, type CSSProperties, type ReactNode } from 'react';

import { formatDuration } from '../../../../lib/date';
import { armsOf, band, AXIS, BOTTOM_MARGIN, MIN_HALF, SPAN, WIDTH } from '../funnelGeometry';
import type { FunnelStage } from '../overview';
import { AGENT_COLOR, HUMAN_COLOR } from '../overviewTheme';
import { boardStage, isTerminalStage, stageLabel } from '../stages';
import { BoardStageIcon } from './BoardIcons';

const EMPTY = 'text-icon3 m-0';

/** Narrow, the chart turns a quarter: authored once left to right, transposed on the way out. */
const TRANSPOSE = 'matrix(0 1 1 0 0 0)';

const STRIP = {
  down: 'grid grid-rows-[repeat(var(--stages),minmax(0,1fr))]',
  across: 'grid [grid-template-columns:repeat(var(--stages),minmax(0,1fr))]',
};

interface StripStyle extends CSSProperties {
  '--stages'?: number;
}

const HATCH = `repeating-linear-gradient(-45deg, ${AGENT_COLOR} 0 2.25px, transparent 2.25px 6px)`;

function percent(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 100);
}

/** Not "Intake": that column also holds live GitHub and Linear candidates with no `work_items` row, which nothing here counts. */
function rungLabel(stage: string): string {
  return stage === 'intake' ? 'Entered' : stageLabel(stage);
}

function Row({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <>
      <span className="text-ui-xs text-icon3 flex items-center gap-1.5">
        <Icon aria-hidden className="text-icon2 size-3.5 shrink-0" />
        {label}
      </span>
      <span className="text-ui-xs text-icon5 text-right tabular-nums">{value}</span>
    </>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <span className="flex flex-col gap-2">
      <span className="text-icon6">{title}</span>
      <span className="grid grid-cols-[auto_auto] items-baseline gap-x-4 gap-y-1">{children}</span>
    </span>
  );
}

function ColumnDetail({
  step,
  entered,
  previous,
  merged,
}: {
  step: FunnelStage;
  entered: number;
  previous: FunnelStage | undefined;
  merged: number | undefined;
}) {
  const dropped = previous ? previous.reached - step.reached : 0;

  return (
    <Card title={rungLabel(step.stage)}>
      <Row
        icon={MoveRight}
        label="Got this far"
        value={`${step.reached} of ${entered} · ${percent(step.reached, entered)}%`}
      />
      <Row
        icon={Bot}
        label="Without a person"
        value={`${step.unattended} · ${percent(step.unattended, step.reached)}%`}
      />
      {previous && dropped > 0 ? (
        <Row icon={TrendingDown} label={`Lost since ${rungLabel(previous.stage)}`} value={String(dropped)} />
      ) : null}
      {isTerminalStage(step.stage) ? (
        <Row icon={CircleCheck} label="Shipped from here" value={String(step.restingAt)} />
      ) : null}
      {step.medianHoldMs !== undefined ? (
        <Row icon={Clock} label="Typical hold" value={formatDuration(step.medianHoldMs)} />
      ) : null}
      {merged !== undefined && merged > 0 ? (
        <Row icon={GitMerge} label="Landed as a merged PR" value={String(merged)} />
      ) : null}
    </Card>
  );
}

function ArmDetail({ step, entered }: { step: FunnelStage; entered: number }) {
  const gone = step.restingAt - step.open;

  return (
    <Card title={`Went no further than ${rungLabel(step.stage)}`}>
      <Row
        icon={TrendingDown}
        label="Stopped here"
        value={`${step.restingAt} of ${entered} · ${percent(step.restingAt, entered)}%`}
      />
      <Row icon={CircleDot} label="Still holding the column" value={String(step.open)} />
      <Row icon={Ban} label="Called off" value={String(step.canceled)} />
      {gone - step.canceled > 0 ? (
        <Row icon={CircleHelp} label="Left without a decision" value={String(gone - step.canceled)} />
      ) : null}
      {step.medianHoldMs !== undefined ? (
        <Row icon={Clock} label="Typical hold here" value={formatDuration(step.medianHoldMs)} />
      ) : null}
    </Card>
  );
}

/** Rides the cursor, not an anchor: the shapes are long and thin, so a card centred on one lands a chart away from the point. */
function Readout({ cursor, children }: { cursor: Cursor; children: ReactNode }) {
  const shift = (flip: boolean) => (flip ? `calc(-100% - ${CURSOR_GAP}px)` : `${CURSOR_GAP}px`);
  return (
    <div
      role="tooltip"
      className="border-border1 bg-surface3 text-ui-sm leading-ui-sm text-neutral5 shadow-dialog animate-in fade-in zoom-in-95 pointer-events-none absolute z-100 flex w-max flex-col rounded-lg border px-2.5 py-1.5 whitespace-nowrap motion-reduce:animate-none"
      style={{
        left: cursor.x,
        top: cursor.y,
        // The individual property, so the entry keyframe's scale composes with it instead of replacing it.
        translate: `${shift(cursor.flipX)} ${shift(cursor.flipY)}`,
        transformOrigin: `${cursor.flipX ? 'right' : 'left'} ${cursor.flipY ? 'bottom' : 'top'}`,
      }}
    >
      {children}
    </div>
  );
}

function Key({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="text-ui-xs text-icon3 flex items-center gap-1.5">
      {children}
      {label}
    </span>
  );
}

type Hovered = { kind: 'column' | 'arm'; index: number };

/** Where to draw the readout, and which corner of it to hang off the cursor. */
interface Cursor {
  x: number;
  y: number;
  flipX: boolean;
  flipY: boolean;
}

/** Past these fractions of the chart the card would run off its own edge. */
const FLIP_X = 0.62;
const FLIP_Y = 0.6;
const CURSOR_GAP = 14;

function cursorAt(event: { clientX: number; clientY: number; currentTarget: Element }): Cursor {
  const box = event.currentTarget.getBoundingClientRect();
  const x = event.clientX - box.left;
  const y = event.clientY - box.top;
  return { x, y, flipX: x > box.width * FLIP_X, flipY: y > box.height * FLIP_Y };
}

/**
 * One cohort flowing left to right, placed by the furthest stage it ever
 * reached — not board occupancy: a card stays counted after it moves on.
 * Saturated is hands-off, pale is a person stepping in, and what the flow sheds
 * dives out as its own hatched lane rather than vanishing into whitespace.
 */
export function StageFunnel({
  funnel,
  pullRequests,
  merged,
}: {
  funnel: FunnelStage[];
  pullRequests: number;
  merged: number;
}) {
  const down = useMaybeSidebarState()?.isMobile ?? false;
  const hatchId = useId();
  const coreId = useId();
  const clipId = useId();
  const maskId = useId();
  const [hovered, setHovered] = useState<Hovered | null>(null);
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const entered = funnel[0]?.reached ?? 0;
  const done = funnel.at(-1)?.reached ?? 0;

  if (entered === 0) {
    return (
      <Txt as="p" variant="ui-sm" className={EMPTY}>
        Nothing new in this window
      </Txt>
    );
  }

  const unit = SPAN / entered;
  const half = (count: number) => (count === 0 ? 0 : Math.max(MIN_HALF, (count * unit) / 2));
  const flow = funnel.map(step => half(step.reached));
  const flowPath = band(flow);
  const { arms, depth } = armsOf(flow, funnel, unit);
  const height = Math.max(depth, AXIS + flow[0]!) + BOTTOM_MARGIN;
  const column = WIDTH / funnel.length;
  // The board polls under the cursor: a lane can be gone by the time we draw it.
  const hoveredArm = hovered?.kind === 'arm' ? arms.find(arm => arm.index === hovered.index) : undefined;
  const active = hovered?.kind === 'column' ? funnel[hovered.index] : undefined;
  const stopped = hoveredArm ? funnel[hoveredArm.index] : undefined;
  const stripStyle: StripStyle = { '--stages': funnel.length };

  return (
    <div className={`@container ${down ? 'grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-4' : 'flex flex-col gap-4'}`}>
      <div className={down ? STRIP.down : STRIP.across} style={stripStyle}>
        {funnel.map(step => {
          const stage = boardStage(step.stage);
          return (
            <div key={step.stage} className={`flex min-w-0 flex-col gap-1 ${down ? 'justify-center' : ''}`}>
              <span className="flex min-w-0 items-center gap-1.5">
                {stage ? <BoardStageIcon stage={stage} /> : null}
                <Txt as="span" variant="ui-xs" className="text-icon5 truncate font-semibold">
                  {rungLabel(step.stage)}
                </Txt>
              </span>
              <span
                className={`text-neutral6/70 leading-none font-semibold tracking-tight tabular-nums ${down ? 'text-[1.5rem]' : 'text-[clamp(1.25rem,2.5cqw,2rem)]'}`}
              >
                {step.reached}
              </span>
              <Txt as="span" variant="ui-xs" className="text-icon3 truncate tabular-nums">
                {step.medianHoldMs === undefined ? ' ' : `${formatDuration(step.medianHoldMs)} typical`}
              </Txt>
            </div>
          );
        })}
      </div>

      <div
        className={down ? 'relative order-first' : 'relative'}
        onPointerMove={event => setCursor(cursorAt(event))}
        onPointerLeave={() => {
          setHovered(null);
          setCursor(null);
        }}
      >
        <svg
          viewBox={down ? `0 0 ${height} ${WIDTH}` : `0 0 ${WIDTH} ${height}`}
          // Squeezed into its column the flow would be a thread; letting it fill
          // stretches every thickness by the same factor, so the rungs still compare.
          preserveAspectRatio={down ? 'none' : undefined}
          className={down ? 'absolute inset-0 block h-full w-full' : 'block h-auto w-full'}
          role="img"
          aria-label={`${entered} items entered, shedding ${entered - done} on the way to ${done} at Done.`}
        >
          <defs>
            <linearGradient id={coreId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={AGENT_COLOR} stopOpacity="0.5" />
              <stop offset="100%" stopColor={AGENT_COLOR} stopOpacity="0.95" />
            </linearGradient>
            <pattern id={hatchId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill={AGENT_COLOR} fillOpacity="0.1" />
              <line x1="0" y1="0" x2="0" y2="6" stroke={AGENT_COLOR} strokeOpacity="0.45" strokeWidth="2.25" />
            </pattern>
            {funnel.map((step, index) => (
              <clipPath key={step.stage} id={`${clipId}-${index}`}>
                <rect x={column * index} y="0" width={column} height={height} />
              </clipPath>
            ))}
            {/* The flow is half opaque, so a lane has to be cut out of it rather than covered by it. */}
            <mask id={maskId}>
              <rect width={WIDTH} height={height} fill="white" />
              <path d={flowPath} fill="black" />
            </mask>
          </defs>

          <g transform={down ? TRANSPOSE : undefined}>
            <g mask={`url(#${maskId})`}>
              {arms.map(arm => (
                <path key={arm.stage} d={arm.path} fill={`url(#${hatchId})`} />
              ))}
            </g>

            <path d={flowPath} fill={HUMAN_COLOR} opacity="0.5" />
            <path d={band(funnel.map(step => half(step.unattended)))} fill={`url(#${coreId})`} />

            {hovered && (active || hoveredArm) ? (
              <path
                d={hoveredArm ? hoveredArm.path : flowPath}
                clipPath={hoveredArm ? undefined : `url(#${clipId}-${hovered.index})`}
                mask={hoveredArm ? `url(#${maskId})` : undefined}
                fill="var(--surface2)"
                opacity="0.18"
                pointerEvents="none"
              />
            ) : null}

            <rect
              width={WIDTH}
              height={height}
              fill="none"
              pointerEvents="all"
              onPointerEnter={() => setHovered(null)}
            />

            {arms.map(arm => (
              <path
                key={arm.stage}
                d={arm.path}
                fill="none"
                // A lane two items thick is a few pixels tall; the stroke gives it a grabbable edge.
                strokeWidth="7"
                pointerEvents="all"
                onPointerEnter={() => setHovered({ kind: 'arm', index: arm.index })}
              />
            ))}

            {funnel.map((step, index) => (
              <path
                key={step.stage}
                d={flowPath}
                clipPath={`url(#${clipId}-${index})`}
                fill="none"
                pointerEvents="all"
                onPointerEnter={() => setHovered({ kind: 'column', index })}
              />
            ))}
          </g>
        </svg>

        {cursor && hovered && (active || stopped) ? (
          <Readout cursor={cursor}>
            {active ? (
              <ColumnDetail
                step={active}
                entered={entered}
                previous={funnel[hovered.index - 1]}
                merged={hovered.index === funnel.length - 1 ? merged : undefined}
              />
            ) : null}
            {stopped ? <ArmDetail step={stopped} entered={entered} /> : null}
          </Readout>
        ) : null}

        {/* The readouts ride the pointer, so the same numbers are here as text for anyone not using one. */}
        <div className="sr-only">
          {funnel.map((step, index) => (
            <div key={step.stage}>
              <ColumnDetail
                step={step}
                entered={entered}
                previous={funnel[index - 1]}
                merged={index === funnel.length - 1 ? merged : undefined}
              />
              {step.restingAt > 0 ? <ArmDetail step={step} entered={entered} /> : null}
            </div>
          ))}
        </div>
      </div>

      <div className={`flex flex-wrap items-center gap-x-5 gap-y-1 ${down ? 'col-span-2 mt-4' : ''}`}>
        <Key label="hands-off">
          <span className="h-2 w-4 rounded-full" style={{ backgroundColor: AGENT_COLOR }} />
        </Key>
        <Key label="a person stepped in">
          <span className="h-2 w-4 rounded-full opacity-50" style={{ backgroundColor: HUMAN_COLOR }} />
        </Key>
        <Key label="left the flow">
          <span className="h-2 w-4 rounded-full opacity-60" style={{ backgroundImage: HATCH }} />
        </Key>
        <span className="ml-auto flex flex-col items-end gap-0.5">
          {pullRequests > 0 ? (
            <Txt as="span" variant="ui-xs" className="text-icon3 tabular-nums">
              {[`${pullRequests} opened a pull request`, merged > 0 ? `${merged} merged` : null]
                .filter(Boolean)
                .join(' · ')}
            </Txt>
          ) : null}
          <Txt as="span" variant="ui-xs" className="text-icon3">
            created in this window, by furthest stage reached
          </Txt>
        </span>
      </div>
    </div>
  );
}
