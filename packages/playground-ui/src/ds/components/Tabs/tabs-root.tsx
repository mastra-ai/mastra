import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import { useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { TabsContext } from './tabs-context';
import './tabs.css';
import { cn } from '@/lib/utils';

export type TabsRootProps<T extends string> = Omit<
  ComponentProps<'div'>,
  'children' | 'defaultValue' | 'value' | 'onChange'
> & {
  children: ReactNode;
  defaultTab: T;
  value?: T;
  onValueChange?: (value: T) => void;
  appearance?: 'default' | 'contained';
  frame?: 'inset';
  className?: string;
};

export const Tabs = <T extends string>({
  children,
  defaultTab,
  value,
  onValueChange,
  appearance = 'default',
  frame = 'inset',
  className,
  ...props
}: TabsRootProps<T>) => {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultTab);
  const selectedValue = value ?? uncontrolledValue;
  const select = (next: T) => {
    setUncontrolledValue(next);
    onValueChange?.(next);
  };
  return (
    <TabsContext.Provider value={{ appearance, value: selectedValue, select }}>
      <BaseTabs.Root
        defaultValue={defaultTab}
        value={selectedValue}
        onValueChange={select}
        data-slot="tabs"
        data-appearance={appearance}
        data-frame={frame}
        className={cn('group/tabs', appearance === 'default' ? 'overflow-y-auto' : 'w-full min-w-0', className)}
        {...props}
      >
        {children}
      </BaseTabs.Root>
    </TabsContext.Provider>
  );
};
