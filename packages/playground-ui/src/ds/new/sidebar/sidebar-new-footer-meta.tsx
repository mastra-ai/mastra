import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { useMainSidebar } from '@/ds/components/MainSidebar/main-sidebar-context';
import { cn } from '@/lib/utils';

export type SidebarNewFooterMetaProps = ComponentPropsWithoutRef<'div'> & {
  action?: ReactNode;
};

export const SidebarNewFooterMeta = forwardRef<HTMLDivElement, SidebarNewFooterMetaProps>(function SidebarNewFooterMeta(
  { className, children, action, ...props },
  ref,
) {
  const { state } = useMainSidebar();

  return (
    <div
      ref={ref}
      data-slot="sidebar-new-footer-meta"
      data-state={state}
      className={cn(
        'flex min-h-10 items-center border-t border-sidebar-divider px-2 py-1 text-ui-xs text-muted-foreground',
        state === 'collapsed' && 'justify-center px-0',
        className,
      )}
      {...props}
    >
      {state === 'collapsed' ? null : <div className="min-w-0 flex-1 truncate">{children}</div>}
      {action}
    </div>
  );
});
