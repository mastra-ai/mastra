import { cn } from '@mastra/playground-ui/utils/cn';
import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { PointerEvent, RefObject } from 'react';

import { ACTIVITY_KIND_ORDER } from '../../periodActivity';
import type { ActivityKind, ActivitySlot } from '../../periodActivity';
import { ACTIVITY_KINDS } from './activityFormat';

const LEVELS = 8;
const PITCH = 5;
const BAR = 3;
const RADIUS = BAR / 2;
const DOT = 0.7;
const GAP = 0.8;
export const FIELD_HEIGHT = (LEVELS - 1) * PITCH + BAR;

interface Band {
  kind: ActivityKind;
  top: number;
  bottom: number;
}

interface Bar {
  top: number;
  bands: Band[];
}

interface FieldPaths {
  outline: string;
  unlit: string;
  lifted: string;
  lit: Record<ActivityKind, string>;
}

const EMPTY: Bar = { top: FIELD_HEIGHT, bands: [] };

function useColumnCount(ref: RefObject<HTMLElement | null>) {
  const [columns, setColumns] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = (width: number) => setColumns(Math.floor((width + PITCH - BAR) / PITCH));
    measure(element.getBoundingClientRect().width);
    const observer = new ResizeObserver(entries => {
      const entry = entries.at(-1);
      const width = entry?.borderBoxSize[0]?.inlineSize ?? entry?.contentRect.width;
      if (width !== undefined) measure(width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return columns;
}

const slotAt = (column: number, slots: number, columns: number) => Math.floor((column * slots) / columns);

function slotCenter(index: number, slots: number, columns: number) {
  const first = Math.ceil((index * columns) / slots);
  const last = Math.ceil(((index + 1) * columns) / slots) - 1;
  return Math.floor((first + last) / 2);
}

const total = (slot: ActivitySlot) => ACTIVITY_KIND_ORDER.reduce((sum, kind) => sum + slot.counts[kind], 0);
const capsule = (x: number, top: number) =>
  `M${x} ${top + RADIUS}a${RADIUS} ${RADIUS} 0 0 1 ${BAR} 0V${FIELD_HEIGHT - RADIUS}a${RADIUS} ${RADIUS} 0 0 1 ${-BAR} 0Z`;
const band = (x: number, top: number, bottom: number) => `M${x} ${top}h${BAR}V${bottom}h${-BAR}Z`;
const dot = (x: number, y: number) =>
  `M${x - DOT} ${y}a${DOT} ${DOT} 0 1 0 ${2 * DOT} 0a${DOT} ${DOT} 0 1 0 ${-2 * DOT} 0`;

function bar(slot: ActivitySlot, peak: number): Bar {
  const sum = total(slot);
  if (sum === 0) return EMPTY;
  const top = FIELD_HEIGHT - Math.max(BAR, (sum / peak) * FIELD_HEIGHT);
  const bands: Band[] = [];
  let bottom = FIELD_HEIGHT;
  for (const kind of ACTIVITY_KIND_ORDER) {
    const size = ((FIELD_HEIGHT - top) * slot.counts[kind]) / sum;
    if (size === 0) continue;
    bands.push({ kind, top: bottom - size, bottom });
    bottom -= size;
  }
  return { top, bands };
}

function paint(slots: readonly ActivitySlot[], columns: number, hovered: number | undefined): FieldPaths {
  const peak = Math.max(1, ...slots.map(total));
  const bars = slots.map(slot => bar(slot, peak));
  const outline: string[] = [];
  const unlit: string[] = [];
  const lifted: string[] = [];
  const lit: Record<ActivityKind, string[]> = { cameIn: [], ran: [], shipped: [] };
  for (let column = 0; column < columns; column += 1) {
    const index = slotAt(column, slots.length, columns);
    const { top, bands } = column === slotCenter(index, slots.length, columns) ? (bars[index] ?? EMPTY) : EMPTY;
    const x = column * PITCH;
    if (bands.length > 0) outline.push(capsule(x, top));
    bands.forEach(({ kind, top: from, bottom: to }, position) => {
      const upper = position === bands.length - 1 ? from : from + GAP / 2;
      const lower = position === 0 ? to : to - GAP / 2;
      if (lower > upper) lit[kind].push(band(x, upper, lower));
    });
    const dots = index === hovered ? lifted : unlit;
    for (let row = 0; row < LEVELS; row += 1) {
      const y = row * PITCH + RADIUS;
      if (y + DOT > top - GAP) break;
      dots.push(dot(x + RADIUS, y));
    }
  }
  return {
    outline: outline.join(''),
    unlit: unlit.join(''),
    lifted: lifted.join(''),
    lit: { cameIn: lit.cameIn.join(''), ran: lit.ran.join(''), shipped: lit.shipped.join('') },
  };
}

export function ActivityField({
  slots,
  loading,
  hovered,
  onHover,
  onLeave,
}: {
  slots: readonly ActivitySlot[];
  loading: boolean;
  hovered: number | undefined;
  onHover: (index: number, clientX: number) => void;
  onLeave: () => void;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const clipId = useId();
  const columns = Math.max(useColumnCount(frame), slots.length);
  const { outline, unlit, lifted, lit } = paint(slots, columns, hovered);
  const viewWidth = (columns - 1) * PITCH + BAR;
  const point = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const column = Math.min(columns - 1, Math.max(0, Math.floor(((event.clientX - box.left) / box.width) * columns)));
    const index = slotAt(column, slots.length, columns);
    if (index === hovered) return;
    const center = slotCenter(index, slots.length, columns) * PITCH + RADIUS;
    onHover(index, box.left + center * (box.width / viewWidth));
  };
  return (
    <div ref={frame}>
      <svg
        aria-hidden
        viewBox={`0 0 ${viewWidth} ${FIELD_HEIGHT}`}
        onPointerMove={point}
        onPointerLeave={onLeave}
        className={cn('text-foreground block h-auto w-full', loading && 'motion-safe:animate-pulse')}
      >
        <defs>
          <clipPath id={clipId}>
            <path d={outline} />
          </clipPath>
        </defs>
        <path d={unlit} fill="currentColor" className="opacity-20" />
        <path d={lifted} fill="currentColor" className="opacity-50" />
        <g clipPath={`url(#${clipId})`}>
          {ACTIVITY_KINDS.map(({ kind, tone }) => (
            <path key={kind} d={lit[kind]} fill="currentColor" className={tone} />
          ))}
        </g>
      </svg>
    </div>
  );
}
