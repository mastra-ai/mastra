import { useState } from 'react';
import { X } from 'lucide-react';
import { Tabs, TabsContent, TabsList as TabListPrimitive, TabsTrigger } from './tabs';
import { cn } from '@/lib/utils';

export interface PlaygroundTabsProps<T extends string> {
  children: React.ReactNode;
  defaultTab: T;
  value?: T;
  onValueChange?: (value: T) => void;
  className?: string;
}

export const PlaygroundTabs = <T extends string>({
  children,
  defaultTab,
  value,
  onValueChange,
  className,
}: PlaygroundTabsProps<T>) => {
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
    <Tabs value={currentTab} onValueChange={handleTabChange} className={cn('h-full overflow-x-auto', className)}>
      {children}
    </Tabs>
  );
};

export interface TabListProps {
  children: React.ReactNode;
  className?: string;
}

export const TabList = ({ children, className }: TabListProps) => {
  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <TabListPrimitive className="border-b border-border1 flex min-w-full shrink-0">{children}</TabListPrimitive>
    </div>
  );
};

export interface TabProps {
  children: React.ReactNode;
  value: string;
  onClick?: () => void;
  onClose?: () => void;
}

export const Tab = ({ children, value, onClick, onClose }: TabProps) => {
  return (
    <TabsTrigger
      value={value}
      className="text-xs p-3 text-mastra-el-3 data-[state=active]:text-mastra-el-5 data-[state=active]:border-b-2 whitespace-nowrap flex-shrink-0 flex items-center gap-1.5"
      onClick={onClick}
    >
      {children}
      {onClose && (
        <button
          onClick={e => {
            e.stopPropagation();
            onClose();
          }}
          className="p-0.5 hover:bg-surface3 rounded transition-colors"
          aria-label="Close tab"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </TabsTrigger>
  );
};

export interface TabContentProps {
  children: React.ReactNode;
  value: string;
}

export const TabContent = ({ children, value }: TabContentProps) => {
  return (
    <TabsContent value={value} className="h-full overflow-auto flex flex-col">
      {children}
    </TabsContent>
  );
};
