import {
  Button,

  ToolsIcon,
  ToolList,
  useAgents,
  useTools,
  PageContent,
  MainHeader,
} from '@mastra/playground-ui';

import { ExternalLinkIcon } from 'lucide-react';
import { Link } from 'react-router';

export default function Tools() {
  const { data: agentsRecord = {}, isLoading: isLoadingAgents } = useAgents();
  const { data: tools = {}, isLoading: isLoadingTools, error } = useTools();

  const isLoading = isLoadingAgents || isLoadingTools;

  return (
    <PageContent>
      <PageContent.TopBar>
        <Button as={Link} to="https://mastra.ai/en/docs/agents/using-tools-and-mcp" target="_blank" variant="ghost" size="md">
          
          Tools documentation
          <ExternalLinkIcon />
        </Button>
      </PageContent.TopBar>
      <PageContent.Main>
        <div className="w-full max-w-[80rem] px-10 mx-auto grid h-full grid-rows-[auto_1fr] overflow-y-auto">
          <MainHeader>
            <MainHeader.Column>
              <MainHeader.Title isLoading={isLoading}>
                <ToolsIcon /> Tools
              </MainHeader.Title>
            </MainHeader.Column>
          </MainHeader>

          <ToolList tools={tools} agents={agentsRecord} isLoading={isLoading} error={error} />
        </div>
      </PageContent.Main>
    </PageContent>
  );
}
