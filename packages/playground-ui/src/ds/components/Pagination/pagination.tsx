import { useRender } from '@base-ui/react/use-render';
import { ChevronLeft, ChevronRight, Ellipsis } from 'lucide-react';
import { cloneElement, isValidElement } from 'react';
import type { ComponentProps, MouseEvent, ReactElement } from 'react';
import { Icon } from '@/ds/icons/Icon';
import { controlSizeClasses } from '@/ds/primitives/control-size';
import { raisedControlSurfaceStyle } from '@/ds/primitives/form-element';
import { focusRing } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

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

export type PaginationContentProps = ComponentProps<'ul'>;

export function PaginationContent({ className, ...props }: PaginationContentProps) {
  return <ul data-slot="pagination-content" className={cn('flex items-center gap-1', className)} {...props} />;
}

export type PaginationItemProps = ComponentProps<'li'>;

export function PaginationItem(props: PaginationItemProps) {
  return <li data-slot="pagination-item" {...props} />;
}

const paginationLinkClass = cn(
  controlSizeClasses.sm,
  focusRing,
  'relative inline-flex min-w-control-sm cursor-pointer items-center justify-center gap-1 rounded-full px-2.5 text-muted-foreground tabular-nums',
  'aria-disabled:cursor-not-allowed aria-disabled:text-placeholder',
);

// The current page wears the raised control surface, which carries its own hover tint.
const paginationLinkStateClass = {
  idle: 'not-aria-disabled:hover:bg-fill-subtle not-aria-disabled:hover:text-foreground',
  current: raisedControlSurfaceStyle,
};

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
  return useRender({
    defaultTagName: 'button',
    render: linkRender(render, disabled),
    props: {
      ...elementProps(render, disabled),
      ...props,
      ...activationProps(disabled, onClick),
      'data-slot': 'pagination-link',
      'aria-current': isActive && 'page',
      className: cn(paginationLinkClass, paginationLinkStateClass[isActive ? 'current' : 'idle'], className),
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
