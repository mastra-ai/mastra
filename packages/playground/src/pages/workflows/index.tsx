import {
  ButtonWithTooltip,
  WorkflowsList,
  WorkflowIcon,
  ListSearch,
  MainHeader,
  EntityListPageLayout,
  useWorkflows,
} from '@mastra/playground-ui';
import { BookIcon } from 'lucide-react';
import { useState } from 'react';

function Workflows() {
  const { data: workflows, isLoading, error } = useWorkflows();
  const [search, setSearch] = useState('');

  return (
    <EntityListPageLayout>
      <EntityListPageLayout.Top>
        <MainHeader withMargins={false}>
          <MainHeader.Column>
            <MainHeader.Title isLoading={isLoading}>
              <WorkflowIcon /> Workflows
            </MainHeader.Title>
          </MainHeader.Column>
          <MainHeader.Column className="flex justify-end gap-2">
            <ButtonWithTooltip
              as="a"
              href="https://mastra.ai/en/docs/workflows/overview"
              target="_blank"
              rel="noopener noreferrer"
              tooltipContent="Go to Workflows documentation"
            >
              <BookIcon />
            </ButtonWithTooltip>
          </MainHeader.Column>
        </MainHeader>
        <div className="max-w-120">
          <ListSearch onSearch={setSearch} label="Filter workflows" placeholder="Filter by name or description" />
        </div>
      </EntityListPageLayout.Top>

      <WorkflowsList
        workflows={workflows || {}}
        isLoading={isLoading}
        error={error}
        search={search}
        onSearch={setSearch}
      />
    </EntityListPageLayout>
  );
}

export default Workflows;
