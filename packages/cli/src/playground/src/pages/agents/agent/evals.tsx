import { useParams } from 'react-router';

import { AgentEvals } from '@/domains/agents/agent-evals';

function AgentEvalsPage() {
  const { agentId } = useParams();

  return (
    <main className="flex-1">
      <AgentEvals agentId={agentId!} />
    </main>

    // <div className="flex flex-col h-screen">
    //   <Header title={<Breadcrumb items={breadcrumbItems} />} />
    //   <main className="flex-1 min-h-0">
    //     <AgentEvals agentId={agentId!} />
    //   </main>
    // </div>
  );
}

export default AgentEvalsPage;
