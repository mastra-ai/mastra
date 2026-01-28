import { cn } from '@/lib/utils';
import * as RadixTabs from '@radix-ui/react-tabs';
import { focusRing } from '@/ds/primitives/transitions';

export type TabContentProps = {
  children: React.ReactNode;
  value: string;
  className?: string;
};

export const TabContent = ({ children, value, className }: TabContentProps) => {
  return (
    <RadixTabs.Content
      value={value}
      className={cn(
        'grid py-3 overflow-y-auto ring-offset-background',
        focusRing.visible,
        'data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:duration-200',
        'data-[state=inactive]:animate-out data-[state=inactive]:fade-out-0 data-[state=inactive]:duration-150',
        className,
      )}
    >
      {children}
    </RadixTabs.Content>
  );
};
