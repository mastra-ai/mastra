import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import type { SidebarState } from './main-sidebar-context';
import { MainSidebarNavSeparator } from './main-sidebar-nav-separator';
import { useLinkComponent } from '@/lib/framework';
import { cn } from '@/lib/utils';

export type MainSidebarNavHeaderProps = {
  children?: React.ReactNode;
  className?: string;
  state?: SidebarState;
  href?: string;
  isActive?: boolean;
};
export function MainSidebarNavHeader({ children, className, state = 'default', href, isActive }: MainSidebarNavHeaderProps) {
  const isDefaultState = state === 'default';
  const { Link } = useLinkComponent();

  const labelContent = isDefaultState ? children : <VisuallyHidden>{children}</VisuallyHidden>;

  return (
    <div className={cn('grid grid-cols-[auto_1fr] items-center min-h-11', className)}>
      <header
        className={cn('text-ui-xs uppercase tracking-widest', {
          'pl-3': isDefaultState,
          'text-accent1 font-semibold': isActive,
          'text-neutral3/75': !isActive,
        })}
      >
        {href && isDefaultState ? (
          <Link
            href={href}
            className={cn('transition-colors duration-normal', {
              'hover:text-neutral5': !isActive,
              'text-accent1': isActive,
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
