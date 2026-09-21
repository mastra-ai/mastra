import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { useParams } from 'react-router';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { MCPDetail } from '@/domains/mcps/components/MCPDetail';
import { useMCPServers } from '@/domains/mcps/hooks/use-mcp-servers';
import { mcpServerCrumb, navCrumb } from '@/domains/navigation/crumbs';

export const McpServerPage = () => {
  const { serverId } = useParams();
  const crumbs = [navCrumb('/mcps'), mcpServerCrumb];
  const { data: mcpServers = [], isLoading } = useMCPServers();

  const server = mcpServers.find(server => server.id === serverId);

  return (
    <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />} className="grid grid-rows-[minmax(0,1fr)]">
      <div className="h-full w-full overflow-hidden">
        <MCPDetail isLoading={isLoading} server={server} />
      </div>
    </PageLayout>
  );
};
