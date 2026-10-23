import { ChevronRightIcon } from 'lucide-react';
import React from 'react';
import type { ComponentProps } from 'react';
import type { SidebarState } from '../root/sidebar-context';
import { useMaybeSidebarState } from '../root/sidebar-context';
import { navItemClasses, navItemLayoutClasses, navRowSurfaceClasses } from './sidebar-nav-item-classes';
import type { SidebarNavItemSize } from './sidebar-nav-item-classes';
import { SidebarNavLabel } from './sidebar-nav-label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import type { LinkComponent } from '@/ds/types/link-component';
import { cn } from '@/lib/utils';

export type SidebarLink = {
  name: string;
  url: string;
  icon?: React.ReactNode;
  children?: SidebarLink[];
  isActive?: boolean;
  variant?: 'default' | 'featured';
  tooltipMsg?: string;
  opensView?: boolean;
  /** @deprecated Prefer nested `children`; accepted for callers still rendering manual sublinks. */
  indent?: boolean;
};

export type SidebarNavLinkProps = Omit<ComponentProps<'li'>, 'children'> & {
  link?: SidebarLink;
  isActive?: boolean;
  state?: SidebarState;
  children?: React.ReactNode;
  size?: SidebarNavItemSize;
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
  children?: React.ReactNode;
  'aria-current'?: 'page';
};

export function SidebarNavLink({
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
}: SidebarNavLinkProps) {
  if (render && asChild) {
    throw new Error('SidebarNavLink accepts either `render` or `asChild`, not both.');
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
    : cn(navItemClasses({ isActive, isCollapsed, isFeatured, level, size }), link?.opensView && !isCollapsed && 'pr-1');

  return (
    <li {...props} className={cn('relative flex min-w-0 flex-col', className)}>
      <NavRowBody action={rowAction} surfaceClassName={navRowSurfaceClasses({ isActive, isFeatured })}>
        <NavRowTooltip label={navTooltipLabel(link, isCollapsed)}>
          {navInteractiveRow({ render, asChild, children, link, state, Link, isActive, className: itemClassName })}
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
  isActive,
  className,
}: {
  render?: React.ReactElement<SlottedNavChildProps>;
  asChild: boolean;
  children?: React.ReactNode;
  link?: SidebarLink;
  state: SidebarState;
  Link: LinkComponent;
  isActive?: boolean;
  className: string;
}) {
  // The current row is announced, not merely tinted: its fill is the only thing that says
  // "you are here", and a fill says nothing to a screen reader.
  const current = isActive ? ('page' as const) : undefined;
  const caret =
    link?.opensView && state !== 'collapsed' ? <ChevronRightIcon aria-hidden="true" className="!size-3.5" /> : null;

  if (render || asChild) {
    const slotted = render ?? children;
    if (!React.isValidElement<SlottedNavChildProps>(slotted)) {
      throw new Error(
        'SidebarNavLink requires a valid React element child when `asChild` is true so it can apply `SlottedNavChildProps` and merge `itemClassName`.',
      );
    }

    return React.cloneElement(slotted, {
      className: cn(className, slotted.props.className),
      'aria-current': current,
      children: (
        <>
          {slotted.props.children}
          {caret}
        </>
      ),
    });
  }

  if (!link) return children;

  const externalParams = /^(https?:)?\/\//.test(link.url) ? { target: '_blank', rel: 'noreferrer' } : {};

  return (
    <Link href={link.url} {...externalParams} aria-current={current} className={className}>
      {link.icon}
      <SidebarNavLabel state={state}>{link.name}</SidebarNavLabel>
      {children}
      {caret}
    </Link>
  );
}

function navTooltipLabel(link: SidebarLink | undefined, isCollapsed: boolean) {
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
