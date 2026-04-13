import {
  ButtonWithTooltip,
  ErrorState,
  ListSearch,
  NoDataPageLayout,
  PageHeader,
  PageLayout,
  PermissionDenied,
  SessionExpired,
  ToolsIcon,
  is401UnauthorizedError,
  is403ForbiddenError,
} from '@mastra/playground-ui';
import { BookIcon } from 'lucide-react';
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
      <NoDataPageLayout title="Tools" icon={<ToolsIcon />}>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <NoDataPageLayout title="Tools" icon={<ToolsIcon />}>
        <PermissionDenied resource="tools" />
      </NoDataPageLayout>
    );
  }

  if (error) {
    return (
      <NoDataPageLayout title="Tools" icon={<ToolsIcon />}>
        <ErrorState title="Failed to load tools" message={error.message} />
      </NoDataPageLayout>
    );
  }

  if (Object.keys(tools).length === 0 && !isLoading) {
    return (
      <NoDataPageLayout title="Tools" icon={<ToolsIcon />}>
        <NoToolsInfo />
      </NoDataPageLayout>
    );
  }

  return (
    <PageLayout>
      <PageLayout.TopArea>
        <PageLayout.Row>
          <PageLayout.Column>
            <PageHeader>
              <PageHeader.Title isLoading={isLoading}>
                <ToolsIcon /> Tools
              </PageHeader.Title>
            </PageHeader>
          </PageLayout.Column>
          <PageLayout.Column className="flex justify-end gap-2">
            <ButtonWithTooltip
              as="a"
              href="https://mastra.ai/en/docs/agents/using-tools-and-mcp"
              target="_blank"
              rel="noopener noreferrer"
              tooltipContent="Go to Tools documentation"
            >
              <BookIcon />
            </ButtonWithTooltip>
          </PageLayout.Column>
        </PageLayout.Row>
        <div className="max-w-120">
          <ListSearch onSearch={setSearch} label="Filter tools" placeholder="Filter by name" />
        </div>
      </PageLayout.TopArea>

      <ToolsList tools={tools} agents={agentsRecord} isLoading={isLoading} search={search} />
    </PageLayout>
  );
}
