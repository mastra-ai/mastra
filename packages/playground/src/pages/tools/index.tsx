import { NoDataPageLayout, PageLayout, is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui';
import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
import { ListSearch } from '@mastra/playground-ui/components/ListSearch';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
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

  if (error && is401UnauthorizedError(error)) {
    return (
      <NoDataPageLayout>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <NoDataPageLayout>
        <PermissionDenied resource="tools" />
      </NoDataPageLayout>
    );
  }

  if (error) {
    return (
      <NoDataPageLayout>
        <ErrorState title="Failed to load tools" message={error.message} />
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
