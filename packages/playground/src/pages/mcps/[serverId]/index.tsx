import {
  Breadcrumb,
  Button,
  Crumb,
  DocsIcon,
  Header,
  HeaderAction,
  Icon,
  MainContentLayout,
  McpServerIcon,
} from '@mastra/playground-ui';
import { Link, useParams } from 'react-router';
import { MCPServerCombobox } from '@/domains/mcps/components/mcp-server-combobox';
import { MCPDetail } from '@/domains/mcps/components/MCPDetail';
import { useMCPServers } from '@/domains/mcps/hooks/use-mcp-servers';

export const McpServerPage = () => {
  const { serverId } = useParams();
  const { data: mcpServers = [], isLoading } = useMCPServers();

  const server = mcpServers.find(server => server.id === serverId);

  return (
    <MainContentLayout>
      <Header>
        <Breadcrumb>
          <Crumb as={Link} to={`/mcps`}>
            <Icon>
              <McpServerIcon />
            </Icon>
            MCP Servers
          </Crumb>
          <Crumb as="span" to="" isCurrent>
            <MCPServerCombobox value={serverId} variant="ghost" />
          </Crumb>
        </Breadcrumb>

        <HeaderAction>
          <Button
            as={Link}
            to="https://mastra.ai/en/docs/tools-mcp/mcp-overview"
            target="_blank"
            variant="ghost"
            size="md"
          >
            <DocsIcon />
            MCP documentation
          </Button>
        </HeaderAction>
      </Header>

      <MCPDetail isLoading={isLoading} server={server} />
    </MainContentLayout>
  );
};
