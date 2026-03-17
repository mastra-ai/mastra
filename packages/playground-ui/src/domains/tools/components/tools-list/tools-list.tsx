import type { GetAgentResponse, GetToolResponse } from '@mastra/client-js';
import { EntityList } from '@/ds/components/EntityList';
import { Spinner } from '@/ds/components/Spinner';
import { EmptyState } from '@/ds/components/EmptyState';
import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons/Icon';
import { ToolsIcon } from '@/ds/icons';
import { ToolCoinIcon } from '@/ds/icons/ToolCoinIcon';
import { AgentIcon } from '@/ds/icons/AgentIcon';
import { useLinkComponent } from '@/lib/framework';
import { truncateString } from '@/lib/truncate-string';
import { prepareToolsTable } from '@/domains/tools/utils/prepareToolsTable';
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

export function ToolsList({ tools, agents, isLoading, error, search: externalSearch, onSearch: externalOnSearch }: ToolsListProps) {
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

  if (toolData.length === 0 && !isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState
          iconSlot={<ToolCoinIcon />}
          titleSlot="Configure Tools"
          descriptionSlot="Mastra tools are not configured yet. You can find more information in the documentation."
          actionSlot={
            <Button
              size="lg"
              className="w-full"
              variant="light"
              as="a"
              href="https://mastra.ai/en/docs/agents/using-tools-and-mcp"
              target="_blank"
            >
              <Icon>
                <ToolsIcon />
              </Icon>
              Docs
            </Button>
          }
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner />
      </div>
    );
  }

  return (
    <EntityList columns="auto 1fr auto">
      <EntityList.Top>
        <EntityList.TopCell>Name</EntityList.TopCell>
        <EntityList.TopCell>Description</EntityList.TopCell>
        <EntityList.TopCellSmart
          label="Agents"
          icon={<AgentIcon />}
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
