import { useNavigate } from 'react-router';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DataTable, Header, HeaderTitle } from '@mastra/playground-ui';
import { Users, Brain, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { useNetworks } from '@/hooks/use-networks';

function Networks() {
  const { networks, isLoading } = useNetworks();
  const navigate = useNavigate();

  return (
    <div className="relative overflow-hidden">
      <Header>
        <HeaderTitle>Networks</HeaderTitle>
      </Header>
      <ScrollArea className="h-full">
        <DataTable
          isLoading={isLoading}
          data={networks}
          columns={[
            {
              id: 'name',
              header: 'Name',
              cell: ({ row }) => (
                <button
                  className="w-full h-full flex justify-start py-4"
                  onClick={() => {
                    navigate(`/networks/${row.original.id}/chat`);
                  }}
                >
                  <div className="text-mastra-el-5 text-sm truncate flex items-center gap-2">
                    <span>{row.original.name}</span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-mastra-el-4 hover:text-mastra-el-5" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>A network of agents with LLM-based routing</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </button>
              ),
            },
            {
              id: 'agents',
              header: 'Agents',
              cell: ({ row }) => (
                <button
                  className="w-full h-full flex justify-start py-4"
                  onClick={() => {
                    navigate(`/networks/${row.original.id}/chat`);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-mastra-el-4" />
                    <Badge variant="outline" className="text-xs bg-mastra-bg-2 hover:bg-mastra-bg-3">
                      {row.original.agents.length}
                    </Badge>
                  </div>
                </button>
              ),
            },
            {
              id: 'model',
              header: 'Routing Model',
              cell: ({ row }) => (
                <button
                  className="w-full h-full flex justify-end p-4"
                  onClick={() => {
                    navigate(`/networks/${row.original.id}/chat`);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-mastra-el-4" />
                    <Badge className="border-none text-xs">{row.original.routingModel.modelId}</Badge>
                  </div>
                </button>
              ),
            },
          ]}
        />
      </ScrollArea>
    </div>
  );
}

export default Networks;
