import { Tab, TabContent, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import type { ReactNode } from 'react';
import { ToolDescription } from './tool-description';

type ToolDrawerTab = 'overview' | 'playground';

export interface ToolDrawerContentProps {
  description?: string;
  overview: ReactNode;
  playground: ReactNode;
  /** False when the viewer can't execute tools: the Playground tab is disabled. */
  canRun: boolean;
}

/** What the tool is (Overview) apart from running it (Playground). */
export function ToolDrawerContent({ description, overview, playground, canRun }: ToolDrawerContentProps) {
  return (
    <>
      {description && <ToolDescription description={description} />}
      <Tabs<ToolDrawerTab> defaultTab="overview" className="grid gap-4 overflow-visible">
        <TabList variant="pill" size="sm">
          <Tab value="overview">Overview</Tab>
          <Tab value="playground" disabled={!canRun} disabledTooltip="You don't have permission to execute tools.">
            Playground
          </Tab>
        </TabList>
        <TabContent value="overview" flush>
          {overview}
        </TabContent>
        {/* Kept mounted so the form input and last response survive a trip to Overview. */}
        <TabContent value="playground" flush keepMounted>
          {canRun && playground}
        </TabContent>
      </Tabs>
    </>
  );
}
