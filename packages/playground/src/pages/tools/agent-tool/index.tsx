import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { useParams } from 'react-router';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { AgentToolCrumb } from '@/domains/agents/agent-crumb';
import { AgentToolPanel } from '@/domains/agents/components/AgentToolPanel';
import { agentCrumb, navCrumb, type CrumbDef } from '@/domains/navigation/crumbs';

const AgentTool = () => {
  const { toolId, agentId } = useParams();
  const crumbs: CrumbDef[] = [
    navCrumb('/agents'),
    { ...agentCrumb, to: agentId ? `/agents/${encodeURIComponent(agentId)}` : undefined },
    { id: 'agent-tool', Component: AgentToolCrumb },
  ];

  return (
    <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />} className="grid grid-rows-[minmax(0,1fr)]">
      <div className="h-full w-full overflow-y-auto">
        <AgentToolPanel toolId={toolId!} agentId={agentId!} />
      </div>
    </PageLayout>
  );
};

export default AgentTool;
