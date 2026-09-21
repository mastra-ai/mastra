import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
import { ListSearch } from '@mastra/playground-ui/components/ListSearch';
import { NoDataPageLayout, PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { useState } from 'react';
import { pageHeaderProps } from '@/components/ui/page-header-props';
import { useAgents } from '@/domains/agents/hooks/use-agents';
import { navCrumb } from '@/domains/navigation/crumbs';
import { NoToolsInfo } from '@/domains/tools/components/tools-list/no-tools-info';
import { ToolsList } from '@/domains/tools/components/tools-list/tools-list';
import { useTools } from '@/domains/tools/hooks/use-all-tools';

const crumbs = [navCrumb('/tools')];

export default function Tools() {
  const { data: agentsRecord = {}, isLoading: isLoadingAgents, error: agentsError } = useAgents();
  const { data: tools = {}, isLoading: isLoadingTools, error: toolsError } = useTools();
  const [search, setSearch] = useState('');

  const isLoading = isLoadingAgents || isLoadingTools;
  const error = toolsError || agentsError;

  if (error && is401UnauthorizedError(error)) {
    return (
      <NoDataPageLayout {...pageHeaderProps(crumbs)}>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <NoDataPageLayout {...pageHeaderProps(crumbs)}>
        <PermissionDenied resource="tools" />
      </NoDataPageLayout>
    );
  }

  if (error) {
    return (
      <NoDataPageLayout {...pageHeaderProps(crumbs)}>
        <ErrorState title="Failed to load tools" message={error.message} />
      </NoDataPageLayout>
    );
  }

  if (Object.keys(tools).length === 0 && !isLoading) {
    return (
      <NoDataPageLayout {...pageHeaderProps(crumbs)}>
        <NoToolsInfo />
      </NoDataPageLayout>
    );
  }

  return (
    <PageLayout {...pageHeaderProps(crumbs)} height="full">
      <PageLayout.TopArea>
        <div className="max-w-120">
          <ListSearch onSearch={setSearch} label="Filter tools" placeholder="Filter by name" />
        </div>
      </PageLayout.TopArea>

      <ToolsList tools={tools} agents={agentsRecord} isLoading={isLoading} search={search} />
    </PageLayout>
  );
}
