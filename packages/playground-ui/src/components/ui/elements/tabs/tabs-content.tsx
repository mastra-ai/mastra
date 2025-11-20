import { cn } from '@/lib/utils';
import * as RadixTabs from '@radix-ui/react-tabs';

type TabContentProps = {
  children: React.ReactNode;
  value: string;
  className?: string;
};

export const TabContent = ({ children, value, className }: TabContentProps) => {
  return (
    <RadixTabs.Content
      value={value}
      className={cn(
        'grid overflow-y-auto ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:none',
        className,
      )}
    >
      {children}
    </RadixTabs.Content>
  );
};
