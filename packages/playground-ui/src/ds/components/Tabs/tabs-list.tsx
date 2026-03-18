import { cn } from '@/lib/utils';
import * as RadixTabs from '@radix-ui/react-tabs';

export type TabListProps = {
  children: React.ReactNode;
  alignment?: 'left' | 'full-width';
  className?: string;
};

export const TabList = ({ children, alignment = 'left', className }: TabListProps) => {
  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <RadixTabs.List
        className={cn(
          'flex items-center relative text-ui-lg gap-6 border-b border-surface5',
          alignment === 'full-width' && '[&>button]:flex-1',
          className,
        )}
      >
        {children}
      </RadixTabs.List>
    </div>
  );
};
