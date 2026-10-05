import type { ComponentPropsWithoutRef } from 'react';
import type { SidebarState } from '@/ds/components/MainSidebar/main-sidebar-context';
import { useMaybeSidebarState } from '@/ds/components/MainSidebar/main-sidebar-context';
import { VisuallyHidden } from '@/ds/primitives/visually-hidden';
import type { LinkComponent } from '@/ds/types/link-component';
import { cn } from '@/lib/utils';

export type SidebarNewNavHeaderProps = Omit<ComponentPropsWithoutRef<'header'>, 'children'> & {
  children?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  state?: SidebarState;
  href?: string;
  isActive?: boolean;
  LinkComponent?: LinkComponent;
};

export function SidebarNewNavHeader({
  children,
  icon,
  action,
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
    <div className={cn('flex min-w-0 items-center', showTitle ? 'mt-3 min-h-7' : 'h-10', className)}>
      {showTitle ? (
        <>
          <header
            {...props}
            className={cn(
              'flex min-w-0 flex-1 items-center gap-2 truncate pl-3 text-column [&_svg]:size-4 [&_svg]:shrink-0',
              {
                'text-foreground': isActive,
                'text-muted-foreground': !isActive,
              },
            )}
          >
            {icon}
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
              <span className="min-w-0 truncate">{children}</span>
            )}
          </header>
          {action}
        </>
      ) : (
        <>
          <VisuallyHidden asChild>
            <header {...props}>{children}</header>
          </VisuallyHidden>
          <div aria-hidden="true" className="mx-3 h-px flex-1 bg-border" />
        </>
      )}
    </div>
  );
}
