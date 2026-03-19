import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import type {SidebarState} from './main-sidebar-context';
import { MainSidebarNavSeparator } from './main-sidebar-nav-separator';
import { cn } from '@/lib/utils';

export type MainSidebarNavHeaderProps = {
  children?: React.ReactNode;
  className?: string;
  state?: SidebarState;
};
export function MainSidebarNavHeader({ children, className, state = 'default' }: MainSidebarNavHeaderProps) {
  const isDefaultState = state === 'default';

  return (
    <div className={cn('grid grid-cols-[auto_1fr] items-center min-h-11', className)}>
      <header
        className={cn('text-ui-xs uppercase text-neutral3/75 tracking-widest', {
          'pl-3': isDefaultState,
        })}
      >
        {isDefaultState ? children : <VisuallyHidden>{children}</VisuallyHidden>}
      </header>
      <MainSidebarNavSeparator />
    </div>
  );
}
