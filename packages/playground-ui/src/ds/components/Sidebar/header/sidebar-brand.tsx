import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { useSidebar } from '../root/sidebar-context';
import { Txt } from '@/ds/components/Txt';
import { VisuallyHidden } from '@/ds/primitives/visually-hidden';
import { cn } from '@/lib/utils';

export type SidebarBrandProps = Omit<ComponentPropsWithoutRef<'div'>, 'title'> & {
  logo?: ReactNode;
  title: ReactNode;
};

export function SidebarBrand({ logo, title, className, ...props }: SidebarBrandProps) {
  const { state } = useSidebar();

  return (
    <div data-slot="sidebar-brand" className={cn('flex min-w-0 flex-1 items-center gap-2', className)} {...props}>
      {logo ? <span className="shrink-0">{logo}</span> : null}
      {state === 'collapsed' ? (
        <VisuallyHidden>{title}</VisuallyHidden>
      ) : (
        <Txt as="span" variant="subheading" tone="ink" className="truncate font-body tracking-tight">
          {title}
        </Txt>
      )}
    </div>
  );
}
