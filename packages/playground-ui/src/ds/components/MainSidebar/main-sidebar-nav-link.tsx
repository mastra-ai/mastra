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
  size?: MainSidebarNavItemSize;
  render?: React.ReactElement<SlottedNavChildProps>;
  action?: React.ReactNode;
  LinkComponent?: LinkComponent;
  level?: number;
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

  const ctx = useMaybeSidebarState();
  const state: SidebarState = stateProp ?? ctx?.state ?? 'default';
  const Link: LinkComponent = LinkProp ?? ctx?.LinkComponent ?? 'a';
  const isCollapsed = state === 'collapsed';
  const isFeatured = link?.variant === 'featured';
  const level = levelProp ?? (link?.indent ? 1 : 0);
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

function navTooltipLabel(link: NavLink | undefined, isCollapsed: boolean) {
  if (!link) return undefined;
  if (link.tooltipMsg) return isCollapsed ? `${link.name} | ${link.tooltipMsg}` : link.tooltipMsg;
  return isCollapsed ? link.name : undefined;
}

function NavRowTooltip({ label, children }: { label?: string; children: React.ReactNode }) {
  if (!React.isValidElement(children)) return children;

  return (
    <Tooltip disabled={!label}>
      <TooltipTrigger render={children} />
      {label ? (
        <TooltipContent side="right" align="center" sideOffset={16}>
          {label}
        </TooltipContent>
      ) : null}
    </Tooltip>
  );
}

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
