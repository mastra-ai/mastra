import type { GetAgentResponse, GetToolResponse } from '@mastra/client-js';
import { EntityList } from '@/ds/components/EntityList';
import { EntityListSkeleton } from '@/ds/components/EntityList';
import { AgentIcon } from '@/ds/icons/AgentIcon';
import { NoToolsInfo } from './no-tools-info';
import { useLinkComponent } from '@/lib/framework';
import { truncateString } from '@/lib/truncate-string';
import { prepareToolsTable } from '@/domains/tools/utils/prepareToolsTable';
import { ErrorState } from '@/ds/components/ErrorState';
import { PermissionDenied } from '@/ds/components/PermissionDenied';
import { is403ForbiddenError } from '@/lib/query-utils';
import { useMemo, useState } from 'react';

export interface ToolsListProps {
  tools: Record<string, GetToolResponse>;
  agents: Record<string, GetAgentResponse>;
  isLoading: boolean;
  error?: Error | null;
  search?: string;
  onSearch?: (search: string) => void;
}

export function ToolsList({
  tools,
  agents,
  isLoading,
  error,
  search: externalSearch,
  onSearch: externalOnSearch,
}: ToolsListProps) {
  const { paths } = useLinkComponent();
  const [internalSearch, setInternalSearch] = useState('');
  const search = externalSearch ?? internalSearch;

  const toolData = useMemo(() => prepareToolsTable(tools, agents), [tools, agents]);

  const filteredData = useMemo(
    () => toolData.filter(tool => tool.id.toLowerCase().includes(search.toLowerCase())),
    [toolData, search],
  );

  if (error && is403ForbiddenError(error)) {
    return <PermissionDenied resource="tools" />;
  }

  if (error) {
    return <ErrorState title="Failed to load tools" message={error.message} />;
  }

  if (toolData.length === 0 && !isLoading) {
    return <NoToolsInfo />;
  }

  if (isLoading) {
    return <EntityListSkeleton columns="auto 1fr auto" />;
  }

  return (
    <EntityList columns="auto 1fr auto">
      <EntityList.Top>
        <EntityList.TopCell>Name</EntityList.TopCell>
        <EntityList.TopCell>Description</EntityList.TopCell>
        <EntityList.TopCellSmart
          long="Agents"
          short={<AgentIcon />}
          tooltip="Attached Agents"
          className="text-center"
        />
      </EntityList.Top>

      {filteredData.map(tool => {
        const name = truncateString(tool.id, 50);
        const description = truncateString(tool.description ?? '', 200);
        const agentsCount = tool.agents.length;

        return (
          <EntityList.RowLink key={tool.id} to={paths.toolLink(tool.id)}>
            <EntityList.NameCell>{name}</EntityList.NameCell>
            <EntityList.DescriptionCell>{description}</EntityList.DescriptionCell>
            <EntityList.TextCell className="text-center">{agentsCount || ''}</EntityList.TextCell>
          </EntityList.RowLink>
        );
      })}
    </EntityList>
  );
}
