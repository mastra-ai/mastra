import { useNetwork } from '@/hooks/use-networks';
import { Badge } from '@/components/ui/badge';
import { Brain } from 'lucide-react';
import { Agent } from '@/components/ui/agent-logo';

export function NetworkDetails({ networkId }: { networkId: string }) {
  const { network, isLoading } = useNetwork(networkId);

  if (isLoading || !network) {
    return (
      <div className="p-4">
        <p className="text-sm text-mastra-el-4">Loading network details...</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="text-sm font-medium text-mastra-el-5 mb-1">Network Name</h3>
        <p className="text-sm text-mastra-el-4">{network.name}</p>
      </div>

      <div>
        <h3 className="text-sm font-medium text-mastra-el-5 mb-1">Routing Model</h3>
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-mastra-el-4" />
          <Badge className="border-none text-xs">{network.routingModel?.modelId || 'Unknown'}</Badge>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-mastra-el-5 mb-1">Instructions</h3>
        <div className="max-h-36 overflow-auto rounded border border-mastra-el-2 bg-mastra-bg-2 p-2">
          <p className="text-sm text-mastra-el-4">{network.instructions || 'No instructions provided'}</p>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-mastra-el-5 mb-1">Agents</h3>
        <div className="flex items-center gap-2">
          <Agent />
          <Badge variant="outline" className="text-xs">
            {network.agents?.length || 0} agents
          </Badge>
        </div>
      </div>
    </div>
  );
}
