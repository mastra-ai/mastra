import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { TabsContext } from './tabs-context';
import './tabs.css';
import { cn } from '@/lib/utils';

export type TabsRootProps<T extends string> = {
  children: ReactNode;
  defaultTab: T;
  value?: T;
  onValueChange?: (value: T) => void;
  appearance?: 'default' | 'contained';
  frame?: 'stroke' | 'inset';
  className?: string;
};

export const Tabs = <T extends string>({
  children,
  defaultTab,
  value,
  onValueChange,
  appearance = 'default',
  frame = 'stroke',
  className,
}: TabsRootProps<T>) => {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultTab);
  const selectedValue = value ?? uncontrolledValue;
  const select = (next: T) => {
    setUncontrolledValue(next);
    onValueChange?.(next);
  };
  return (
    <TabsContext.Provider value={{ appearance, frame, value: selectedValue, select }}>
      <BaseTabs.Root
        defaultValue={defaultTab}
        value={selectedValue}
        onValueChange={select}
        data-slot="tabs"
        data-appearance={appearance}
        data-frame={frame}
        className={cn('group/tabs', appearance === 'default' ? 'overflow-y-auto' : 'w-full min-w-0', className)}
      >
        {children}
      </BaseTabs.Root>
    </TabsContext.Provider>
  );
};
