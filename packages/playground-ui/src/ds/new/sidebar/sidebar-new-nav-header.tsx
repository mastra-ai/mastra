import type { ComponentPropsWithoutRef } from 'react';
import type { SidebarState } from '@/ds/components/MainSidebar/main-sidebar-context';
import { useMaybeSidebarState } from '@/ds/components/MainSidebar/main-sidebar-context';
import { VisuallyHidden } from '@/ds/primitives/visually-hidden';
import type { LinkComponent } from '@/ds/types/link-component';
import { cn } from '@/lib/utils';

export type SidebarNewNavHeaderProps = Omit<ComponentPropsWithoutRef<'header'>, 'children'> & {
  children?: React.ReactNode;
  state?: SidebarState;
  href?: string;
  isActive?: boolean;
  LinkComponent?: LinkComponent;
};

export function SidebarNewNavHeader({
  children,
  className,
  state: stateProp,
  href,
  isActive,
  LinkComponent: LinkProp,
  ...props
}: SidebarNewNavHeaderProps) {
  const context = useMaybeSidebarState();
  const state = stateProp ?? context?.state ?? 'default';
  const showTitle = state === 'default';
  const Link = LinkProp ?? context?.LinkComponent ?? 'a';

  return (
    <div className={cn('mt-1 flex min-h-7 min-w-0 items-center', className)}>
      {showTitle ? (
        <header
          {...props}
          className={cn('max-w-full min-w-0 truncate pl-3 text-column', {
            'text-foreground': isActive,
            'text-muted-foreground': !isActive,
          })}
        >
          {href ? (
            <Link
              href={href}
              className={cn('block min-w-0 truncate transition-colors duration-normal', {
                'hover:text-foreground': !isActive,
                'text-foreground': isActive,
              })}
            >
              {children}
            </Link>
          ) : (
            children
          )}
        </header>
      ) : (
        <>
          <VisuallyHidden asChild>
            <header {...props}>{children}</header>
          </VisuallyHidden>
          <div aria-hidden="true" className="bg-border mx-3 h-px flex-1" />
        </>
      )}
    </div>
  );
}
