import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import type { ComponentPropsWithoutRef } from 'react';
import type { SidebarState } from './main-sidebar-context';
import { useMaybeSidebar } from './main-sidebar-context';
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
      <VisuallyHidden asChild>
        {/* Keep `...props` on the slotted <header> so consumers' `id` reaches the
            DOM — `MainSidebarSections` uses it as the section's `aria-labelledby`. */}
        <header {...props}>{children}</header>
      </VisuallyHidden>
    );
  }

  return (
    <div className={cn('min-w-0 min-h-8 flex items-center mt-2 mb-0.5', className)}>
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
    </div>
  );
}
