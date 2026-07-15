import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import { focusRing } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export type TabContentProps = {
  children: React.ReactNode;
  value: string;
  className?: string;
};

export const TabContent = ({ children, value, className }: TabContentProps) => {
  return (
    <BaseTabs.Panel
      value={value}
      className={cn('ring-offset-background grid overflow-y-auto py-3', focusRing.visible, className)}
    >
      {children}
    </BaseTabs.Panel>
  );
};
