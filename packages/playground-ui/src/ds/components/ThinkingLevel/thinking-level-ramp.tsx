import { useRef, useState } from 'react';
import type { ChangeEvent, PointerEvent } from 'react';

import { ThinkingLevelBrain } from './thinking-level-brain';
import { useThinkingLevelStop, invisibleRangeInputClassName } from './use-thinking-level-stop';
import type { ThinkingLevelOption } from './use-thinking-level-stop';
import { ButtonLabel, buttonVariants } from '@/ds/components/Button/Button';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

export interface ThinkingLevelRampProps<T extends string> {
  options: readonly ThinkingLevelOption<T>[];
  /** Undefined while no level can be picked: the ramp keeps its size, with no pill and a disabled slider. */
  value: T | undefined;
  label: string;
  /** Pulses the track while the level loads. */
  loading?: boolean;
  /** Why no level can be picked, shown beside the label above the track. */
  unavailableReason?: string;
  /** A text button at the end of the label row, e.g. a way back to an inherited level. */
  reset?: { label: string; onClick: () => void };
  /** Returning the write lets the ramp hold the dropped stop until it lands. */
  onChange: (value: T) => void | Promise<unknown>;
}

/** How many plain cells the picked cell spans once it widens to fit its name. */
const PICKED_GROW = 3.4;
/** How far the pill leans toward a hovered level. */
const LEAN_PX = 6;

const settle = 'ease-out-custom motion-reduce:transition-none';

/** Leans the pill toward a hovered level, never when it rests on the pill itself. */
function leanToward(hoveredStop: number | undefined, shownStop: number) {
  if (hoveredStop === undefined || shownStop < 0 || hoveredStop === shownStop) return 0;
  return hoveredStop > shownStop ? LEAN_PX : -LEAN_PX;
}

/** The picked level reads strongest; levels already passed read brighter than the ones still ahead. */
function cellTone({
  stop,
  shownStop,
  warning,
  hovered,
  disabled,
}: {
  stop: number;
  shownStop: number;
  warning: boolean;
  hovered: boolean;
  disabled: boolean;
}) {
  if (stop === shownStop) return warning ? 'text-warning-foreground' : 'text-foreground';
  if (disabled) return 'text-muted-foreground/45';
  if (hovered) return 'text-foreground';
  return stop < shownStop ? 'text-foreground/55' : 'text-muted-foreground/45';
}

/**
 * One brain per level, filled to its depth. The picked level widens into a raised pill that
 * carries its name. When it moves, the leading edge leaves first and the trailing edge follows,
 * so the pill stretches across and settles; hovering another level leans the pill toward it.
 *
 * A hidden range input is the control for keyboard and assistive tech. Pointers land on the
 * cells instead, which are not evenly sized, and a drag only writes the level it ends on.
 */
export function ThinkingLevelRamp<T extends string>({
  options,
  value,
  label,
  loading,
  unavailableReason,
  reset,
  onChange,
}: ThinkingLevelRampProps<T>) {
  const { shownStop, shownOption, rangeInputProps, previewStop, commitOnRelease } = useThinkingLevelStop({
    options,
    value,
    onChange,
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [hoveredStop, setHoveredStop] = useState<number>();
  // Which way the pill last moved, so its leading edge leaves first. Set where a move starts; a
  // value arriving from outside (a reset, a load) keeps the last direction.
  const [forward, setForward] = useState(true);
  const moveTo = (stop: number) => {
    if (stop !== shownStop) setForward(stop > shownStop);
    previewStop(stop);
  };

  const disabled = value === undefined;
  const lastStop = Math.max(options.length - 1, 0);
  const picked = shownStop >= 0;
  const warning = shownOption?.emphasis === 'warning';
  const lean = leanToward(hoveredStop, shownStop);

  // Each plain cell is one unit, the picked one PICKED_GROW units, inside the track's 4px padding.
  const units = (cells: number) => `calc((100% - 8px) * ${cells / (lastStop + PICKED_GROW)} + 4px)`;
  // At either end the pill reaches past the track by the 3px it stands proud above and below,
  // so its cap wraps the track's cap instead of leaving a sliver of track beside it.
  const edge = (cells: number) => (cells === 0 ? '-3px' : units(cells));

  const stopAt = (clientX: number) => {
    const cells = trackRef.current?.querySelectorAll<HTMLElement>('[data-stop]') ?? [];
    let nearest: number | undefined;
    let nearestDistance = Infinity;
    for (const cell of cells) {
      const { left, right } = cell.getBoundingClientRect();
      const distance = Math.max(left - clientX, clientX - right, 0);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = Number(cell.dataset.stop);
      }
    }
    return nearest;
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || event.button !== 0) return;
    const stop = stopAt(event.clientX);
    if (stop === undefined) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragging.current = true;
    setHoveredStop(undefined);
    inputRef.current?.focus({ preventScroll: true });
    moveTo(stop);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    const stop = stopAt(event.clientX);
    if (dragging.current) {
      if (stop !== undefined) moveTo(stop);
    } else if (event.pointerType === 'mouse') {
      setHoveredStop(stop);
    }
  };

  const onPointerEnd = () => {
    if (!dragging.current) return;
    dragging.current = false;
    commitOnRelease();
  };

  return (
    <div className="flex flex-col gap-2" aria-busy={loading || undefined}>
      <div className="flex items-baseline justify-between gap-2">
        <Txt as="p" variant="caption" tone="muted" className="shrink-0">
          {label}
        </Txt>
        <div className="flex min-w-0 items-baseline gap-2">
          {disabled && unavailableReason ? (
            <Txt as="span" variant="caption" tone="muted" className="truncate" title={unavailableReason}>
              {unavailableReason}
            </Txt>
          ) : null}
          {reset ? (
            <button
              type="button"
              onClick={reset.onClick}
              className={cn(buttonVariants({ variant: 'link', size: 'sm' }), 'shrink-0')}
            >
              <ButtonLabel variant="link">{reset.label}</ButtonLabel>
            </button>
          ) : null}
        </div>
      </div>
      <div
        ref={trackRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onLostPointerCapture={onPointerEnd}
        onPointerLeave={() => setHoveredStop(undefined)}
        className={cn(
          'relative flex h-8 touch-pan-y rounded-full bg-fill p-1 select-none max-sm:h-10',
          !disabled && 'cursor-pointer',
          loading && 'motion-safe:animate-pulse motion-reduce:animate-none',
        )}
      >
        {picked ? (
          <span
            aria-hidden
            data-pill
            className={cn('absolute -inset-y-0.75 rounded-full bg-card shadow-raised transition-[left,right]', settle)}
            style={{
              left: `calc(${edge(shownStop)} + ${Math.min(lean, 0)}px)`,
              right: `calc(${edge(lastStop - shownStop)} - ${Math.max(lean, 0)}px)`,
              // The leading edge moves first and fast; the trailing edge waits a beat, then follows.
              transitionDuration: forward
                ? 'var(--duration-normal), var(--duration-slow)'
                : 'var(--duration-slow), var(--duration-normal)',
              transitionDelay: forward ? '50ms, 0ms' : '0ms, 50ms',
            }}
          />
        ) : null}
        {options.map((option, stop) => {
          const isPicked = stop === shownStop;
          return (
            <span
              key={option.value}
              aria-hidden
              data-stop={stop}
              data-picked={isPicked || undefined}
              className={cn(
                'relative flex min-w-0 basis-0 items-center justify-center transition-[flex-grow,color] duration-slow',
                settle,
                cellTone({ stop, shownStop, warning, hovered: hoveredStop === stop, disabled }),
              )}
              style={{ flexGrow: isPicked ? PICKED_GROW : 1 }}
            >
              <ThinkingLevelBrain
                fill={lastStop === 0 ? 1 : stop / lastStop}
                className={cn(
                  'transition-[scale] duration-fast',
                  settle,
                  !isPicked && hoveredStop === stop && 'scale-110',
                )}
              />
              <Txt
                as="span"
                variant="card-title-tight"
                className={cn(
                  'overflow-hidden whitespace-nowrap antialiased transition-[max-width,margin,opacity,filter] duration-slow',
                  settle,
                  isPicked ? 'ml-1.5 max-w-24 opacity-100 blur-none delay-75' : 'ml-0 max-w-0 opacity-0 blur-sm',
                )}
              >
                {option.label}
              </Txt>
            </span>
          );
        })}
        <input
          {...rangeInputProps}
          onChange={(event: ChangeEvent<HTMLInputElement>) => moveTo(Number(event.target.value))}
          ref={inputRef}
          aria-label={label}
          aria-valuetext={shownOption?.label ?? unavailableReason}
          disabled={disabled}
          className={cn('pointer-events-none absolute inset-0 size-full rounded-full', invisibleRangeInputClassName)}
        />
      </div>
    </div>
  );
}
