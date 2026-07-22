import React from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import type { SidebarState } from './main-sidebar-context';
import { useMaybeSidebar } from './main-sidebar-context';
import { navItemClasses } from './main-sidebar-nav-item-classes';
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

export type MainSidebarNavLinkProps = Omit<ComponentPropsWithoutRef<'li'>, 'children'> & {
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
  // Auto-inherit state + LinkComponent from context; explicit props still win.
  const ctx = useMaybeSidebar();
  const state: SidebarState = stateProp ?? ctx?.state ?? 'default';
  const Link: LinkComponent = LinkProp ?? ctx?.LinkComponent ?? 'a';
  const isCollapsed = state === 'collapsed';
  const isFeatured = link?.variant === 'featured';
  const level = levelProp ?? (link?.indent ? 1 : 0);
  const isExternal = Boolean(link?.url && /^(https?:)?\/\//.test(link.url));
  const linkParams = isExternal ? { target: '_blank', rel: 'noreferrer' } : {};
  const needsTooltip = link ? isCollapsed || Boolean(link.tooltipMsg) : false;

  const itemClassName = cn(
    navItemClasses({
      isActive,
      isCollapsed,
      isFeatured,
      level,
      size,
    }),
    action && !isCollapsed && 'pr-10',
  );

  let interactiveEl: React.ReactNode = null;

  if (render && asChild) {
    throw new Error('MainSidebarNavLink accepts either `render` or `asChild`, not both.');
  }

  if (render) {
    interactiveEl = React.cloneElement(render, {
      className: cn(itemClassName, render.props.className),
    });
  } else if (asChild) {
    if (!React.isValidElement<SlottedNavChildProps>(children)) {
      throw new Error(
        'MainSidebarNavLink requires a valid React element child when `asChild` is true so it can apply `SlottedNavChildProps` and merge `itemClassName`.',
      );
    }

    interactiveEl = React.cloneElement(children, {
      className: cn(itemClassName, children.props.className),
    });
  } else if (link) {
    interactiveEl = (
      <Link href={link.url} {...linkParams} className={itemClassName}>
        {link.icon}
        <MainSidebarNavLabel state={state}>{link.name}</MainSidebarNavLabel>
        {children}
      </Link>
    );
  }

  return (
    <li {...props} className={cn('relative flex min-w-0 flex-col', className)}>
      {link && needsTooltip && React.isValidElement(interactiveEl) ? (
        <Tooltip>
          <TooltipTrigger render={interactiveEl} />
          <TooltipContent side="right" align="center" sideOffset={16}>
            {link.tooltipMsg ? (isCollapsed ? `${link.name} | ${link.tooltipMsg}` : link.tooltipMsg) : link.name}
          </TooltipContent>
        </Tooltip>
      ) : (
        (interactiveEl ?? children)
      )}
      {!isCollapsed && action}
      {!isCollapsed && subItems}
    </li>
  );
}
