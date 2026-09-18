import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import { useContext, useEffect, useState } from 'react';
import { TabsContext } from './tabs-context';
import { focusRing } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export type TabContentProps = {
  children: React.ReactNode;
  value: string;
  flush?: boolean;
  keepMounted?: boolean;
  className?: string;
};

export const TabContent = ({ children, value, flush = false, keepMounted = false, className }: TabContentProps) => {
  const tabs = useContext(TabsContext);
  const selected = tabs?.value === value;
  const [visited, setVisited] = useState(selected);
  useEffect(() => {
    if (keepMounted && selected) setVisited(true);
  }, [keepMounted, selected]);
  return (
    <BaseTabs.Panel
      value={value}
      keepMounted={keepMounted}
      data-slot="tabs-content"
      data-flush={flush || undefined}
      className={cn('ring-offset-background grid overflow-y-auto py-2', focusRing.visible, className)}
    >
      <div data-slot="tabs-content-body" className="contents">
        {!keepMounted || selected || visited ? children : null}
      </div>
    </BaseTabs.Panel>
  );
};
