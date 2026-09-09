import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import type { ReactNode } from 'react';
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
  return (
    <BaseTabs.Root
      defaultValue={defaultTab}
      value={value}
      onValueChange={onValueChange ? next => onValueChange(next) : undefined}
      data-slot="tabs"
      data-appearance={appearance}
      data-frame={frame}
      className={cn('group/tabs', appearance === 'default' ? 'overflow-y-auto' : 'w-full min-w-0', className)}
    >
      {children}
    </BaseTabs.Root>
  );
};
