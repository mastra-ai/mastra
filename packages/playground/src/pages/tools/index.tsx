import {
  MainContentLayout,
  Header,
  HeaderTitle,
  MainContentContent,
  ToolsIcon,
  Icon,
  HeaderAction,
  DocsIcon,
  Button,
  ToolTable,
  useAgents,
  useTools,
} from '@mastra/playground-ui';

import { Link } from 'react-router';

export default function Tools() {
  const { data: agentsRecord = {}, isLoading: isLoadingAgents } = useAgents();
  const { data: tools = {}, isLoading: isLoadingTools } = useTools();

  const isEmpty = !isLoadingTools && Object.keys(agentsRecord).length === 0;

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
        <ToolTable tools={tools} agents={agentsRecord} isLoading={isLoadingAgents || isLoadingTools} />
      </MainContentContent>
    </MainContentLayout>
  );
}
