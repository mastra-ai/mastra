import { WorkflowList, Button, WorkflowIcon, useWorkflows, PageContent, MainHeader } from '@mastra/playground-ui';
import { ExternalLinkIcon } from 'lucide-react';
import { Link } from 'react-router';

function Workflows() {
  const { data: workflows, isLoading, error } = useWorkflows();

  const isEmpty = !isLoading && Object.keys(workflows || {}).length === 0;

  return (
    <PageContent>
      <PageContent.TopBar>
        <Button as={Link} to="https://mastra.ai/en/docs/workflows/overview" target="_blank" variant="ghost" size="md">
          Workflows documentation
          <ExternalLinkIcon />
        </Button>
      </PageContent.TopBar>
      <PageContent.Main>
        <div className="w-full max-w-[80rem] px-10 mx-auto grid h-full grid-rows-[auto_1fr] overflow-y-auto">
          <MainHeader>
            <MainHeader.Column>
              <MainHeader.Title isLoading={isLoading}>
                <WorkflowIcon /> Workflows
              </MainHeader.Title>
            </MainHeader.Column>
          </MainHeader>

          <WorkflowList workflows={workflows || {}} isLoading={isLoading} error={error} />
        </div>
      </PageContent.Main>
    </PageContent>
  );
}

export default Workflows;
