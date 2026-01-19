import { cn } from '@/lib/utils';
import * as RadixTabs from '@radix-ui/react-tabs';
import { transitions } from '@/ds/primitives/transitions';

export type TabListProps = {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'buttons';
};

export const TabList = ({ children, variant = 'default', className }: TabListProps) => {
  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <RadixTabs.List
        className={cn(
          'flex items-center relative',
          {
            // variant: default
            'text-ui-lg': variant === 'default',
            '[&>button]:py-2 [&>button]:px-6 [&>button]:font-normal [&>button]:text-neutral3 [&>button]:flex-1 [&>button]:border-b [&>button]:border-border1':
              variant === 'default',
            [`[&>button]:${transitions.colors} [&>button]:hover:text-neutral4`]: variant === 'default',
            '[&>button[data-state=active]]:text-neutral5 [&>button[data-state=active]]:border-accent1':
              variant === 'default',
            // variant: buttons
            'border border-border1 flex justify-stretch rounded-md overflow-hidden text-ui-md min-h-[2.5rem]':
              variant === 'buttons',
            [`[&>button]:flex-1 [&>button]:py-2 [&>button]:px-4 [&>button]:text-neutral3 [&>button]:${transitions.all}`]:
              variant === 'buttons',
            '[&>button]:hover:text-neutral4 [&>button]:hover:bg-surface3': variant === 'buttons',
            '[&>button[data-state=active]]:text-neutral5 [&>button[data-state=active]]:bg-surface4 [&>button[data-state=active]]:shadow-inner':
              variant === 'buttons',
          },
          className,
        )}
      >
        {children}
      </RadixTabs.List>
    </div>
  );
};
