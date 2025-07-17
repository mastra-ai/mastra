import { useState } from 'react';
import { Tabs, TabsContent, TabsList as TabListPrimitive, TabsTrigger } from './tabs';

export interface PlaygroundTabsProps<T extends string> {
  children: React.ReactNode;
  defaultTab: T;
}

export const PlaygroundTabs = <T extends string>({ children, defaultTab }: PlaygroundTabsProps<T>) => {
  const [tab, setTab] = useState<T>(defaultTab);

  return (
    <Tabs value={tab} onValueChange={value => setTab(value as T)} className="h-full">
      {children}
    </Tabs>
  );
};

export interface TabListProps {
  children: React.ReactNode;
}

export const TabList = ({ children }: TabListProps) => {
  return <TabListPrimitive className="border-b-sm border-border1 flex w-full shrink-0">{children}</TabListPrimitive>;
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
      className="text-xs p-3 text-mastra-el-3 data-[state=active]:text-mastra-el-5 data-[state=active]:border-b-2"
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
    <TabsContent value={value} className="h-full pb-5">
      {children}
    </TabsContent>
  );
};
