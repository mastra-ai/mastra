import { cn } from '@/lib/utils';
import * as RadixTabs from '@radix-ui/react-tabs';
import { useState } from 'react';

type TabsRootProps<T extends string> = {
  children: React.ReactNode;
  defaultTab: T;
  value?: T;
  onValueChange?: (value: T) => void;
  className?: string;
};

export const TabsRoot = <T extends string>({
  children,
  defaultTab,
  value,
  onValueChange,
  className,
}: TabsRootProps<T>) => {
  const [internalTab, setInternalTab] = useState<T>(defaultTab);

  // Use controlled mode if value and onValueChange are provided
  const isControlled = value !== undefined && onValueChange !== undefined;
  const currentTab = isControlled ? value : internalTab;
  const handleTabChange = (newValue: string) => {
    const typedValue = newValue as T;
    if (isControlled) {
      onValueChange(typedValue);
    } else {
      setInternalTab(typedValue);
    }
  };

  return (
    <RadixTabs.Root
      value={currentTab}
      onValueChange={handleTabChange}
      className={cn('grid gap-[3rem] overflow-y-auto', className)}
    >
      {children}
    </RadixTabs.Root>
  );
};
