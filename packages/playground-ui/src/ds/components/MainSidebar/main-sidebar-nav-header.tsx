import type { ComponentPropsWithoutRef } from 'react';
import type { SidebarState } from './main-sidebar-context';
import { useMaybeSidebar } from './main-sidebar-context';
import { VisuallyHidden } from '@/ds/primitives/visually-hidden';
import type { LinkComponent } from '@/ds/types/link-component';
import { cn } from '@/lib/utils';

export type MainSidebarNavHeaderProps = Omit<ComponentPropsWithoutRef<'header'>, 'children'> & {
  children?: React.ReactNode;
  state?: SidebarState;
  href?: string;
  isActive?: boolean;
  /** Override the Provider-level LinkComponent. Defaults to `<a>` when neither is set. */
  LinkComponent?: LinkComponent;
};
export function MainSidebarNavHeader({
  children,
  className,
  state: stateProp,
  href,
  isActive,
  LinkComponent: LinkProp,
  ...props
}: MainSidebarNavHeaderProps) {
  const ctx = useMaybeSidebar();
  const state: SidebarState = stateProp ?? ctx?.state ?? 'default';
  const isMobile = ctx?.isMobile ?? false;
  const Link: LinkComponent = LinkProp ?? ctx?.LinkComponent ?? 'a';
  const showTitle = state === 'default' && !isMobile;

  return (
    <div className={cn('min-w-0 min-h-8 flex items-center mt-2 mb-0.5', className)}>
      {showTitle ? (
        <header
          {...props}
          className={cn('min-w-0 max-w-full truncate text-ui-sm font-medium pl-3', {
            'text-neutral5': isActive,
            'text-neutral3/70': !isActive,
          })}
        >
          {href ? (
            <Link
              href={href}
              className={cn('block min-w-0 truncate transition-colors duration-normal', {
                'hover:text-neutral5': !isActive,
                'text-neutral5': isActive,
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
          {/* Keep header in DOM (visually hidden) so consumers' `id` still resolves
              for `MainSidebarSections`' `aria-labelledby`. */}
          <VisuallyHidden asChild>
            <header {...props}>{children}</header>
          </VisuallyHidden>
          <div aria-hidden="true" className="mx-3 h-px flex-1 bg-border1" />
        </>
      )}
    </div>
  );
}
