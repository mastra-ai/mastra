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
        'grid min-h-10 grid-cols-[minmax(0,1fr)_auto_0fr] items-center border-t border-border px-2 py-1 text-meta text-muted-foreground',
        'transition-[grid-template-columns] duration-slow ease-out-custom motion-reduce:transition-none',
        state === 'collapsed' && 'grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] px-0',
        className,
      )}
      {...props}
    >
      <div
        aria-hidden={state === 'collapsed'}
        className={cn(
          'min-w-0 truncate transition-opacity duration-normal ease-out-custom motion-reduce:transition-none',
          state === 'collapsed' && 'opacity-0',
        )}
      >
        {children}
      </div>
      {action}
      <span aria-hidden />
    </div>
  );
});
