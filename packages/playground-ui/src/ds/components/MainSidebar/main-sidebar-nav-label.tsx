import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import type { ComponentPropsWithoutRef } from 'react';
import type { SidebarState } from './main-sidebar-context';
import { useMaybeSidebar } from './main-sidebar-context';
import { cn } from '@/lib/utils';

export type MainSidebarNavLabelProps = ComponentPropsWithoutRef<'span'> & {
  /** Override sidebar state. Defaults to context, then `'default'`. */
  state?: SidebarState;
};

/**
 * Label slot for `MainSidebar.NavLink` rows.
 *
 * Auto-hides via `VisuallyHidden` when the sidebar is collapsed (icon-only row),
 * so screen readers still announce the label without it leaking outside the
 * 36px collapsed item. Handles single-line truncation when expanded.
 *
 * Required for `asChild` consumers — the default `link={...}` path wraps the
 * name internally, but slotted elements (`<button>`, custom links) bring their
 * own children, so the label needs to opt into the collapse-aware rendering.
 */
export function MainSidebarNavLabel({ children, className, state: stateProp, ...rest }: MainSidebarNavLabelProps) {
  const ctx = useMaybeSidebar();
  const state: SidebarState = stateProp ?? ctx?.state ?? 'default';
  if (state === 'collapsed') {
    return <VisuallyHidden>{children}</VisuallyHidden>;
  }
  return (
    <span {...rest} className={cn('min-w-0 flex-1 truncate text-left', className)}>
      {children}
    </span>
  );
}
