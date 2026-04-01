import * as RadixTabs from '@radix-ui/react-tabs';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export type TabListProps = {
  children: React.ReactNode;
  className?: string;
  alignment?: 'left' | 'full-width';
};

export const TabList = ({ children, alignment = 'left', className }: TabListProps) => {
  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <RadixTabs.List
        className={cn(
          'flex items-center relative w-max min-w-full',
          'text-ui-lg border-b border-border1',
          '[&>button]:py-2 [&>button]:px-6 [&>button]:font-normal [&>button]:text-neutral3 [&>button]:border-b-2 [&>button]:border-transparent',
          alignment === 'full-width' && '[&>button]:flex-1',
          `[&>button]:${transitions.colors} [&>button]:hover:text-neutral4`,
          '[&>button[data-state=active]]:text-neutral5 [&>button[data-state=active]]:border-black/50 [&>button[data-state=active]]:dark:border-white/50',
          className,
        )}
      >
        {children}
      </RadixTabs.List>
    </div>
  );
};
