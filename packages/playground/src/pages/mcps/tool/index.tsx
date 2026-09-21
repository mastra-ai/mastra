import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { useParams } from 'react-router';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { MCPToolPanel } from '@/domains/mcps/components/MCPToolPanel';
import { useMCPServerTool } from '@/domains/mcps/hooks/use-mcp-server-tool';
import { McpServerToolCrumb } from '@/domains/mcps/mcp-crumbs';
import { mcpServerCrumb, navCrumb, type CrumbDef } from '@/domains/navigation/crumbs';

const MCPServerToolExecutor = () => {
  const { serverId, toolId } = useParams<{ serverId: string; toolId: string }>();
  const crumbs: CrumbDef[] = [
    navCrumb('/mcps'),
    { ...mcpServerCrumb, to: serverId ? `/mcps/${encodeURIComponent(serverId)}` : undefined },
    { id: 'mcp-server-tool', Component: McpServerToolCrumb },
  ];

  const { data: mcpTool, isLoading } = useMCPServerTool(serverId!, toolId!);

  return (
    <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />} className="grid grid-rows-[minmax(0,1fr)]">
      {!isLoading && mcpTool && (
        <div className="h-full w-full overflow-y-auto">
          <MCPToolPanel toolId={toolId!} serverId={serverId!} />
        </div>
      )}
    </PageLayout>
  );
};

export default MCPServerToolExecutor;
