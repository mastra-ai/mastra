/* eslint-disable react-refresh/only-export-components -- highlight component ships its pure helpers for the unit test */
'use client';

import { motion, AnimatePresence, useReducedMotion, type Transition } from 'framer-motion';
import type { ItemRect, UseFluidHoverReturn } from '@/hooks/use-fluid-hover';
import { spring } from '@/lib/springs';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// The one hover highlight every fluid hover list renders: an absolutely
// positioned fill that springs between the rects `useFluidHover` measures.
// Consumers used to hand-roll this motion.div; this is that block, once.
//
//   const hover = useFluidHover(ref);
//   <FluidHoverHighlight hover={hover} className={shape.bg} />
//
// It owns no layout opinion beyond `absolute`: radius, z-index, and the
// offsetParent (the container must be `relative`) are the consumer's.
// ---------------------------------------------------------------------------

/** What the highlight reads off the hook: the highlighted index, the
 *  measured rects, whether they are current, and the pointer session. */
export type FluidHoverSource = Pick<UseFluidHoverReturn, 'activeIndex' | 'itemRects' | 'isMeasured' | 'sessionRef'>;

interface HighlightFromHook {
  /** The hook's return value. The highlight sits on
   *  `itemRects[activeIndex]` once `isMeasured`, and re-keys on the session. */
  hover: FluidHoverSource;
  /** Keep the list's state but show nothing (a closed popup, hover switched
   *  off). Runs the exit fade. */
  hidden?: boolean;
  rect?: never;
  session?: never;
}

interface HighlightFromRect {
  /** For lists that resolve their own rect (the sidebar's unified scope):
   *  the rect to sit on, in the container's coordinate space. `null` hides
   *  the highlight (it fades out on `spring.fast.exit`). */
  rect: ItemRect | null;
  /** `sessionRef.current` from `useFluidHover`. It increments when the
   *  cursor enters the container, which re-keys the highlight so it fades in
   *  at `from ?? rect` instead of sliding over from wherever it was last. */
  session: number;
  hover?: never;
  hidden?: never;
}

export type FluidHoverHighlightProps = (HighlightFromHook | HighlightFromRect) & {
  /** Where a fresh session fades in from. A dropdown passes its checked row,
   *  a nav menu its active route. Defaults to the rect itself. */
  from?: ItemRect | null;
  /** Radius, z-index, anything else. Merged onto
   *  `absolute bg-hover pointer-events-none`. */
  className?: string;
  /** The positional spring. Defaults to `spring.fast`. Pass `false` to snap
   *  to the new rect with no travel (a layout reflow that moved the rows
   *  underneath, not a hover change). The opacity fade is always 0.08s. */
  transition?: Transition | false;
};

const fade: Transition = { duration: 0.08 };
const snap: Transition = { duration: 0 };

/** A measured rect as animation targets: position as a transform, size as
 *  layout. Exported for the unit test. */
export function toTarget(rect: ItemRect) {
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
}

/**
 * Resolves the positional transition. Reduced motion keeps the opacity fade
 * and drops the travel, per the motion guidelines: fewer and gentler, not
 * none. Exported for the unit test.
 */
export function resolveHighlightTransition(
  transition: Transition | false | undefined,
  reduceMotion: boolean,
): Transition {
  const positional = transition === false || reduceMotion ? snap : (transition ?? spring.fast);
  return { ...positional, opacity: fade };
}

/** The rect and session a set of props resolves to. Exported for the test. */
export function resolveHighlightSource(props: FluidHoverHighlightProps): { rect: ItemRect | null; session: number } {
  if (props.hover) {
    const { activeIndex, itemRects, isMeasured, sessionRef } = props.hover;
    const rect = !props.hidden && isMeasured && activeIndex !== null ? (itemRects[activeIndex] ?? null) : null;
    return { rect, session: sessionRef.current };
  }
  return { rect: props.rect, session: props.session };
}

export function FluidHoverHighlight(props: FluidHoverHighlightProps) {
  const { from, className, transition } = props;
  const { rect, session } = resolveHighlightSource(props);
  // Reads the OS media query directly, so an installed copy honours reduced
  // motion without the app wrapping its tree in MotionConfig. A wrapped app
  // gets the same result twice over: the travel is a transform, which
  // MotionConfig reduces too.
  const reduceMotion = useReducedMotion() ?? false;
  return (
    <AnimatePresence>
      {rect && (
        <motion.div
          key={session}
          data-slot="fluid-hover-highlight"
          // Pinned to the container's padding corner and moved with a
          // transform, so the travel runs on the compositor instead of
          // re-laying out every frame. Width and height are real layout
          // values, but they only change when the target rect's size does,
          // which in most lists is never.
          className={cn('bg-hover pointer-events-none absolute top-0 left-0', className)}
          initial={{ opacity: 0, ...toTarget(from ?? rect) }}
          animate={{ opacity: 1, ...toTarget(rect) }}
          exit={{ opacity: 0, transition: spring.fast.exit }}
          transition={resolveHighlightTransition(transition, reduceMotion)}
        />
      )}
    </AnimatePresence>
  );
}
