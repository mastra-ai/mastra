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
      className={cn('grid py-3 overflow-y-auto ring-offset-background', focusRing.visible, className)}
    >
      {children}
    </BaseTabs.Panel>
  );
};
