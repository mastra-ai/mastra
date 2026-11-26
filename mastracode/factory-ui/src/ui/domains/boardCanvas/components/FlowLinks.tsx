import { cn } from '@mastra/playground-ui/utils/cn';
import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Where a link meets a card: an open dot centered on the card's edge, so the line reads as plugged into the card
 * rather than floating in the gap. Same ink and weight as the link itself. Marked `data-port` so links drawn as paths
 * can stop at its rim.
 */
export function Port({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      data-port=""
      className={cn('bg-card border-canvas-link relative z-10 size-2.5 shrink-0 rounded-full border', className)}
    />
  );
}

/** A link's line; it takes its length from the box it sits in. */
export const LINK_LINE = 'bg-canvas-link w-px';
/** The same line, for links drawn as SVG paths. */
export const LINK_STROKE = 'stroke-canvas-link fill-none stroke-1';
/**
 * Where a link meets a card's top or bottom edge: its middle, or 20px in on a phone, where the flow stacks into one
 * column and its links run down the left gutter, through the intake entry's port.
 */
export const CARD_PORT = 'absolute left-1/2 -translate-x-1/2 max-sm:left-5';
/** How round a link turns a corner, when its legs are long enough. */
const CORNER = 8;

interface Point {
  x: number;
  y: number;
}

/** An SVG path through the turns of a link, each one rounded. */
export function elbowPath(points: readonly Point[]): string {
  const turns = points.filter((point, index) => {
    const before = points[index - 1];
    return !before || before.x !== point.x || before.y !== point.y;
  });
  const span = (from: Point, to: Point) => Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
  const toward = (from: Point, to: Point, by: number) => ({
    x: from.x + Math.sign(to.x - from.x) * by,
    y: from.y + Math.sign(to.y - from.y) * by,
  });
  return turns
    .map((turn, index) => {
      const before = turns[index - 1];
      const after = turns[index + 1];
      if (!before) return `M${turn.x} ${turn.y}`;
      if (!after) return `L${turn.x} ${turn.y}`;
      const round = Math.min(CORNER, span(before, turn) / 2, span(turn, after) / 2);
      const into = toward(turn, before, round);
      const out = toward(turn, after, round);
      return `L${into.x} ${into.y} Q${turn.x} ${turn.y} ${out.x} ${out.y}`;
    })
    .join(' ');
}

/**
 * Joins a card to the one stacked above it, port to port across the gap between them. It belongs to the lower card,
 * which paints after the upper one, so both ports stay on top while a row is dragged.
 */
export function StackLink() {
  return (
    <div aria-hidden className="relative z-10 -my-1.25 flex h-10.5 flex-col items-center">
      <Port />
      <span className={cn(LINK_LINE, 'flex-1')} />
      <Port />
    </div>
  );
}

/**
 * Where an element sits inside `root`, from layout offsets rather than screen boxes: the canvas zoom doesn't scale
 * them, and a row gliding into place after a drop is already where it will end up.
 */
export function offsetWithin(element: HTMLElement, root: HTMLElement) {
  let top = 0;
  let left = 0;
  for (let node: Element | null = element; node instanceof HTMLElement && node !== root; node = node.offsetParent) {
    top += node.offsetTop;
    left += node.offsetLeft;
  }
  return { top, left };
}

interface Inlet {
  /** One line per chip, from its end to the card. */
  routes: { key: string; path: string; dimmed: boolean }[];
  port: Point;
  /** Every chip is dimmed, so the line into the card is too. */
  faded: boolean;
}

/**
 * Where a phase's rules land: a line leaves each chip marked `data-join`, the lines gather on a spine, and the spine
 * plugs into the left edge of the card marked `data-inlet-card`, level with its row marked `data-inlet-at`: the
 * phase's name, since rules put cards into the phase. Each chip's line runs all the way to the card, so a chip marked
 * `data-dimmed` fades only the part of the way no lit chip shares. It draws over the row it sits in, which must be
 * positioned, so it travels with a row being dragged.
 */
export function PhaseInlet() {
  const ref = useRef<HTMLSpanElement>(null);
  const [inlet, setInlet] = useState<Inlet>();

  // Every render: a row's rules change with the model, the draft or the row unfolding.
  useLayoutEffect(() => {
    const row = ref.current?.parentElement;
    if (!row) return;
    const measure = () => {
      const next = measureInlet(row);
      setInlet(current => (JSON.stringify(current) === JSON.stringify(next) ? current : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    for (const part of row.querySelectorAll('[data-rules-in], [data-inlet-card]')) observer.observe(part);
    return () => observer.disconnect();
  });

  return (
    <span ref={ref} aria-hidden className="pointer-events-none absolute inset-0">
      {inlet && (
        <>
          <svg className={cn(LINK_STROKE, 'absolute inset-0 size-full overflow-visible')}>
            {/* One faded layer under the lit lines, so the stretch faded lines share doesn't darken. */}
            <g opacity={0.35}>
              {inlet.routes.map(route => (
                <path key={route.key} d={route.path} />
              ))}
            </g>
            <g>
              {inlet.routes.map(route => (
                <path
                  key={route.key}
                  d={route.path}
                  className={cn('transition-opacity', route.dimmed && 'opacity-0')}
                />
              ))}
            </g>
          </svg>
          <span
            style={{ left: inlet.port.x - 5, top: inlet.port.y - 5 }}
            className={cn('absolute flex transition-opacity', inlet.faded && 'opacity-35')}
          >
            <Port />
          </span>
        </>
      )}
    </span>
  );
}

/** Room between the chips and the spine. */
const STUB = 12;
/** A chip's line this close to the port takes it, so a nearly straight line doesn't jog. */
const SNAP = 8;

function measureInlet(row: HTMLElement): Inlet | undefined {
  const card = row.querySelector('[data-inlet-card]');
  const name = card?.querySelector('[data-inlet-at]');
  const chips = [...row.querySelectorAll('[data-join]')].filter(chip => chip instanceof HTMLElement);
  if (!(card instanceof HTMLElement) || !(name instanceof HTMLElement) || chips.length === 0) return undefined;
  const stubs = chips.map(chip => {
    const at = offsetWithin(chip, row);
    return {
      x: at.left + chip.offsetWidth,
      y: at.top + Math.round(chip.offsetHeight / 2),
      dimmed: chip.hasAttribute('data-dimmed'),
    };
  });
  const level = offsetWithin(name, row).top + Math.round(name.offsetHeight / 2);
  const port = { x: offsetWithin(card, row).left, y: stubs.find(stub => Math.abs(stub.y - level) < SNAP)?.y ?? level };
  const spine = Math.max(...stubs.map(stub => stub.x)) + STUB;
  return {
    routes: stubs.map(stub => ({
      key: `${stub.x}:${stub.y}`,
      path: elbowPath([stub, { x: spine, y: stub.y }, { x: spine, y: port.y }, port]),
      dimmed: stub.dimmed,
    })),
    port,
    faded: stubs.every(stub => stub.dimmed),
  };
}
