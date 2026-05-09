import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import type { ComponentPropsWithoutRef } from 'react';
import type { SidebarState } from './main-sidebar-context';
import { useMaybeSidebar } from './main-sidebar-context';
import { MainSidebarNavSeparator } from './main-sidebar-nav-separator';
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
  const Link: LinkComponent | 'a' = LinkProp ?? ctx?.LinkComponent ?? 'a';
  const isDefaultState = state === 'default';

  if (!isDefaultState) {
    return (
      <div className={cn('grid items-center min-h-11', className)}>
        {/* Keep `...props` on the slotted <header> so consumers' `id` reaches the
            DOM — `MainSidebarSections` uses it as the section's `aria-labelledby`. */}
        <VisuallyHidden asChild>
          <header {...props}>{children}</header>
        </VisuallyHidden>
        <MainSidebarNavSeparator />
      </div>
    );
  }

  return (
    <div className={cn('grid grid-cols-[auto_1fr] items-center gap-2 min-w-0 min-h-11', className)}>
      <header
        {...props}
        className={cn('min-w-0 max-w-full truncate text-ui-xs uppercase tracking-widest pl-3', {
          'text-black dark:text-white font-semibold': isActive,
          'text-neutral3/75': !isActive,
        })}
      >
        {href ? (
          <Link
            href={href}
            className={cn('block min-w-0 truncate transition-colors duration-normal', {
              'hover:text-neutral5': !isActive,
              'text-black dark:text-white': isActive,
            })}
          >
            {children}
          </Link>
        ) : (
          children
        )}
      </header>
      <MainSidebarNavSeparator />
    </div>
  );
}
