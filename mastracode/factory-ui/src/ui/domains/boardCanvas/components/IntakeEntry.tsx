import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconArrowInbox } from '@mastra/playground-ui/icons/central/IconArrowInbox';
import { IconArrowUpRight } from '@mastra/playground-ui/icons/central/IconArrowUpRight';
import { raisedSurfaceStyle } from '@mastra/playground-ui/primitives/raised-surface';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useLayoutEffect, useState } from 'react';
import type { RefObject } from 'react';
import { Link } from 'react-router';

import type { IntakeOrderResponse } from '../../../../api/types';
import { boardIntakePath, INTAKE_ORDER_ANCHOR } from '../../boardConfig/boardConfigPaths';
import { intakeSentence } from '../canvasModel';
import { elbowPath, LINK_STROKE, offsetWithin, Port } from './FlowLinks';

/** The intake lines fade out while a phase is dragged: they would point at where the rows stood. */
const FADE =
  'duration-normal ease-out-custom transition-opacity motion-reduce:transition-none group-data-dragging/flow:opacity-0';

/** The intake card's box, shared with the canvas skeleton so a loading board holds the same shape. */
export const INTAKE_CARD = 'relative mb-8 flex w-89.5 flex-col gap-1 rounded-2xl px-3.25 pt-2.75 pb-3 max-sm:w-full';

/**
 * Where new issues and pull requests come onto the board: where it stands in the intake order, and a port the
 * intake line leaves from when a trigger on the board takes them.
 */
export function IntakeEntry({
  factoryId,
  boardId,
  order,
  linked,
}: {
  factoryId: string;
  boardId: string;
  order: IntakeOrderResponse | undefined;
  linked: boolean;
}) {
  return (
    <section data-intake-start="" aria-labelledby="canvas-intake" className={cn(raisedSurfaceStyle, INTAKE_CARD)}>
      <div className="flex min-h-5.5 items-center gap-2">
        <IconArrowInbox className="text-muted-foreground size-icon-sm shrink-0" aria-hidden />
        <Txt as="h2" id="canvas-intake" variant="card-title-strong" tone="ink" className="min-w-0 flex-1 truncate">
          New issues and pull requests
        </Txt>
        <Link
          to={boardIntakePath(factoryId, boardId, { anchor: INTAKE_ORDER_ANCHOR })}
          className={cn(
            'text-caption text-muted-foreground hover:text-foreground flex shrink-0 items-center gap-1 rounded-sm',
            focusRing,
          )}
        >
          Reorder
          <IconArrowUpRight className="size-icon-xs" aria-hidden />
        </Link>
      </div>
      {order && (
        <Txt variant="caption" tone="muted" className="pl-6 text-pretty">
          {intakeSentence(order.boards, order.evaluator, boardId)}
        </Txt>
      )}
      {linked && <Port className={cn('absolute -bottom-1.25 left-3.75', FADE)} />}
    </section>
  );
}

/**
 * Where the intake line plugs into a trigger new items arrive on, marked `data-intake-branch` only when they reach it.
 * The bus draws the line up to its port.
 */
export function IntakeBranch({ linked }: { linked: boolean }) {
  return (
    <span
      aria-hidden
      data-intake-branch={linked ? '' : undefined}
      className={cn('-mr-1 flex min-w-2.5 flex-1 items-center justify-end max-sm:hidden', FADE, !linked && 'opacity-0')}
    >
      <Port />
    </span>
  );
}

/**
 * The intake line: down the left edge from the entry's port, out to every trigger it plugs into, rounding the corner
 * into the lowest one.
 */
export function IntakeBus({ flow }: { flow: RefObject<HTMLElement | null> }) {
  const [paths, setPaths] = useState<string[]>();

  // Every render: a row's rules change with the model, the draft order or a row unfolding.
  useLayoutEffect(() => {
    const root = flow.current;
    if (!root) return;
    const measure = () => {
      const next = measureBus(root);
      setPaths(current => (current?.join() === next?.join() ? current : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    for (const rules of root.querySelectorAll('[data-rules-in]')) observer.observe(rules);
    return () => observer.disconnect();
  });

  if (!paths) return null;
  return (
    <svg
      aria-hidden
      className={cn(LINK_STROKE, 'pointer-events-none absolute inset-0 size-full overflow-visible', FADE)}
    >
      {paths.map(path => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}

/** The bus leaves the rim of the entry's port and stops at the rim of every trigger's, so no line runs through a port. */
function measureBus(root: HTMLElement) {
  const start = root.querySelector('[data-intake-start] [data-port]');
  const ports = [...root.querySelectorAll('[data-intake-branch] [data-port]')].filter(
    port => port instanceof HTMLElement,
  );
  if (!(start instanceof HTMLElement) || ports.length === 0) return undefined;
  const from = offsetWithin(start, root);
  const x = from.left + start.offsetWidth / 2;
  const top = from.top + start.offsetHeight;
  const branches = ports.map(port => {
    const at = offsetWithin(port, root);
    return { y: at.top + port.offsetHeight / 2, to: at.left };
  });
  const lowest = Math.max(...branches.map(branch => branch.y));
  return branches.map(branch =>
    elbowPath([...(branch.y === lowest ? [{ x, y: top }] : []), { x, y: branch.y }, { x: branch.to, y: branch.y }]),
  );
}
