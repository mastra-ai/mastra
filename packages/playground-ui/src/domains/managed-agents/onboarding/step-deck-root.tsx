import { Children, isValidElement, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import type { StepDeckStepProps } from './step-deck-step';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

export interface StepDeckProps {
  children: ReactElement<StepDeckStepProps> | ReactElement<StepDeckStepProps>[];
  current: number;
  label?: string;
  actions?: ReactNode;
}

const PEEK = [0, 40, 56];

function cardHeight(active: boolean, ownHeight: number | undefined, currentHeight: number | undefined) {
  if (currentHeight === undefined) return undefined;
  if (active) return ownHeight;
  return currentHeight;
}

function placement(offset: number) {
  if (offset < 0) return { transform: 'translateY(-24px) scale(0.98)', opacity: 0, filter: 'none', zIndex: 0 };
  if (offset === 0) return { transform: 'none', opacity: 1, filter: 'none', zIndex: 30 };
  if (offset <= 2) {
    return {
      transform: `translateY(${PEEK[offset]}px) scale(${1 - offset * 0.03})`,
      opacity: 1,
      filter: `brightness(var(--deck-dim-${offset}))`,
      zIndex: 30 - offset,
    };
  }
  return {
    transform: `translateY(${PEEK[2]}px) scale(0.94)`,
    opacity: 0,
    filter: 'brightness(var(--deck-dim-2))',
    zIndex: 0,
  };
}

export function StepDeckRoot({ children, current, label = 'Steps', actions }: StepDeckProps) {
  const steps = Children.toArray(children).filter(isValidElement<StepDeckStepProps>);
  const bodies = useRef<Array<HTMLDivElement | undefined>>([]);
  const headings = useRef<Array<HTMLHeadingElement | undefined>>([]);
  const [heights, setHeights] = useState<number[]>([]);
  const firstRender = useRef(true);
  const stepKeys = steps.map(step => step.key).join(' ');

  useLayoutEffect(() => {
    // offsetHeight ignores the scale on queued cards, so a card does not keep its shrunken height once active.
    const observer = new ResizeObserver(() => setHeights(bodies.current.map(body => body?.offsetHeight ?? 0)));
    for (const body of bodies.current) if (body) observer.observe(body);
    return () => observer.disconnect();
  }, [stepKeys]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headings.current[current]?.focus({ preventScroll: true });
  }, [current]);

  const currentHeight = heights[current];
  const peeks = Math.min(2, steps.length - 1 - current);

  return (
    <section
      aria-label={label}
      className="relative transition-[height] duration-slow ease-in-out-custom [--deck-dim-1:0.97] [--deck-dim-2:0.94] motion-reduce:transition-none dark:[--deck-dim-1:0.8] dark:[--deck-dim-2:0.62]"
      style={{ height: currentHeight === undefined ? undefined : currentHeight + (PEEK[peeks] ?? 0) }}
    >
      {steps.map((step, index) => {
        const offset = index - current;
        const active = offset === 0;
        const leaving = offset < 0;
        return (
          <div
            key={step.key}
            data-surface="card"
            inert={!active || undefined}
            aria-hidden={!active || undefined}
            data-offset={offset}
            className={cn(
              'inset-x-0 top-0 origin-bottom overflow-hidden rounded-card bg-card shadow-[inset_0_0_0_1px_var(--surface-rim)]',
              'transition-[transform,opacity,height,filter] motion-reduce:transition-none',
              leaving ? 'duration-normal ease-out-custom' : 'duration-slow ease-out-custom',
              currentHeight === undefined && active ? 'relative' : 'absolute',
            )}
            style={{
              ...placement(offset),
              height: cardHeight(active, heights[index], currentHeight),
            }}
          >
            <div
              ref={node => {
                bodies.current[index] = node ?? undefined;
              }}
              className={cn(
                'flex flex-col gap-5 p-6 transition-opacity duration-normal motion-reduce:transition-none',
                !active && 'opacity-0',
              )}
            >
              <div className="flex items-baseline justify-between gap-3">
                <Txt
                  as="h2"
                  variant="card-title"
                  tone="ink"
                  tabIndex={-1}
                  ref={(node: HTMLHeadingElement | null) => {
                    headings.current[index] = node ?? undefined;
                  }}
                  className="outline-none"
                >
                  {step.props.title}
                </Txt>
                <Txt as="span" variant="caption" tone="muted" className="shrink-0 tabular-nums @4xl:hidden">
                  Step {index + 1} of {steps.length}
                </Txt>
              </div>
              {step}
              {actions ? <div className="flex items-center justify-end gap-2">{actions}</div> : null}
            </div>
            {offset === 1 ? (
              <Txt
                as="span"
                variant="body-sm"
                tone="muted"
                className="absolute inset-x-6 bottom-0 flex h-10 items-center"
              >
                Next: {step.props.title}
              </Txt>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
