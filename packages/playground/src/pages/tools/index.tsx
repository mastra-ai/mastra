import { useAgents } from '@/hooks/use-agents';
import {
  MainContentLayout,
  Header,
  HeaderTitle,
  MainContentContent,
  ToolList,
  ToolsIcon,
  Icon,
  HeaderAction,
  DocsIcon,
  Button,
} from '@mastra/playground-ui';

import { useTools } from '@/hooks/use-all-tools';
import { Link } from 'react-router';

export default function Tools() {
  const { data: agentsRecord, isLoading: isLoadingAgents } = useAgents();
  const { tools, isLoading: isLoadingTools } = useTools();

  const isEmpty = !isLoadingTools && Object.keys(tools).length === 0;

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>
          <Icon>
            <ToolsIcon />
          </Icon>
          Tools
        </HeaderTitle>

        <HeaderAction>
          <Button as={Link} to="https://mastra.ai/en/docs/agents/using-tools-and-mcp" target="_blank">
            <Icon>
              <DocsIcon />
            </Icon>
            Tools documentation
          </Button>
        </HeaderAction>
      </Header>

      <MainContentContent isCentered={isEmpty}>
        <ToolList tools={tools} agents={agentsRecord} isLoading={isLoadingAgents || isLoadingTools} />
      </MainContentContent>
    </MainContentLayout>
  );
}
