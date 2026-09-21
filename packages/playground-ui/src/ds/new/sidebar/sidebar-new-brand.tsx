import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { useMainSidebar } from '@/ds/components/MainSidebar/main-sidebar-context';
import { VisuallyHidden } from '@/ds/primitives/visually-hidden';
import { cn } from '@/lib/utils';

export type SidebarNewBrandProps = Omit<ComponentPropsWithoutRef<'div'>, 'title'> & {
  logo?: ReactNode;
  title: ReactNode;
};

export function SidebarNewBrand({ logo, title, className, ...props }: SidebarNewBrandProps) {
  const { state } = useMainSidebar();

  return (
    <div data-slot="sidebar-new-brand" className={cn('flex min-w-0 flex-1 items-center gap-2', className)} {...props}>
      {logo ? <span className="shrink-0">{logo}</span> : null}
      {state === 'collapsed' ? (
        <VisuallyHidden>{title}</VisuallyHidden>
      ) : (
        <span className="text-subheading text-foreground truncate font-sans tracking-tight">{title}</span>
      )}
    </div>
  );
}
