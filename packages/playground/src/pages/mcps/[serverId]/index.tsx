import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { useParams } from 'react-router';
import { pageHeaderProps } from '@/components/ui/page-header-props';
import { MCPDetail } from '@/domains/mcps/components/MCPDetail';
import { useMCPServers } from '@/domains/mcps/hooks/use-mcp-servers';
import { mcpServerCrumb, navCrumb } from '@/domains/navigation/crumbs';

export const McpServerPage = () => {
  const { serverId } = useParams();
  const crumbs = [navCrumb('/mcps'), mcpServerCrumb];
  const { data: mcpServers = [], isLoading } = useMCPServers();

  const server = mcpServers.find(server => server.id === serverId);

  return (
    <PageLayout {...pageHeaderProps(crumbs)} height="full" className="grid-rows-[minmax(0,1fr)] p-0">
      <div className="h-full w-full overflow-hidden">
        <MCPDetail isLoading={isLoading} server={server} />
      </div>
    </PageLayout>
  );
};
