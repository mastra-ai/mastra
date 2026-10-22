import { useRender } from '@base-ui/react/use-render';
import { ChevronLeft, ChevronRight, Ellipsis } from 'lucide-react';
import { cloneElement, isValidElement, useMemo, useRef, useState } from 'react';
import type { ComponentProps, MouseEvent, ReactElement } from 'react';
import { FluidHoverHighlight } from '../../../components/fluid-hover-highlight';
import { useFluidHover } from '../../../hooks/use-fluid-hover';
import { cn } from '../../../lib/utils';
import { Icon } from '../../icons/Icon';
import { controlSizeClasses } from '../../primitives/control-size';
import { raisedControlSurfaceStyle } from '../../primitives/form-element';
import { controlStateColorTransition, focusRing } from '../../primitives/transitions';
import { PaginationContext, usePaginationItemRef } from './pagination-context';
import type { PaginationContextValue } from './pagination-context';

export type PaginationProps = ComponentProps<'nav'>;

export function Pagination({ className, 'aria-label': ariaLabel = 'Pagination', ...props }: PaginationProps) {
  return (
    <nav
      data-slot="pagination"
      aria-label={ariaLabel}
      className={cn('flex items-center justify-center', className)}
      {...props}
    />
  );
}

const isInert = (element: HTMLElement) => element.getAttribute('aria-disabled') === 'true';

export type PaginationContentProps = ComponentProps<'ul'>;

export function PaginationContent({ className, ...props }: PaginationContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hover = useFluidHover(containerRef, { axis: 'x', isItemDisabled: isInert, gapClick: false });
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const counterRef = useRef(0);
  const freeRef = useRef<number[]>([]);
  const { registerItem } = hover;
  const context = useMemo<PaginationContextValue>(
    () => ({
      registerItem,
      allocateIndex: () => freeRef.current.pop() ?? counterRef.current++,
      releaseIndex: index => {
        freeRef.current.push(index);
      },
      setCurrentIndex,
    }),
    [registerItem],
  );
  const currentIndicator = { ...hover, activeIndex: currentIndex };

  return (
    <PaginationContext value={context}>
      <div ref={containerRef} {...hover.handlers} className="relative isolate">
        <FluidHoverHighlight hover={hover} className="-z-2 rounded-full bg-fill-subtle" />
        <FluidHoverHighlight hover={currentIndicator} className={cn('-z-1 rounded-full', raisedControlSurfaceStyle)} />
        <ul data-slot="pagination-content" className={cn('flex items-center gap-1', className)} {...props} />
      </div>
    </PaginationContext>
  );
}

export type PaginationItemProps = ComponentProps<'li'>;

export function PaginationItem(props: PaginationItemProps) {
  return <li data-slot="pagination-item" {...props} />;
}

const paginationLinkClass = cn(
  controlSizeClasses.sm,
  controlStateColorTransition,
  focusRing,
  'relative inline-flex min-w-control-sm cursor-pointer items-center justify-center gap-1 rounded-full px-2.5 text-muted-foreground tabular-nums',
  'hover:text-foreground aria-[current=page]:text-foreground',
  'aria-disabled:cursor-not-allowed aria-disabled:text-placeholder aria-disabled:hover:text-placeholder',
);

export type PaginationLinkProps = useRender.ComponentProps<'button'> & {
  isActive?: boolean;
  disabled?: boolean;
};

type LinkRender = PaginationLinkProps['render'];

function preventActivation(event: MouseEvent<HTMLElement>) {
  event.preventDefault();
}

function isAnchorElement(render: LinkRender): render is ReactElement<ComponentProps<'a'>> {
  return isValidElement(render) && render.type === 'a';
}

function linkRender(render: LinkRender, disabled: boolean | undefined) {
  if (disabled && isAnchorElement(render)) return cloneElement(render, { href: undefined });
  return render;
}

function elementProps(render: LinkRender, disabled: boolean | undefined) {
  if (render === undefined) return { type: 'button' as const };
  if (disabled && isAnchorElement(render)) return { role: 'link', tabIndex: 0 };
  return {};
}

function activationProps(disabled: boolean | undefined, onClick: PaginationLinkProps['onClick']) {
  if (disabled) return { 'aria-disabled': true, onClick: preventActivation, onAuxClick: preventActivation };
  return { onClick };
}

export function PaginationLink({ isActive, disabled, render, className, onClick, ...props }: PaginationLinkProps) {
  const ref = usePaginationItemRef();
  return useRender({
    defaultTagName: 'button',
    render: linkRender(render, disabled),
    ref,
    props: {
      ...elementProps(render, disabled),
      ...props,
      ...activationProps(disabled, onClick),
      'data-slot': 'pagination-link',
      'aria-current': isActive && 'page',
      className: cn(paginationLinkClass, className),
    },
  });
}

export type PaginationPreviousProps = PaginationLinkProps & { text?: string };

export function PaginationPrevious({ text = 'Previous', ...props }: PaginationPreviousProps) {
  return (
    <PaginationLink {...props}>
      <Icon size="sm" aria-hidden>
        <ChevronLeft />
      </Icon>
      {text}
    </PaginationLink>
  );
}

export type PaginationNextProps = PaginationLinkProps & { text?: string };

export function PaginationNext({ text = 'Next', ...props }: PaginationNextProps) {
  return (
    <PaginationLink {...props}>
      {text}
      <Icon size="sm" aria-hidden>
        <ChevronRight />
      </Icon>
    </PaginationLink>
  );
}

export type PaginationEllipsisProps = ComponentProps<'span'>;

export function PaginationEllipsis({ className, ...props }: PaginationEllipsisProps) {
  return (
    <span
      data-slot="pagination-ellipsis"
      className={cn('flex w-control-sm items-center justify-center text-muted-foreground', className)}
      {...props}
    >
      <Icon size="sm" aria-hidden>
        <Ellipsis />
      </Icon>
      <span className="sr-only">More pages</span>
    </span>
  );
}
