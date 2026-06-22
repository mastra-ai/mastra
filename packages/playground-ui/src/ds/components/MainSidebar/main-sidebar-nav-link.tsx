import React from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import type { SidebarState } from './main-sidebar-context';
import { useMaybeSidebar } from './main-sidebar-context';
import { navItemClasses } from './main-sidebar-nav-item-classes';
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
  /** @deprecated Sidebar nav items now render flush; this option is accepted but ignored. */
  indent?: boolean;
};

export type MainSidebarNavLinkProps = Omit<ComponentPropsWithoutRef<'li'>, 'children'> & {
  link?: NavLink;
  isActive?: boolean;
  state?: SidebarState;
  children?: React.ReactNode;
  /** Override the Provider-level LinkComponent for this row. Defaults to `<a>` when neither is set. */
  LinkComponent?: LinkComponent;
  /**
   * When true, render `children` as the interactive element.
   * Use for `<button>` items or custom router Links. Item classes are forwarded
   * to the slotted element. `link.url` and `LinkComponent` are ignored; other
   * `link` presentation fields still apply when supplied.
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
    <li {...props} className={cn('flex relative min-w-0', className)}>
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
    </li>
  );
}
