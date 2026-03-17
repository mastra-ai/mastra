import {
  Header,
  HeaderTitle,
  MainContentLayout,
  MainContentContent,
  WorkflowTable,
  WorkflowsList,
  Icon,
  HeaderAction,
  Button,
  ButtonWithTooltip,
  DocsIcon,
  WorkflowIcon,
  ListSearch,
  MainHeader,
  EntityListPageLayout,
  useWorkflows,
  useExperimentalUI,
} from '@mastra/playground-ui';
import { BookIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

function Workflows() {
  const { data: workflows, isLoading, error } = useWorkflows();
  const { variant } = useExperimentalUI('agent-list');
  const [search, setSearch] = useState('');

  const isEmpty = !isLoading && Object.keys(workflows || {}).length === 0;

  if (variant === 'new-proposal') {
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
          <div className="max-w-[30rem]">
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

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>
          <Icon>
            <WorkflowIcon />
          </Icon>
          Workflows
        </HeaderTitle>

        <HeaderAction>
          <Button as={Link} to="https://mastra.ai/en/docs/workflows/overview" target="_blank" variant="ghost" size="md">
            <DocsIcon />
            Workflows documentation
          </Button>
        </HeaderAction>
      </Header>

      <MainContentContent isCentered={isEmpty}>
        <WorkflowTable workflows={workflows || {}} isLoading={isLoading} error={error} />
      </MainContentContent>
    </MainContentLayout>
  );
}

export default Workflows;
