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
  evals: Evals[];
};

export function AgentEvals({ agentId }: { agentId: string }) {
  const [activeTab, setActiveTab] = useState<'live' | 'ci'>('live');
  const {
    evals: liveEvals,
    isLoading: isLiveLoading,
    refetchEvals: refetchLiveEvals,
  } = useEvalsByAgentId(agentId, 'live');
  const { evals: ciEvals, isLoading: isCiLoading, refetchEvals: refetchCiEvals } = useEvalsByAgentId(agentId, 'ci');

  const handleRefresh = () => {
    if (activeTab === 'live') {
      refetchLiveEvals();
    } else {
      refetchCiEvals();
    }
  };

  return (
    <div className="flex-1 relative overflow-hidden">
      <div className="flex justify-between sticky top-0 bg-mastra-bg-2 p-4">
        <Tabs value={activeTab} onValueChange={value => setActiveTab(value as 'live' | 'ci')} className="w-full">
          <TabsList>
            <TabsTrigger value="live" className="mr-4">
              Live
            </TabsTrigger>
            <TabsTrigger value="ci">CI</TabsTrigger>
          </TabsList>
          <div className="flex justify-end my-2">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={activeTab === 'live' ? isLiveLoading : isCiLoading}
            >
              {(activeTab === 'live' ? isLiveLoading : isCiLoading) ? (
                <RefreshCcwIcon className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCcwIcon className="w-4 h-4" />
              )}
            </Button>
          </div>
          <ScrollArea className="rounded-lg h-[calc(100vh-180px)]">
            <TabsContent value="live" className="mt-0">
              <EvalTable showTestName={false} evals={liveEvals} isLoading={isLiveLoading} />
            </TabsContent>
            <TabsContent value="ci" className="mt-0">
              <EvalTable showTestName={true} evals={ciEvals} isLoading={isCiLoading} />
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </div>
    </div>
  );
}

function EvalTable({
  showTestName = false,
  evals,
  isLoading,
}: {
  showTestName: boolean;
  evals: Evals[];
  isLoading: boolean;
}) {
  const [expandedMetrics, setExpandedMetrics] = useState<Set<string>>(new Set());

  const toggleMetric = (metricName: string) => {
    const newExpanded = new Set(expandedMetrics);
    if (newExpanded.has(metricName)) {
      newExpanded.delete(metricName);
    } else {
      newExpanded.add(metricName);
    }
    setExpandedMetrics(newExpanded);
  };

  const groupEvals = (evaluations: Evals[]): GroupedEvals[] => {
    return evaluations.reduce((groups: GroupedEvals[], evaluation) => {
      const existingGroup = groups.find(g => g.metricName === evaluation.metricName);
      if (existingGroup) {
        existingGroup.evals.push(evaluation);
        existingGroup.averageScore =
          existingGroup.evals.reduce((sum, e) => sum + e.result.score, 0) / existingGroup.evals.length;
      } else {
        groups.push({
          metricName: evaluation.metricName,
          averageScore: evaluation.result.score,
          evals: [evaluation],
        });
      }
      return groups;
    }, []);
  };

  return (
    <Table>
      <TableHeader className="bg-[#171717] sticky top-0 z-10">
        <TableRow className="border-gray-6 border-b-[0.1px] text-[0.8125rem]">
          <TableHead className="w-[50px]"></TableHead>
          <TableHead className="w-[300px] text-mastra-el-3">Metric</TableHead>
          <TableHead className="w-[600px] text-mastra-el-3" />
          <TableHead className="w-[200px] text-mastra-el-3">Average Score</TableHead>
          <TableHead className="text-mastra-el-3">Total Evaluations</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className="border-b border-gray-6">
        {isLoading ? (
          <TableRow className="border-b-gray-6 border-b-[0.1px] text-[0.8125rem]">
            <TableCell className="w-[50px]">
              <Skeleton className="h-8 w-8" />
            </TableCell>
            <TableCell className="w-[400px]">
              <Skeleton className="h-8 w-full" />
            </TableCell>
            <TableCell className="w-[400px]">
              <Skeleton className="h-8 w-full" />
            </TableCell>
            <TableCell className="w-[200px]">
              <Skeleton className="h-8 w-full" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-8 w-full" />
            </TableCell>
          </TableRow>
        ) : (
          groupEvals(evals).map(group => (
            <>
              <TableRow
                key={group.metricName}
                className="border-b-gray-6 border-b-[0.1px] text-[0.8125rem] cursor-pointer hover:bg-mastra-bg-3"
                onClick={() => toggleMetric(group.metricName)}
              >
                <TableCell className="w-[50px]">
                  <div className="h-8 w-full flex items-center justify-center">
                    {expandedMetrics.has(group.metricName) ? (
                      <ChevronDown className="h-4 w-4 text-mastra-el-5" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-mastra-el-5" />
                    )}
                  </div>
                </TableCell>
                <TableCell className="w-[300px] font-medium text-mastra-el-5">{group.metricName}</TableCell>
                <TableCell className="w-[600px] text-mastra-el-5" />
                <TableCell className="w-[200px] text-mastra-el-5">{group.averageScore.toFixed(2)}</TableCell>
                <TableCell className="text-mastra-el-5">{group.evals.length}</TableCell>
              </TableRow>
              {expandedMetrics.has(group.metricName) && (
                <>
                  <TableRow className="bg-mastra-bg-3 text-[0.7rem] text-mastra-el-3">
                    <TableCell className="w-[50px]"></TableCell>
                    <TableCell className="w-[300px] pl-8">Timestamp</TableCell>
                    <TableCell className="w-[600px] pl-8">Input</TableCell>
                    <TableCell className="w-[200px]">Score</TableCell>
                    {showTestName && <TableCell>Test Name</TableCell>}
                  </TableRow>
                  {group.evals.map((evaluation, index) => (
                    <TableRow key={`${group.metricName}-${index}`} className="bg-mastra-bg-3 text-[0.8125rem]">
                      <TableCell className="w-[50px]"></TableCell>
                      <TableCell className="w-[300px] text-mastra-el-4 pl-8">
                        {new Date(evaluation.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="w-[600px] text-mastra-el-4">{evaluation.input}</TableCell>
                      <TableCell className="w-[200px] text-mastra-el-4">{evaluation.result.score}</TableCell>
                      {showTestName && (
                        <TableCell className="text-mastra-el-4">{evaluation?.testInfo?.testName}</TableCell>
                      )}
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
}
