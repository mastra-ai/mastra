import { useState } from 'react';
import { Tabs, TabsContent, TabsList as TabListPrimitive, TabsTrigger } from './tabs';

export interface PlaygroundTabsProps<T extends string> {
  children: React.ReactNode;
  defaultTab: T;
  value?: T;
  onValueChange?: (value: T) => void;
}

export const PlaygroundTabs = <T extends string>({
  children,
  defaultTab,
  value,
  onValueChange,
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
    <Tabs value={currentTab} onValueChange={handleTabChange} className="h-full">
      {children}
    </Tabs>
  );
};

export interface TabListProps {
  children: React.ReactNode;
}

export const TabList = ({ children }: TabListProps) => {
  return (
    <div className="w-full overflow-x-auto">
      <TabListPrimitive className="border-b-sm border-border1 flex min-w-full shrink-0">{children}</TabListPrimitive>
    </div>
  );
};

export interface TabProps {
  children: React.ReactNode;
  value: string;
  onClick?: () => void;
}

export const Tab = ({ children, value, onClick }: TabProps) => {
  return (
    <TabsTrigger
      value={value}
      className="text-xs p-3 text-mastra-el-3 data-[state=active]:text-mastra-el-5 data-[state=active]:border-b-2 whitespace-nowrap flex-shrink-0"
      onClick={onClick}
    >
      {children}
    </TabsTrigger>
  );
};

export interface TabContentProps {
  children: React.ReactNode;
  value: string;
}

export const TabContent = ({ children, value }: TabContentProps) => {
  return (
    <TabsContent value={value} className="h-full overflow-hidden flex flex-col">
      {children}
    </TabsContent>
  );
};
