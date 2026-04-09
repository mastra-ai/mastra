import {
  ToolsIcon,
  ButtonWithTooltip,
  ToolsList,
  ListSearch,
  MainHeader,
  EntityListPageLayout,
  useAgents,
  useTools,
} from '@mastra/playground-ui';
import { BookIcon } from 'lucide-react';
import { useState } from 'react';

export default function Tools() {
  const { data: agentsRecord = {}, isLoading: isLoadingAgents } = useAgents();
  const { data: tools = {}, isLoading: isLoadingTools, error } = useTools();
  const [search, setSearch] = useState('');

  const isLoading = isLoadingAgents || isLoadingTools;

  return (
    <EntityListPageLayout>
      <EntityListPageLayout.Top>
        <MainHeader withMargins={false}>
          <MainHeader.Column>
            <MainHeader.Title isLoading={isLoading}>
              <ToolsIcon /> Tools
            </MainHeader.Title>
          </MainHeader.Column>
          <MainHeader.Column className="flex justify-end gap-2">
            <ButtonWithTooltip
              as="a"
              href="https://mastra.ai/en/docs/agents/using-tools-and-mcp"
              target="_blank"
              rel="noopener noreferrer"
              tooltipContent="Go to Tools documentation"
            >
              <BookIcon />
            </ButtonWithTooltip>
          </MainHeader.Column>
        </MainHeader>
        <div className="max-w-120">
          <ListSearch onSearch={setSearch} label="Filter tools" placeholder="Filter by name" />
        </div>
      </EntityListPageLayout.Top>

      <ToolsList
        tools={tools}
        agents={agentsRecord}
        isLoading={isLoading}
        error={error}
        search={search}
        onSearch={setSearch}
      />
    </EntityListPageLayout>
  );
}
