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
      data-slot="tabs-content"
      className={cn(
        'ring-offset-background grid overflow-y-auto py-3',
        'group-data-[appearance=contained]/tabs:-mt-px group-data-[appearance=contained]/tabs:rounded-tr-xl group-data-[appearance=contained]/tabs:rounded-b-xl group-data-[appearance=contained]/tabs:border group-data-[appearance=contained]/tabs:border-border1 group-data-[appearance=contained]/tabs:bg-surface2 group-data-[appearance=contained]/tabs:p-6',
        'group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:border-0 group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:bg-surface4 group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:p-1',
        focusRing.visible,
        className,
      )}
    >
      <div
        data-slot="tabs-content-body"
        className="group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:bg-surface2 contents group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:block group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:min-w-0 group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:rounded-lg group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:p-6"
      >
        {children}
      </div>
    </BaseTabs.Panel>
  );
};
