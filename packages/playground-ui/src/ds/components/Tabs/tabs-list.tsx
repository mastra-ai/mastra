import * as RadixTabs from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

export type TabListProps = {
  children: React.ReactNode;
  className?: string;
};

export const TabList = ({ children, className }: TabListProps) => {
  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <RadixTabs.List
        className={cn('flex items-center relative w-max min-w-full', 'text-ui-lg border-b border-border1', className)}
      >
        {children}
      </RadixTabs.List>
    </div>
  );
};
