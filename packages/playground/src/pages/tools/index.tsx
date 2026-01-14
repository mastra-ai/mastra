import { useState } from 'react';
import { Plus } from 'lucide-react';
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
  AddToolsDialog,
} from '@mastra/playground-ui';

import { Link } from 'react-router';

export default function Tools() {
  const [isAddToolsDialogOpen, setIsAddToolsDialogOpen] = useState(false);
  const { data: agentsRecord = {}, isLoading: isLoadingAgents } = useAgents();
  const { data: tools = {}, isLoading: isLoadingTools } = useTools();

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
          <Button onClick={() => setIsAddToolsDialogOpen(true)}>
            <Icon>
              <Plus />
            </Icon>
            Add Tools
          </Button>
          <Button variant="outline" as={Link} to="https://mastra.ai/en/docs/agents/using-tools-and-mcp" target="_blank">
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

      <AddToolsDialog open={isAddToolsDialogOpen} onOpenChange={setIsAddToolsDialogOpen} />
    </MainContentLayout>
  );
}
