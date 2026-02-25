import { useState } from 'react';
import {
  Icon,
  DocsIcon,
  Button,
  HeaderAction,
  Header,
  MainContentContent,
  MainContentLayout,
  MCPTable,
  HeaderTitle,
  McpServerIcon,
  useMCPServers,
  MCPServerDialog,
  useIsCmsAvailable,
} from '@mastra/playground-ui';
import { Plus } from 'lucide-react';

import { Link } from 'react-router';

const MCPs = () => {
  const { data: mcpServers = [], isLoading } = useMCPServers();
  const { isCmsAvailable } = useIsCmsAvailable();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const isEmpty = !isLoading && mcpServers.length === 0;

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>
          <Icon>
            <McpServerIcon />
          </Icon>
          MCP Servers
        </HeaderTitle>

        <HeaderAction>
          {isCmsAvailable && (
            <Button variant="light" onClick={() => setIsCreateOpen(true)}>
              <Icon>
                <Plus />
              </Icon>
              Create MCP server
            </Button>
          )}
          <Button as={Link} to="https://mastra.ai/en/docs/tools-mcp/mcp-overview" target="_blank">
            <Icon>
              <DocsIcon />
            </Icon>
            MCP documentation
          </Button>
        </HeaderAction>
      </Header>

      <MainContentContent isCentered={isEmpty}>
        <MCPTable mcpServers={mcpServers} isLoading={isLoading} />
      </MainContentContent>

      <MCPServerDialog isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
    </MainContentLayout>
  );
};

export default MCPs;
