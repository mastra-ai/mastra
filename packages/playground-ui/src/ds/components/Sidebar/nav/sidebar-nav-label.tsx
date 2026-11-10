import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import type { SidebarState } from '../root/sidebar-context';
import { useMaybeSidebarState } from '../root/sidebar-context';
import { VisuallyHidden } from '@/ds/primitives/visually-hidden';
import { cn } from '@/lib/utils';

export type SidebarNavLabelProps = ComponentPropsWithoutRef<'span'> & {
  /** Override sidebar state. Defaults to context, then `'default'`. */
  state?: SidebarState;
  /**
   * Secondary line under the label (time, counts, small icons). Pair with
   * `Sidebar.NavLink size="two-line"` so the row grows to hold it. Hidden when
   * the sidebar is collapsed.
   */
  description?: ReactNode;
};

/**
 * Label slot for `Sidebar.NavLink` rows.
 *
 * Auto-hides via `VisuallyHidden` when the sidebar is collapsed (icon-only row),
 * so screen readers still announce the label without it leaking outside the
 * 28px collapsed item. Handles single-line truncation when expanded.
 *
 * Required for custom `render` and legacy `asChild` consumers — the default
 * `link={...}` path wraps the name internally, but custom elements bring their
 * own children, so the label needs to opt into the collapse-aware rendering.
 */
export function SidebarNavLabel({ children, className, description, state: stateProp, ...rest }: SidebarNavLabelProps) {
  const ctx = useMaybeSidebarState();
  const state: SidebarState = stateProp ?? ctx?.state ?? 'default';
  if (state === 'collapsed') {
    return <VisuallyHidden>{children}</VisuallyHidden>;
  }
  if (description !== undefined) {
    return (
      <span {...rest} className={cn('flex min-w-0 flex-1 flex-col text-left', className)}>
        <span className="truncate">{children}</span>
        {/* The row sizes every descendant svg to 16px at equal specificity, so the
            description's glyphs need `!` to sit at the meta line's 12px. */}
        <span className="flex min-w-0 items-center gap-1.5 truncate text-meta text-muted-foreground [&_svg]:size-3!">
          {description}
        </span>
      </span>
    );
  }
  return (
    <span {...rest} className={cn('min-w-0 flex-1 truncate text-left', className)}>
      {children}
    </span>
  );
}
