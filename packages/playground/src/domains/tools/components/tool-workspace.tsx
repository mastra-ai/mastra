import type { GetToolResponse } from '@mastra/client-js';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Tab, TabContent, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useApiToolSchemas } from '../hooks/use-api-tool-schemas';
import type { ToolExecution } from '../utils/tool-run';
import { ToolUsedBySection } from './tool-drawer/tool-used-by-section';
import { ToolOverview } from './tool-overview';
import { ToolPlayground } from './tool-playground';

export function ToolWorkspace({
  tool,
  execution,
  canRun,
}: {
  tool: GetToolResponse;
  execution: ToolExecution;
  canRun: boolean;
}) {
  const { inputSchema, outputSchema, requestContextSchema, zodInputSchema } = useApiToolSchemas(tool);
  return (
    <Tabs
      defaultTab={canRun ? 'playground' : 'overview'}
      className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden"
    >
      <div className="shrink-0 space-y-3 border-b border-surface-rim p-4">
        {tool.description && (
          <Txt variant="body-sm" tone="muted" className="break-words">
            {tool.description}
          </Txt>
        )}
        <TabList variant="pill-ghost" size="sm">
          <Tab value="playground" disabled={!canRun} disabledTooltip="You don't have permission to execute tools.">
            Playground
          </Tab>
          <Tab value="overview">Overview</Tab>
        </TabList>
      </div>
      <TabContent value="playground" flush keepMounted className="min-h-0 flex-1 overflow-hidden">
        {canRun && (
          <ToolPlayground
            variant="workspace"
            zodInputSchema={zodInputSchema}
            execution={execution}
            requestContextEntityType="tool"
            requestContextEntityId={tool.id}
          />
        )}
      </TabContent>
      <TabContent value="overview" flush className="min-h-0 flex-1 overflow-hidden">
        <ScrollArea className="min-h-0" mask={false}>
          <div className="p-4">
            <ToolOverview
              inputSchema={inputSchema}
              outputSchema={outputSchema}
              requestContextSchema={requestContextSchema}
              footer={<ToolUsedBySection toolId={tool.id} />}
            />
          </div>
        </ScrollArea>
      </TabContent>
    </Tabs>
  );
}
