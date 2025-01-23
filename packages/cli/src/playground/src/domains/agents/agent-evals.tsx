import { RefreshCcwIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

import { useEvalsByAgentId } from '@/hooks/use-evals';

export function AgentEvals({ agentId }: { agentId: string }) {
  const { evals, isLoading, refetchEvals } = useEvalsByAgentId(agentId);

  console.log(evals);

  return (
    <ScrollArea className="h-[calc(100vh-126px)] px-4 pb-4 text-xs w-[400px]">
      <div className="flex justify-end sticky top-0 bg-mastra-bg-2 py-2">
        <Button variant="outline" onClick={() => refetchEvals()}>
          {isLoading ? <RefreshCcwIcon className="w-4 h-4 animate-spin" /> : <RefreshCcwIcon className="w-4 h-4" />}
        </Button>
      </div>
      <div className="space-y-4">
        {evals.length === 0 ? (
          <p className="text-gray-300/60">No evals found for this agent.</p>
        ) : (
          evals.map(evalResult => {
            return (
              <div key={evalResult.timestamp} className="space-y-2">
                <div className="flex gap-2 items-center">
                  <p className="text-mastra-el-4">[{evalResult.timestamp}]</p>
                </div>
                <p className="text-mastra-el-5 whitespace-pre-wrap">
                  <code>{JSON.stringify(evalResult, null, 2)}</code>
                </p>
              </div>
            );
          })
        )}
      </div>
    </ScrollArea>
  );
}
