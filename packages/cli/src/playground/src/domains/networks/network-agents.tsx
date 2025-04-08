import { Badge } from '@/components/ui/badge';
import { Brain } from 'lucide-react';
import { GetNetworkResponse } from '@mastra/client-js';

export function NetworkAgents({ network }: { network: GetNetworkResponse }) {
  if (!network.agents || network.agents.length === 0) {
    return (
      <div className="p-4">
        <p className="text-sm text-mastra-el-4">No agents found in this network.</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h3 className="text-sm font-medium text-mastra-el-5 mb-3">Network Agents</h3>
      <div className="space-y-3">
        {network.agents.map((agent, index) => (
          <div key={index} className="bg-mastra-bg-2 py-2 px-3 rounded-md">
            <div className="flex justify-between items-center">
              <div className="flex gap-1 items-center">
                <Brain className="h-3 w-3 text-mastra-el-4" />
                <h4 className="text-xs font-medium text-mastra-el-5">{agent.name}</h4>
              </div>
              <Badge className="border-none text-xs py-0.5 px-1.5">
                {agent.provider}/{agent.modelId}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
