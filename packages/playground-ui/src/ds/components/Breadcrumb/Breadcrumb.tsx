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

/**
 * To truncate a long trail, pass `overflow-clip` (not `overflow-hidden`): the nav keeps a 4px clip
 * margin so the crumbs' focus rings aren't cut off at the top and bottom.
 */
export const Breadcrumb = ({ children, label, className, listClassName }: BreadcrumbProps) => {
  return (
    <nav aria-label={label} className={cn('[overflow-clip-margin:4px]', className)}>
      <ol className={cn('flex items-center', listClassName)}>{children}</ol>
    </nav>
  );
};

/** Chevron between crumbs; same 16px grid and stroke as `ChevronIcon`. */
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
  /** Prefix icon (bare SVG). The crumb wraps it in `<Icon>` and aligns it like a Button adornment. */
  icon?: React.ReactNode;
  /** Renders `CrumbSkeleton` in place of the label. */
  isLoading?: boolean;
  /**
   * Sibling control rendered next to the label (never inside it). Expected to be a
   * `size="icon-sm"` ghost control, e.g. a CopyButton. Entity switchers go in `switcher`.
   */
  action?: React.ReactNode;
  /**
   * Entity switcher rendered next to the label; spread `crumbSwitcherTriggerProps` on it.
   * When the crumb doesn't navigate (current crumb, or no `to`), its hit area covers the whole crumb.
   */
  switcher?: React.ReactNode;
  'data-testid'?: string;
}

export const CrumbSkeleton = (props: { 'data-testid'?: string }) => <Skeleton className="h-3 w-24" {...props} />;

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
  // A navigating crumb with a switcher has two targets (the name, the icon), so only the icon gets
  // a hover background: two pills side by side would read as one lumpy shape.
  const switcherBesideLink = Boolean(switcher && !switcherCoversCrumb);
  const crumbRef = React.useRef<HTMLLIElement>(null);

  return (
    <>
      <li
        ref={crumbRef}
        className={cn(
          'group flex h-control-sm min-w-0 items-center',
          isCurrent ? 'shrink' : 'shrink-0',
          // The crumb ends 8px after the switcher glyph, as it does after a plain label.
          switcher && 'pr-2',
          switcherCoversCrumb &&
            'relative rounded-full has-[[data-slot=crumb-switcher]_[data-popup-open]]:bg-fill-subtle has-[[data-slot=crumb-switcher]_button:enabled]:hover:bg-fill-subtle has-[[data-slot=crumb-switcher]_button:enabled]:active:bg-fill',
        )}
      >
        <Root
          aria-current={isCurrent ? 'page' : undefined}
          className={cn(
            // Same box as `buttonVariants({ variant: 'ghost', size: 'sm' })` so a label and an
            // icon-sm control sitting next to it share height, radius, padding and colors.
            'inline-flex min-w-0 items-center gap-2 overflow-hidden rounded-full px-2',
            // The first crumb's text stays .9em in from the header edge (the old pill padding).
            '[li:first-child>&]:ml-[calc(.9em-var(--spacing)*2)]',
            controlSizeClasses.sm,
            controlStateColorTransition,
            // The switcher glyph follows the text directly; its own margin sets the gap.
            switcher && 'pr-0',
            // Long labels truncate: the current crumb gets more room than nav crumbs.
            isCurrent
              ? 'max-w-xs cursor-default text-foreground'
              : switcherCoversCrumb
                ? cn(quietTextHoverInGroup, 'max-w-48')
                : switcherBesideLink
                  ? cn(quietTextHover, 'max-w-48 cursor-pointer')
                  : cn(quietTextHover, 'max-w-48 cursor-pointer hover:bg-fill-subtle active:bg-fill'),
            className,
          )}
          to={to}
          {...props}
        >
          {icon && (
            <Icon
              className={cn(
                'ml-[-.3em] shrink-0 opacity-50 group-hover:opacity-100',
                'transition-opacity duration-normal ease-out-custom',
                // One 13px glyph for every icon set: Mastra's icons are cropped to their glyph and
                // fill the box, while Lucide's 24-grid leaves 2px a side, so it draws 24/20 larger.
                'flex size-[13px] items-center justify-center',
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
              // The trigger is trimmed to its 14px glyph's ink (~7px) so the gaps on both sides
              // are exact; the glyph overflows the box, centered.
              '[&_button]:w-[7px] [&_button]:min-w-0 [&_button]:overflow-visible [&_button]:bg-transparent! [&_button]:p-0',
              '[&_button_svg]:m-0 [&_button_svg]:size-3.5 [&_button_svg]:shrink-0',
              switcherCoversCrumb &&
                'ml-2 [&_button:enabled]:after:absolute [&_button:enabled]:after:inset-0 [&_button:enabled]:after:rounded-full',
              // Beside a link, a 20px circle behind the glyph; 2px more gap keeps it off the text.
              switcherBesideLink &&
                cn(
                  'ml-2.5 [&_button]:relative [&_button]:isolate',
                  '[&_button]:before:absolute [&_button]:before:top-1/2 [&_button]:before:left-1/2 [&_button]:before:-z-10',
                  '[&_button]:before:size-5 [&_button]:before:-translate-x-1/2 [&_button]:before:-translate-y-1/2 [&_button]:before:rounded-full',
                  '[&_button]:before:transition-colors [&_button]:before:duration-normal [&_button]:before:ease-out-custom',
                  '[&_button:enabled:hover]:before:bg-fill-subtle [&_button[data-popup-open]]:before:bg-fill-subtle',
                ),
            )}
          >
            {/* The switcher's popup opens from the crumb's start, like a menu on the whole crumb. */}
            <PopupAnchorProvider value={crumbRef}>{switcher}</PopupAnchorProvider>
          </span>
        )}
        {action && <span className="-ml-1 flex h-control-sm shrink-0 items-center">{action}</span>}
      </li>
      {!isCurrent && (
        // The box is trimmed to the chevron's ink, so the 14px gap on each side (6px margin plus
        // the crumb's 8px padding) is exact; the icon overflows it, centered.
        <li role="separator" className="mx-1.5 flex h-full w-[5px] items-center justify-center overflow-visible">
          <Icon className="shrink-0 text-placeholder opacity-70">
            <CrumbSeparatorIcon />
          </Icon>
        </li>
      )}
    </>
  );
};
