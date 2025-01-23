import { RefreshCcwIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { EvalChart } from '@/components/ui/pie-chart';
import { ScrollArea } from '@/components/ui/scroll-area';

import { useEvalsByAgentId } from '@/hooks/use-evals';

export function AgentEvals({ agentId }: { agentId: string }) {
  const { evals, isLoading, refetchEvals } = useEvalsByAgentId(agentId);

  if (isLoading) return <p>Loading...</p>;

  const groupByMetric = (evaluations: any[]) => {
    const groups: Record<string, any[]> = {};

    for (const evaluation of evaluations) {
      const name = evaluation.meta.metricName;
      groups[name] = groups[name] || [];
      groups[name].push(evaluation);
    }

    return new Map(Object.entries(groups));
  };

  const evalsByMetric = groupByMetric(evals);

  const charts = Array.from(evalsByMetric.entries()).map(([metricName, evaluations]) => (
    <EvalChart evals={evaluations} key={metricName} metricName={metricName} />
  ));

  return (
    <ScrollArea className="h-[calc(100vh-126px)] px-4 pb-4 text-xs w-[400px]">
      <div className="flex justify-end sticky top-0 bg-mastra-bg-2 py-2">
        <Button variant="outline" onClick={() => refetchEvals()}>
          {isLoading ? <RefreshCcwIcon className="w-4 h-4 animate-spin" /> : <RefreshCcwIcon className="w-4 h-4" />}
        </Button>
      </div>
      <div className="space-y-4">
        {evals.length === 0 ? <p className="text-gray-300/60">No evals found for this agent.</p> : charts}
      </div>
    </ScrollArea>
  );
}
