import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { useParams } from 'react-router';
import { pageHeaderProps } from '@/components/ui/page-header-props';
import { AgentToolCrumb } from '@/domains/agents/agent-crumb';
import { AgentToolPanel } from '@/domains/agents/components/AgentToolPanel';
import { agentCrumb, navCrumb, type CrumbDef } from '@/domains/navigation/crumbs';

const AgentTool = () => {
  const { toolId, agentId } = useParams();
  const crumbs: CrumbDef[] = [
    navCrumb('/agents'),
    { ...agentCrumb, to: agentId ? `/agents/${encodeURIComponent(agentId)}` : undefined },
    { id: 'agent-tool', Component: AgentToolCrumb, heading: 'Agent tool' },
  ];

  return (
    <PageLayout {...pageHeaderProps(crumbs)} height="full" className="grid-rows-[minmax(0,1fr)] p-0">
      <div className="h-full w-full overflow-y-auto">
        <AgentToolPanel toolId={toolId!} agentId={agentId!} />
      </div>
    </PageLayout>
  );
};

export default AgentTool;
