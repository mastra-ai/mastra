import { QueryError } from '@mastra/playground-ui/components/QueryError';
import { ListSearch } from '@mastra/playground-ui/components/ListSearch';
import { NoDataPageLayout, PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { useState } from 'react';
import { useAgents } from '@/domains/agents/hooks/use-agents';
import { NoToolsInfo } from '@/domains/tools/components/tools-list/no-tools-info';
import { ToolsList } from '@/domains/tools/components/tools-list/tools-list';
import { useTools } from '@/domains/tools/hooks/use-all-tools';

export default function Tools() {
  const { data: agentsRecord = {}, isLoading: isLoadingAgents, error: agentsError } = useAgents();
  const { data: tools = {}, isLoading: isLoadingTools, error: toolsError } = useTools();
  const [search, setSearch] = useState('');

  const isLoading = isLoadingAgents || isLoadingTools;
  const error = toolsError || agentsError;

  if (error) {
    return (
      <NoDataPageLayout>
        <QueryError error={error} resource="tools" title="Failed to load tools" />
      </NoDataPageLayout>
    );
  }

  if (Object.keys(tools).length === 0 && !isLoading) {
    return (
      <NoDataPageLayout>
        <NoToolsInfo />
      </NoDataPageLayout>
    );
  }

  return (
    <PageLayout>
      <PageLayout.TopArea>
        <div className="max-w-120">
          <ListSearch onSearch={setSearch} label="Filter tools" placeholder="Filter by name" />
        </div>
      </PageLayout.TopArea>

      <ToolsList tools={tools} agents={agentsRecord} isLoading={isLoading} search={search} />
    </PageLayout>
  );
}
