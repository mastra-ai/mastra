import { ChevronDown, ChevronRight, RefreshCcwIcon } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { Evals, useEvalsByAgentId } from '@/hooks/use-evals';

type GroupedEvals = {
  metricName: string;
  averageScore: number;
  evals: any[];
};

export function AgentEvals({ agentId }: { agentId: string }) {
  const { evals, isLoading, refetchEvals } = useEvalsByAgentId(agentId);
  const [expandedMetrics, setExpandedMetrics] = useState<Set<string>>(new Set());

  const liveEvals = evals.filter(evaluation => !evaluation.meta.testName);
  const ciEvals = evals.filter(evaluation => evaluation.meta.testName);

  const groupEvals = (evaluations: Evals[]): GroupedEvals[] => {
    return evaluations.reduce((groups: GroupedEvals[], evaluation) => {
      const existingGroup = groups.find(g => g.metricName === evaluation.meta.metricName);
      if (existingGroup) {
        existingGroup.evals.push(evaluation);
        existingGroup.averageScore =
          existingGroup.evals.reduce((sum, e) => sum + e.result.score, 0) / existingGroup.evals.length;
      } else {
        groups.push({
          metricName: evaluation.meta.metricName,
          averageScore: evaluation.result.score,
          evals: [evaluation],
        });
      }
      return groups;
    }, []);
  };

  const toggleMetric = (metricName: string) => {
    const newExpanded = new Set(expandedMetrics);
    if (newExpanded.has(metricName)) {
      newExpanded.delete(metricName);
    } else {
      newExpanded.add(metricName);
    }
    setExpandedMetrics(newExpanded);
  };

  const EvalTable = ({ evaluations, showTestName = false }: { evaluations: Evals[]; showTestName: boolean }) => (
    <Table>
      <TableHeader className="bg-[#171717] sticky top-0 z-10">
        <TableRow className="border-gray-6 border-b-[0.1px] text-[0.8125rem]">
          <TableHead className="w-[50px]"></TableHead>
          <TableHead className="text-mastra-el-3">Metric</TableHead>
          <TableHead className="text-mastra-el-3">Average Score</TableHead>
          <TableHead className="text-mastra-el-3">Total Evaluations</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className="border-b border-gray-6">
        {isLoading ? (
          <TableRow className="border-b-gray-6 border-b-[0.1px] text-[0.8125rem]">
            <TableCell>
              <Skeleton className="h-8 w-8" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-8 w-full" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-8 w-full" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-8 w-full" />
            </TableCell>
          </TableRow>
        ) : (
          groupEvals(evaluations).map(group => (
            <>
              <TableRow
                key={group.metricName}
                className="border-b-gray-6 border-b-[0.1px] text-[0.8125rem] cursor-pointer hover:bg-mastra-bg-3"
                onClick={() => toggleMetric(group.metricName)}
              >
                <TableCell>
                  <div className="h-8 w-full flex items-center justify-center">
                    {expandedMetrics.has(group.metricName) ? (
                      <ChevronDown className="h-4 w-4 text-mastra-el-5" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-mastra-el-5" />
                    )}
                  </div>
                </TableCell>
                <TableCell className="font-medium text-mastra-el-5">{group.metricName}</TableCell>
                <TableCell className="text-mastra-el-5">{group.averageScore.toFixed(2)}</TableCell>
                <TableCell className="text-mastra-el-5">{group.evals.length}</TableCell>
              </TableRow>
              {expandedMetrics.has(group.metricName) && (
                <>
                  <TableRow className="bg-mastra-bg-3 text-[0.7rem] text-mastra-el-3">
                    <TableCell></TableCell>
                    <TableCell className="pl-8">Timestamp</TableCell>
                    <TableCell>Score</TableCell>
                    {showTestName && <TableCell>Test Name</TableCell>}
                  </TableRow>
                  {group.evals.map((evaluation, index) => (
                    <TableRow key={`${group.metricName}-${index}`} className="bg-mastra-bg-3 text-[0.8125rem]">
                      <TableCell></TableCell>
                      <TableCell className="text-mastra-el-4 pl-8">
                        {new Date(evaluation.meta.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-mastra-el-4">{evaluation.result.score}</TableCell>
                      {showTestName && <TableCell className="text-mastra-el-4">{evaluation.meta.testName}</TableCell>}
                    </TableRow>
                  ))}
                </>
              )}
            </>
          ))
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="flex-1 relative overflow-hidden">
      <div className="flex justify-between sticky top-0 bg-mastra-bg-2 p-4">
        <Tabs defaultValue="live" className="w-full">
          <TabsList>
            <TabsTrigger value="live" className="mr-4">
              Live
            </TabsTrigger>
            <TabsTrigger value="ci">CI</TabsTrigger>
          </TabsList>
          <div className="flex justify-end my-2">
            <Button variant="outline" onClick={() => refetchEvals()}>
              {isLoading ? <RefreshCcwIcon className="w-4 h-4 animate-spin" /> : <RefreshCcwIcon className="w-4 h-4" />}
            </Button>
          </div>
          <ScrollArea className="rounded-lg h-[calc(100vh-180px)]">
            <TabsContent value="live">
              <EvalTable evaluations={liveEvals} showTestName={false} />
            </TabsContent>
            <TabsContent value="ci">
              <EvalTable evaluations={ciEvals} showTestName={true} />
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </div>
    </div>
  );
}
