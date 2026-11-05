import React from 'react';

import { Icon } from '../../icons/Icon';
import { Skeleton } from '@/ds/components/Skeleton';
import { controlSizeClasses } from '@/ds/primitives/control-size';
import { PopupAnchorProvider } from '@/ds/primitives/popup-anchor';
import { controlStateColorTransition } from '@/ds/primitives/transitions';
import { quietTextHover, quietTextHoverInGroup } from '@/ds/primitives/typography';
import { cn } from '@/lib/utils';

export interface BreadcrumbProps {
  children?: React.ReactNode;
  label?: string;
  className?: string;
  listClassName?: string;
}

export const Breadcrumb = ({ children, label, className, listClassName }: BreadcrumbProps) => {
  return (
    // 4px of padding, cancelled by the margin, keeps focus rings inside a caller's `overflow-hidden`.
    <nav aria-label={label} className={cn('-m-1 p-1', className)}>
      <ol className={cn('flex items-center', listClassName)}>{children}</ol>
    </nav>
  );
};

const CrumbSeparatorIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M6.3 4.6L9.7 8L6.3 11.4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export interface CrumbProps {
  isCurrent?: boolean;
  as: React.ElementType;
  className?: string;
  to?: string;
  prefetch?: boolean | null;
  children?: React.ReactNode;
  /** Prefix icon (bare SVG). The crumb wraps it in `<Icon>` and draws every icon set at one size. */
  icon?: React.ReactNode;
  /** Renders `CrumbSkeleton` in place of the label. */
  isLoading?: boolean;
  /**
   * Sibling control rendered next to the label (never inside it), e.g. a CopyButton or text.
   * Icon controls use `size="icon-inline"`. Entity switchers go in `switcher`.
   */
  action?: React.ReactNode;
  /**
   * Entity switcher rendered next to the label; spread `crumbSwitcherTriggerProps` on it.
   * When the crumb doesn't navigate (current crumb, or no `to`), its hit area covers the whole crumb.
   */
  switcher?: React.ReactNode;
  /** For a crumb that navigates in place (`as="button"`) rather than through a route. */
  onClick?: React.MouseEventHandler;
  'data-testid'?: string;
}

export const CrumbSkeleton = (props: { 'data-testid'?: string }) => <Skeleton className="h-3 w-24" {...props} />;

/** The label's color, hover and width, by what clicking it does. */
function crumbLabelStateClass({
  isCurrent,
  switcherCoversCrumb,
}: {
  isCurrent?: boolean;
  switcherCoversCrumb: boolean;
}) {
  // Long labels truncate: the current crumb gets more room than nav crumbs.
  if (isCurrent) return 'max-w-xs cursor-default text-foreground';
  if (switcherCoversCrumb) return cn(quietTextHoverInGroup, 'max-w-48');
  return cn(quietTextHover, 'max-w-48 cursor-pointer hover:bg-fill-subtle active:bg-fill');
}

export const Crumb = ({
  className,
  as,
  to,
  isCurrent,
  action,
  switcher,
  icon,
  isLoading,
  children,
  ...props
}: CrumbProps) => {
  const Root = as || 'span';
  const switcherCoversCrumb = Boolean(switcher && (isCurrent || !to));
  const hasControl = Boolean(switcher || action);
  const crumbRef = React.useRef<HTMLLIElement>(null);

  return (
    <>
      <li
        ref={crumbRef}
        className={cn(
          'group flex h-control-sm min-w-0 items-center',
          isCurrent ? 'shrink' : 'shrink-0',
          // Controls (icon-inline) take their glyph's 14px slot; 4px here plus the glyph's own
          // inset keeps the crumb's end where a plain label's 8px padding would put it.
          hasControl && 'pr-1',
          switcherCoversCrumb &&
            'relative rounded-full has-[[data-slot=crumb-switcher]_[data-popup-open]]:bg-fill-subtle has-[[data-slot=crumb-switcher]_button:enabled]:hover:bg-fill-subtle has-[[data-slot=crumb-switcher]_button:enabled]:active:bg-fill',
        )}
      >
        <Root
          aria-current={isCurrent ? 'page' : undefined}
          className={cn(
            // Same height, radius and colors as a ghost `sm` Button. Left and right padding are
            // separate utilities, so an app that compiles Tailwind after ours can't reorder them.
            'inline-flex min-w-0 items-center gap-2 overflow-hidden rounded-full pl-2',
            hasControl ? 'pr-0' : 'pr-2',
            // The first crumb's text stays .9em in from the header edge.
            '[li:first-child>&]:ml-[calc(.9em-var(--spacing)*2)]',
            controlSizeClasses.sm,
            controlStateColorTransition,
            crumbLabelStateClass({ isCurrent, switcherCoversCrumb }),
            className,
          )}
          to={to}
          {...props}
        >
          {icon && (
            <Icon
              className={cn(
                'flex size-[13px] shrink-0 items-center justify-center opacity-50 group-hover:opacity-100',
                // Only the first crumb's icon tucks into the padding (keeping the header's left edge);
                // after a separator it keeps the full gap, like text.
                '[li:first-child_&]:ml-[-.3em]',
                'transition-opacity duration-normal ease-out-custom',
                // One 13px glyph across icon sets: Mastra's icons are cropped to the glyph, while
                // Lucide's 24-grid leaves 2px a side, so it draws 24/20 larger.
                '[&>svg.lucide]:size-[15.6px] [&>svg.lucide]:shrink-0 [&>svg:not(.lucide)]:size-[13px]',
              )}
            >
              {icon}
            </Icon>
          )}
          {isLoading ? (
            <CrumbSkeleton />
          ) : (
            // `text-overflow` needs a block container, so the label truncates in its
            // own box rather than on the flex Root. Works for plain strings and for
            // components that resolve to a string (route-header `Component` crumbs).
            <span className="min-w-0 flex-1 truncate">{children}</span>
          )}
        </Root>
        {switcher && (
          <span
            data-slot="crumb-switcher"
            className={cn(
              'flex h-control-sm shrink-0 items-center',
              // The whole crumb is one target, so the crumb hovers instead of the circle. Beside a
              // link the switcher is its own target; 2px more keeps its circle off the text.
              switcherCoversCrumb
                ? 'ml-1 [&_button]:bg-transparent! [&_button:enabled]:after:absolute [&_button:enabled]:after:inset-0 [&_button:enabled]:after:rounded-full'
                : 'ml-1.5',
            )}
          >
            {/* The switcher's popup opens from the crumb's start, like a menu on the whole crumb. */}
            <PopupAnchorProvider value={crumbRef}>{switcher}</PopupAnchorProvider>
          </span>
        )}
        {action && <span className="ml-1.5 flex h-control-sm shrink-0 items-center">{action}</span>}
      </li>
      {!isCurrent && (
        // A 5px box (the chevron's ink) with 6px margins: 14px from the ink to each neighbor.
        <li role="separator" className="mx-1.5 flex h-full w-[5px] items-center justify-center overflow-visible">
          <Icon className="shrink-0 text-placeholder opacity-70">
            <CrumbSeparatorIcon />
          </Icon>
        </li>
      )}
    </>
  );
};
