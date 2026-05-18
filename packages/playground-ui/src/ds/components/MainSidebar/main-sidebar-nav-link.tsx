import { Slot } from '@radix-ui/react-slot';
import { CircleAlertIcon } from 'lucide-react';
import type { ComponentPropsWithoutRef } from 'react';
import type { SidebarState } from './main-sidebar-context';
import { useMaybeSidebar } from './main-sidebar-context';
import { MainSidebarNavLabel } from './main-sidebar-nav-label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import type { LinkComponent } from '@/ds/types/link-component';
import { cn } from '@/lib/utils';

export type NavLink = {
  name: string;
  url: string;
  icon?: React.ReactNode;
  isActive?: boolean;
  variant?: 'default' | 'featured';
  tooltipMsg?: string;
  isExperimental?: boolean;
  /** @deprecated Sidebar nav items now render flush; this option is accepted but ignored. */
  indent?: boolean;
};

type ItemStyleOptions = {
  isActive?: boolean;
  isCollapsed?: boolean;
  isFeatured?: boolean;
};

/**
 * Shared classes for any sidebar nav row element (anchor, button, custom).
 * Apply directly to the interactive element so `asChild` and custom slotted
 * elements (e.g. router Links) all receive the same styling without relying
 * on `[&>a]:` child selectors.
 */
export const navItemClasses = ({ isActive, isCollapsed, isFeatured }: ItemStyleOptions = {}) =>
  cn(
    'flex items-center text-ui-md text-neutral3 rounded-lg h-9 min-w-0 whitespace-nowrap',
    'transition-all duration-normal ease-out-custom motion-reduce:transition-none',
    '[&_svg]:w-4 [&_svg]:h-4 [&_svg]:shrink-0 [&_svg]:text-neutral3/70 [&_svg]:transition-colors [&_svg]:duration-normal motion-reduce:[&_svg]:transition-none',
    'hover:bg-sidebar-nav-hover hover:text-neutral6 [&:hover_svg]:text-neutral5',
    'focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-accent1 focus-visible:shadow-focus-ring',
    !isCollapsed && 'w-full gap-2.5 py-1 px-3 justify-start',
    isCollapsed && 'w-9 mx-auto p-0 justify-center',
    isActive &&
      'text-neutral6 bg-sidebar-nav-active hover:bg-sidebar-nav-active hover:text-neutral6 [&_svg]:text-neutral6 [&:hover_svg]:text-neutral6',
    isCollapsed && !isActive && '[&_svg]:text-neutral3',
    isFeatured && 'my-2 bg-accent1Dark hover:bg-accent1Darker text-accent1 hover:text-accent1 border border-accent1/30',
    isFeatured &&
      'dark:bg-accent1 dark:hover:bg-accent1/90 dark:text-black dark:hover:text-black dark:border-transparent',
    isFeatured &&
      '[&_svg]:text-accent1 [&:hover_svg]:text-accent1 dark:[&_svg]:text-black/75 dark:[&:hover_svg]:text-black',
  );

export type MainSidebarNavLinkProps = Omit<ComponentPropsWithoutRef<'li'>, 'children'> & {
  link?: NavLink;
  isActive?: boolean;
  state?: SidebarState;
  children?: React.ReactNode;
  /** Override the Provider-level LinkComponent for this row. Defaults to `<a>` when neither is set. */
  LinkComponent?: LinkComponent;
  /**
   * When true, render `children` as the interactive element (Radix Slot pattern).
   * Use for `<button>` items or custom router Links. Item classes are forwarded
   * to the slotted element. `link` and `LinkComponent` are ignored.
   */
  asChild?: boolean;
};

export function MainSidebarNavLink({
  link,
  state: stateProp,
  children,
  isActive,
  className,
  LinkComponent: LinkProp,
  asChild = false,
  ...props
}: MainSidebarNavLinkProps) {
  // Auto-inherit state + LinkComponent from context; explicit props still win.
  const ctx = useMaybeSidebar();
  const state: SidebarState = stateProp ?? ctx?.state ?? 'default';
  const Link: LinkComponent | 'a' = LinkProp ?? ctx?.LinkComponent ?? 'a';
  const isCollapsed = state === 'collapsed';
  const isFeatured = link?.variant === 'featured';
  const isExternal = Boolean(link?.url && /^(https?:)?\/\//.test(link.url));
  const linkParams = isExternal ? { target: '_blank', rel: 'noreferrer' } : {};
  const needsTooltip = link ? isCollapsed || Boolean(link.tooltipMsg) : false;

  const itemClassName = navItemClasses({
    isActive,
    isCollapsed,
    isFeatured,
  });

  let interactiveEl: React.ReactNode = null;

  if (asChild) {
    // Slot merges itemClassName onto the consumer-provided element (button, a, custom).
    interactiveEl = <Slot className={itemClassName}>{children}</Slot>;
  } else if (link) {
    interactiveEl = (
      <Link href={link.url} {...linkParams} className={itemClassName}>
        {link.icon}
        <MainSidebarNavLabel state={state}>{link.name}</MainSidebarNavLabel>
        {children}
        {link.isExperimental && !isCollapsed && !needsTooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <CircleAlertIcon className="ml-auto stroke-accent5" />
            </TooltipTrigger>
            <TooltipContent side="right" align="center" className="ml-4">
              Experimental Feature
            </TooltipContent>
          </Tooltip>
        )}
      </Link>
    );
  }

  return (
    <li {...props} className={cn('flex relative min-w-0', className)}>
      {link && needsTooltip && interactiveEl ? (
        <Tooltip>
          <TooltipTrigger asChild>{interactiveEl}</TooltipTrigger>
          <TooltipContent side="right" align="center" className="ml-4">
            {link.tooltipMsg ? (isCollapsed ? `${link.name} | ${link.tooltipMsg}` : link.tooltipMsg) : link.name}
          </TooltipContent>
        </Tooltip>
      ) : (
        (interactiveEl ?? children)
      )}
    </li>
  );
}
