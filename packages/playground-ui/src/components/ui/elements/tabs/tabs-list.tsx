import { cn } from '@/lib/utils';
import * as RadixTabs from '@radix-ui/react-tabs';

type TabListProps = {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'buttons';
};

export const TabList = ({ children, variant = 'default', className }: TabListProps) => {
  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <RadixTabs.List
        className={cn(
          'flex items-center',
          {
            // variant: default
            'text-[0.9375rem]': variant === 'default',
            '[&>button]:py-[0.5rem] [&>button]:px-[1.5rem] [&>button]:font-normal [&>button]:text-icon3 [&>button]:flex-1 [&>button]:border-b [&>button]:border-border1':
              variant === 'default',
            '[&>button[data-state=active]]:text-icon5 [&>button[data-state=active]]:transition-colors [&>button[data-state=active]]:duration-200 [&>button[data-state=active]]:border-icon3':
              variant === 'default',
            // variant: buttons
            'border border-border1 flex justify-stretch rounded-md overflow-hidden text-[0.875rem] min-h-[2.5rem]':
              variant === 'buttons',
            '[&>button]:flex-1 [&>button]:py-[0.5rem] [&>button]:px-[1rem] [&>button]:text-icon3':
              variant === 'buttons',
            '[&>button[data-state=active]]:text-icon5 [&>button[data-state=active]]:bg-[#222]': variant === 'buttons',
          },
          className,
        )}
      >
        {children}
      </RadixTabs.List>
    </div>
  );
};
