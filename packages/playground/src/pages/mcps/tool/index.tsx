import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { useMCPServerTool } from '@mastra/react/hooks/mcps';
import { useParams } from 'react-router';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { MCPToolPanel } from '@/domains/mcps/components/MCPToolPanel';
import { McpServerToolCrumb } from '@/domains/mcps/mcp-crumbs';
import { mcpServerCrumb, navCrumb, type CrumbDef } from '@/domains/navigation/crumbs';

const MCPServerToolExecutor = () => {
  const { serverId, toolId } = useParams<{ serverId: string; toolId: string }>();
  const crumbs: CrumbDef[] = [
    navCrumb('/mcps'),
    { ...mcpServerCrumb, to: serverId ? `/mcps/${encodeURIComponent(serverId)}` : undefined },
    { id: 'mcp-server-tool', Component: McpServerToolCrumb },
  ];

  const { data: mcpTool, isLoading } = useMCPServerTool({
    serverId: serverId!,
    toolId: toolId!,
    queryOptions: { enabled: !!serverId && !!toolId },
  });

  return (
    <PageLayout variant="fit" breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
      <h1 className="sr-only">{toolId}</h1>
      {!isLoading && mcpTool && (
        <div className="h-full w-full overflow-y-auto">
          <MCPToolPanel toolId={toolId!} serverId={serverId!} />
        </div>
      )}
    </PageLayout>
  );
};

export default MCPServerToolExecutor;
