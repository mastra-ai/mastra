import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import { cn } from '@/lib/utils';

export type TabsRootProps<T extends string> = {
  children: React.ReactNode;
  defaultTab: T;
  value?: T;
  onValueChange?: (value: T) => void;
  className?: string;
};

export const Tabs = <T extends string>({ children, defaultTab, value, onValueChange, className }: TabsRootProps<T>) => {
  return (
    <BaseTabs.Root
      defaultValue={defaultTab}
      value={value}
      onValueChange={onValueChange ? next => onValueChange(next as T) : undefined}
      className={cn('overflow-y-auto', className)}
    >
      {children}
    </BaseTabs.Root>
  );
};
