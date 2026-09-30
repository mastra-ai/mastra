import { Tab, TabContent, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import type { ReactNode } from 'react';

type ToolViewTab = 'overview' | 'playground';

export interface ToolViewProps {
  header: ReactNode;
  overview: ReactNode;
  /** The Playground runner; leave it out when the viewer can't execute tools. */
  playground?: ReactNode;
}

/** Shared shell for every tool page: what the tool is (Overview) apart from running it (Playground). */
export function ToolView({ header, overview, playground }: ToolViewProps) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto grid w-full max-w-6xl content-start gap-4 p-5">
        {header}
        <Tabs<ToolViewTab> defaultTab="overview" className="grid gap-4 overflow-visible">
          <TabList variant="pill-ghost">
            <Tab value="overview">Overview</Tab>
            <Tab
              value="playground"
              disabled={playground === undefined}
              disabledTooltip="You don't have permission to execute tools."
            >
              Playground
            </Tab>
          </TabList>
          <TabContent value="overview" flush>
            {overview}
          </TabContent>
          {/* Kept mounted so the form input and last response survive a trip to Overview. */}
          <TabContent value="playground" flush keepMounted>
            {playground}
          </TabContent>
        </Tabs>
      </div>
    </div>
  );
}
