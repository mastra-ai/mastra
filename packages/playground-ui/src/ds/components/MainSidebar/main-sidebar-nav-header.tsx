import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import type { SidebarState } from './main-sidebar-context';
import { MainSidebarNavSeparator } from './main-sidebar-nav-separator';
import type { LinkComponent } from '@/ds/types/link-component';
import { cn } from '@/lib/utils';

export type MainSidebarNavHeaderProps = {
  children?: React.ReactNode;
  className?: string;
  state?: SidebarState;
  href?: string;
  isActive?: boolean;
  LinkComponent?: LinkComponent;
};
export function MainSidebarNavHeader({
  children,
  className,
  state = 'default',
  href,
  isActive,
  LinkComponent: Link,
}: MainSidebarNavHeaderProps) {
  const isDefaultState = state === 'default';

  const labelContent = isDefaultState ? children : <VisuallyHidden>{children}</VisuallyHidden>;

  return (
    <div className={cn('grid grid-cols-[auto_1fr] items-center min-h-11', className)}>
      <header
        className={cn('text-ui-xs uppercase tracking-widest', {
          'pl-3': isDefaultState,
          'text-black dark:text-white font-semibold': isActive,
          'text-neutral3/75': !isActive,
        })}
      >
        {href && isDefaultState && Link ? (
          <Link
            href={href}
            className={cn('transition-colors duration-normal', {
              'hover:text-neutral5': !isActive,
              'text-black dark:text-white': isActive,
            })}
          >
            {labelContent}
          </Link>
        ) : (
          labelContent
        )}
      </header>
      <MainSidebarNavSeparator />
    </div>
  );
}
