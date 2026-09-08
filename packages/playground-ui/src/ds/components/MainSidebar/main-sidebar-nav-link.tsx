import React from 'react';
import type { ComponentProps } from 'react';
import type { SidebarState } from './main-sidebar-context';
import { useMaybeSidebarState } from './main-sidebar-context';
import { navItemClasses, navItemLayoutClasses, navRowSurfaceClasses } from './main-sidebar-nav-item-classes';
import type { MainSidebarNavItemSize } from './main-sidebar-nav-item-classes';
import { MainSidebarNavLabel } from './main-sidebar-nav-label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import type { LinkComponent } from '@/ds/types/link-component';
import { cn } from '@/lib/utils';

export type NavLink = {
  name: string;
  url: string;
  icon?: React.ReactNode;
  children?: NavLink[];
  isActive?: boolean;
  variant?: 'default' | 'featured';
  tooltipMsg?: string;
  /** @deprecated Prefer nested `children`; accepted for callers still rendering manual sublinks. */
  indent?: boolean;
};

export type MainSidebarNavLinkProps = Omit<ComponentProps<'li'>, 'children'> & {
  link?: NavLink;
  isActive?: boolean;
  state?: SidebarState;
  children?: React.ReactNode;
  /** Visual density for the interactive row. */
  size?: MainSidebarNavItemSize;
  /** Typed custom interactive element. Sidebar item classes are merged into its `className`. */
  render?: React.ReactElement<SlottedNavChildProps>;
  /** Optional trailing control rendered beside, never inside, the interactive row. */
  action?: React.ReactNode;
  /** Override the Provider-level LinkComponent for this row. Defaults to `<a>` when neither is set. */
  LinkComponent?: LinkComponent;
  /** Nesting depth for manually composed subitems. Data-driven sections set this automatically. */
  level?: number;
  /** Nested list rendered below the row while keeping valid `<li><a /><ul /></li>` structure. */
  subItems?: React.ReactNode;
  /**
   * When true, render `children` as the interactive element.
   * Use for `<button>` items or custom router Links. Item classes are forwarded
   * to the slotted element. `link.url` and `LinkComponent` are ignored; other
   * `link` presentation fields still apply when supplied.
   *
   * @deprecated Prefer typed render composition for new APIs; this legacy
   * slotted prop will be migrated separately.
   */
  asChild?: boolean;
};

type SlottedNavChildProps = {
  className?: string;
};

export function MainSidebarNavLink({
  link,
  state: stateProp,
  children,
  isActive,
  size,
  render,
  action,
  className,
  LinkComponent: LinkProp,
  level: levelProp,
  subItems,
  asChild = false,
  ...props
}: MainSidebarNavLinkProps) {
  if (render && asChild) {
    throw new Error('MainSidebarNavLink accepts either `render` or `asChild`, not both.');
  }

  // Auto-inherit state + LinkComponent from context; explicit props still win.
  const ctx = useMaybeSidebarState();
  const state: SidebarState = stateProp ?? ctx?.state ?? 'default';
  const Link: LinkComponent = LinkProp ?? ctx?.LinkComponent ?? 'a';
  const isCollapsed = state === 'collapsed';
  const isFeatured = link?.variant === 'featured';
  const level = levelProp ?? (link?.indent ? 1 : 0);
  // A collapsed rail has no room for a trailing control, so the action is dropped there.
  const rowAction = isCollapsed ? undefined : action;

  const itemClassName = rowAction
    ? cn(navItemLayoutClasses({ level, size }), 'flex-1 pr-1')
    : navItemClasses({ isActive, isCollapsed, isFeatured, level, size });

  return (
    <li {...props} className={cn('relative flex min-w-0 flex-col', className)}>
      <NavRowBody action={rowAction} surfaceClassName={navRowSurfaceClasses({ isActive, isFeatured })}>
        <NavRowTooltip label={navTooltipLabel(link, isCollapsed)}>
          {navInteractiveRow({ render, asChild, children, link, state, Link, className: itemClassName })}
        </NavRowTooltip>
      </NavRowBody>
      {!isCollapsed && subItems}
    </li>
  );
}

/**
 * Builds the element the row is interactive through. It is slotted into
 * `Tooltip`'s `render`, so it must be an element value, not a component.
 */
function navInteractiveRow({
  render,
  asChild,
  children,
  link,
  state,
  Link,
  className,
}: {
  render?: React.ReactElement<SlottedNavChildProps>;
  asChild: boolean;
  children?: React.ReactNode;
  link?: NavLink;
  state: SidebarState;
  Link: LinkComponent;
  className: string;
}) {
  if (render) return React.cloneElement(render, { className: cn(className, render.props.className) });

  if (asChild) {
    if (!React.isValidElement<SlottedNavChildProps>(children)) {
      throw new Error(
        'MainSidebarNavLink requires a valid React element child when `asChild` is true so it can apply `SlottedNavChildProps` and merge `itemClassName`.',
      );
    }

    return React.cloneElement(children, { className: cn(className, children.props.className) });
  }

  if (!link) return children;

  const externalParams = /^(https?:)?\/\//.test(link.url) ? { target: '_blank', rel: 'noreferrer' } : {};

  return (
    <Link href={link.url} {...externalParams} className={className}>
      {link.icon}
      <MainSidebarNavLabel state={state}>{link.name}</MainSidebarNavLabel>
      {children}
    </Link>
  );
}

/** A collapsed rail hides the label, so the row names itself through a tooltip. */
function navTooltipLabel(link: NavLink | undefined, isCollapsed: boolean) {
  if (!link) return undefined;
  if (link.tooltipMsg) return isCollapsed ? `${link.name} | ${link.tooltipMsg}` : link.tooltipMsg;
  return isCollapsed ? link.name : undefined;
}

function NavRowTooltip({ label, children }: { label?: string; children: React.ReactNode }) {
  if (!label || !React.isValidElement(children)) return children;

  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side="right" align="center" sideOffset={16}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Pairs the interactive row with its trailing action. The pair carries the row
 * surface so hover and active paint the whole box, action included, and the
 * action stays in flow instead of floating over the label.
 */
function NavRowBody({
  action,
  surfaceClassName,
  children,
}: {
  action?: React.ReactNode;
  surfaceClassName: string;
  children: React.ReactNode;
}) {
  if (!action) return children;

  return (
    <div className={cn('flex min-w-0 items-center pr-1', surfaceClassName)}>
      {children}
      {action}
    </div>
  );
}
