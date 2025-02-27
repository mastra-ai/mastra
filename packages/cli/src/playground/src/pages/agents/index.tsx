import { useNavigate } from 'react-router';
import { Header } from '@/components/ui/header';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AgentsTable } from '@mastra/playground-ui';

import { useAgents } from '@/hooks/use-agents';
import { Barcode } from 'lucide-react';

function Agents() {
  const { agents, isLoading } = useAgents();
  const navigate = useNavigate();

  const agentListData = Object.entries(agents).map(([key, agent]) => ({
    id: key,
    name: agent.name,
    description: agent.instructions,
    provider: agent?.provider,
    modelId: agent?.modelId,
  }));

  return (
    <div className="flex flex-col relative overflow-hidden">
      <section className="flex-1 relative overflow-hidden">
        <ScrollArea className="h-full">
          <section className="">
            <AgentsTable
              isLoading={isLoading}
              title={<Header title="Agents" className="border-0" />}
              agentsList={agentListData}
              columns={[
                {
                  id: 'name',
                  header: 'Name',
                  cell: ({ row }) => (
                    <button
                      className="w-full h-full flex justify-start py-4"
                      onClick={() => {
                        navigate(`/agents/${row.original.id}/chat`);
                      }}
                    >
                      <span
                        onClick={() => {
                          navigate(`/agents/${row.original.id}/chat`);
                        }}
                        className="text-mastra-el-5 text-sm  truncate"
                      >
                        {row.original.name}
                      </span>
                    </button>
                  ),
                },

                {
                  id: 'model',
                  header: 'Model',
                  cell: ({ row }) => (
                    <button
                      className="w-full h-full flex justify-end p-4"
                      onClick={() => {
                        navigate(`/agents/${row.original.id}/chat`);
                      }}
                    >
                      <span className="text-mastra-el-5 text-sm flex items-center gap-2">
                        <span>{row.original.modelId}</span> <Barcode className="w-4 h-4" />
                      </span>
                    </button>
                  ),
                },
              ]}
            />
          </section>
        </ScrollArea>
      </section>
    </div>
  );
}

export default Agents;
