import { ChevronRight, RefreshCcwIcon, Search, SortAsc, SortDesc } from 'lucide-react';
import React, { createContext, useContext, useState, useEffect } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CopyableContent } from '@/components/ui/copyable-content';
import { FormattedDate } from '@/components/ui/formatted-date';
import { Input } from '@/components/ui/input';
import { ScoreIndicator } from '@/components/ui/score-indicator';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableHead, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { cn } from '@/lib/utils';

import type { Evals } from '@/hooks/use-evals';
import { useEvalsByAgentId } from '@/hooks/use-evals';

import { AnimatePresence } from 'motion/react';

type SortDirection = 'asc' | 'desc';

type SortConfig = {
  field: keyof GroupedEvals | 'timestamp' | 'score';
  direction: SortDirection;
};

type AgentEvalsContextType = {
  handleRefresh: () => void;
  isLoading: boolean;
};

const AgentEvalsContext = createContext<AgentEvalsContextType>({ handleRefresh: () => {}, isLoading: true });

type GroupedEvals = {
  metricName: string;
  averageScore: number;
  evals: Evals[];
};

const scrollableContentClass = cn(
  'relative overflow-y-auto overflow-x-hidden invisible hover:visible focus:visible',
  '[&::-webkit-scrollbar]:w-1',
  '[&::-webkit-scrollbar-track]:bg-transparent',
  '[&::-webkit-scrollbar-thumb]:rounded-full',
  '[&::-webkit-scrollbar-thumb]:bg-mastra-border/20',
  '[&>*]:visible',
);

const tabIndicatorClass = cn(
  'px-4 py-2 text-sm transition-all border-b-2 border-transparent',
  'data-[state=active]:border-white data-[state=active]:text-white font-medium',
  'data-[state=inactive]:text-mastra-el-4 hover:data-[state=inactive]:text-mastra-el-2',
  'focus-visible:outline-none',
);

const tabContentClass = cn('data-[state=inactive]:mt-0 min-h-0 h-full grid grid-rows-[1fr]');

export function AgentEvals({ agentId, baseUrl }: { agentId: string; baseUrl?: string }) {
  const [activeTab, setActiveTab] = useState<'live' | 'ci'>('live');
  const {
    evals: liveEvals,
    isLoading: isLiveLoading,
    refetchEvals: refetchLiveEvals,
  } = useEvalsByAgentId(agentId, 'live', baseUrl);
  const {
    evals: ciEvals,
    isLoading: isCiLoading,
    refetchEvals: refetchCiEvals,
  } = useEvalsByAgentId(agentId, 'ci', baseUrl);

  const contextValue = {
    handleRefresh,
    isLoading: activeTab === 'live' ? isLiveLoading : isCiLoading,
  };

  function handleRefresh() {
    if (activeTab === 'live') {
      refetchLiveEvals();
    } else {
      refetchCiEvals();
    }
  }

  return (
    <AgentEvalsContext.Provider value={contextValue}>
      <Tabs
        value={activeTab}
        onValueChange={value => setActiveTab(value as 'live' | 'ci')}
        className="grid grid-rows-[auto_1fr] h-full min-h-0 pb-2"
      >
        <div className="border-b border-mastra-border/10">
          <TabsList className="bg-transparent border-0 h-auto mx-4">
            <TabsTrigger value="live" className={tabIndicatorClass}>
              Live
            </TabsTrigger>
            <TabsTrigger value="ci" className={tabIndicatorClass}>
              CI
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="live" className={tabContentClass}>
          <EvalTable evals={liveEvals} isCIMode={false} />
        </TabsContent>
        <TabsContent value="ci" className={tabContentClass}>
          <EvalTable evals={ciEvals} isCIMode={true} />
        </TabsContent>
      </Tabs>
    </AgentEvalsContext.Provider>
  );
}

function EvalTable({ evals, isCIMode = false }: { evals: Evals[]; isCIMode?: boolean }) {
  const { handleRefresh, isLoading: isTableLoading } = useContext(AgentEvalsContext);
  const [expandedMetrics, setExpandedMetrics] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'metricName', direction: 'asc' });

  return (
    <div className="min-h-0 grid grid-rows-[auto_1fr]">
      <div className="flex items-center gap-4 p-4 rounded-lg">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-mastra-el-3" />
          <Input
            id="search-input"
            placeholder="Search metrics, inputs, or outputs..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Badge variant="secondary" className="text-xs">
          {evals.length} Total Evaluations
        </Badge>
        <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={isTableLoading} className="h-9 w-9">
          {isTableLoading ? (
            <RefreshCcwIcon className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCcwIcon className="h-4 w-4" />
          )}
        </Button>
      </div>

      <div className="overflow-auto">
        <Table className="w-full">
          <TableHeader className="bg-mastra-bg-2 h-[var(--table-header-height)] sticky top-0 z-10">
            <TableRow className="border-gray-6 border-b-[0.1px] text-[0.8125rem]">
              <TableHead className="w-12 h-12"></TableHead>
              <TableHead
                className="min-w-[200px] max-w-[30%] text-mastra-el-3 cursor-pointer"
                onClick={() => toggleSort('metricName')}
              >
                <div className="flex items-center">Metric {getSortIcon('metricName')}</div>
              </TableHead>
              <TableHead className="flex-1 text-mastra-el-3" />
              <TableHead className="w-48 text-mastra-el-3 cursor-pointer" onClick={() => toggleSort('averageScore')}>
                <div className="flex items-center">Average Score {getSortIcon('averageScore')}</div>
              </TableHead>
              <TableHead className="w-48 text-mastra-el-3">Evaluations</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="border-b border-gray-6 relative">
            <AnimatePresence mode="wait" presenceAffectsLayout={false}>
              {isTableLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i} className="border-b-gray-6 border-b-[0.1px] text-[0.8125rem]">
                    <TableCell className="w-12 h-12">
                      <Skeleton className="h-8 w-8 rounded-full" />
                    </TableCell>
                    <TableCell className="min-w-[200px] max-w-[30%]">
                      <Skeleton className="h-4 w-3/4" />
                    </TableCell>
                    <TableCell className="flex-1">
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                    <TableCell className="w-48">
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell className="w-48">
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                  </TableRow>
                ))
              ) : groupEvals(evals).length === 0 ? (
                <TableRow>
                  <TableCell className="h-12 w-16"></TableCell>
                  <TableCell colSpan={4} className="h-32 px-4 text-center text-mastra-el-3">
                    <div className="flex flex-col items-center gap-2">
                      <Search className="size-5" />
                      <p>No evaluations found</p>
                      {searchTerm && <p className="text-sm">Try adjusting your search terms</p>}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                groupEvals(evals).map(group => (
                  <React.Fragment key={group.metricName}>
                    <TableRow
                      className="border-b-gray-6 border-b-[0.1px] text-[0.8125rem] cursor-pointer hover:bg-mastra-bg-3"
                      onClick={() => toggleMetric(group.metricName)}
                    >
                      <TableCell className="w-12">
                        <div className="h-8 w-full flex items-center justify-center">
                          <div
                            className={cn(
                              'transform transition-transform duration-200',
                              expandedMetrics.has(group.metricName) ? 'rotate-90' : '',
                            )}
                          >
                            <ChevronRight className="h-4 w-4 text-mastra-el-5" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[200px] max-w-[30%] font-medium text-mastra-el-5">
                        {group.metricName}
                      </TableCell>
                      <TableCell className="flex-1 text-mastra-el-5" />
                      <TableCell className="w-48 text-mastra-el-5">
                        <ScoreIndicator score={group.averageScore} />
                      </TableCell>
                      <TableCell className="w-48 text-mastra-el-5">
                        <Badge variant="secondary">{group.evals.length}</Badge>
                      </TableCell>
                    </TableRow>

                    {expandedMetrics.has(group.metricName) && (
                      <TableRow>
                        <TableCell
                          colSpan={5 + (getHasReasons(group.evals) ? 1 : 0) + (isCIMode ? 1 : 0)}
                          className="p-0"
                        >
                          <div className="bg-mastra-bg-3 rounded-lg m-2">
                            <div className="w-full">
                              <Table className="w-full">
                                <TableHeader>
                                  <TableRow className="text-[0.7rem] text-mastra-el-3 hover:bg-transparent">
                                    <TableHead className="pl-12 w-[120px]">Timestamp</TableHead>
                                    <TableHead className="w-[300px]">Instructions</TableHead>
                                    <TableHead className="w-[300px]">Input</TableHead>
                                    <TableHead className="w-[300px]">Output</TableHead>
                                    <TableHead className="w-[80px]">Score</TableHead>
                                    {getHasReasons(group.evals) && <TableHead className="w-[250px]">Reason</TableHead>}
                                    {isCIMode && <TableHead className="w-[120px]">Test Name</TableHead>}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {group.evals.map((evaluation, index) => (
                                    <TableRow
                                      key={`${group.metricName}-${index}`}
                                      className="text-[0.8125rem] hover:bg-mastra-bg-2/50"
                                    >
                                      <TableCell className="pl-12 text-mastra-el-4 align-top py-4">
                                        <FormattedDate date={evaluation.createdAt} />
                                      </TableCell>
                                      <TableCell className="text-mastra-el-4 align-top py-4">
                                        <div className={cn('max-w-[300px] max-h-[200px]', scrollableContentClass)}>
                                          <CopyableContent
                                            content={evaluation.instructions}
                                            label="instructions"
                                            multiline
                                          />
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-mastra-el-4 align-top py-4">
                                        <div className={cn('max-w-[300px] max-h-[200px]', scrollableContentClass)}>
                                          <CopyableContent content={evaluation.input} label="input" multiline />
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-mastra-el-4 align-top py-4">
                                        <div className={cn('max-w-[300px] max-h-[200px]', scrollableContentClass)}>
                                          <CopyableContent content={evaluation.output} label="output" multiline />
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-mastra-el-4 align-top py-4">
                                        <ScoreIndicator score={evaluation.result.score} />
                                      </TableCell>
                                      {getHasReasons(group.evals) && (
                                        <TableCell className="text-mastra-el-4 align-top py-4">
                                          <div className={cn('max-w-[300px] max-h-[200px]', scrollableContentClass)}>
                                            <CopyableContent
                                              content={evaluation.result.info?.reason || ''}
                                              label="reason"
                                              multiline
                                            />
                                          </div>
                                        </TableCell>
                                      )}
                                      {isCIMode && (
                                        <TableCell className="text-mastra-el-4 align-top py-4">
                                          {evaluation.testInfo?.testName && (
                                            <Badge variant="secondary" className="text-xs">
                                              {evaluation.testInfo.testName}
                                            </Badge>
                                          )}
                                        </TableCell>
                                      )}
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))
              )}
            </AnimatePresence>
          </TableBody>
        </Table>
      </div>
    </div>
  );

  function getHasReasons(groupEvals: Evals[]) {
    return groupEvals.some(eval_ => eval_.result.info?.reason);
  }

  function toggleMetric(metricName: string) {
    const newExpanded = new Set(expandedMetrics);
    if (newExpanded.has(metricName)) {
      newExpanded.delete(metricName);
    } else {
      newExpanded.add(metricName);
    }
    setExpandedMetrics(newExpanded);
  }

  function toggleSort(field: SortConfig['field']) {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  }

  function getSortIcon(field: SortConfig['field']) {
    if (sortConfig.field !== field) return null;
    return sortConfig.direction === 'asc' ? (
      <SortAsc className="h-4 w-4 ml-1" />
    ) : (
      <SortDesc className="h-4 w-4 ml-1" />
    );
  }

  function groupEvals(evaluations: Evals[]): GroupedEvals[] {
    let groups = evaluations.reduce((groups: GroupedEvals[], evaluation) => {
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

    // Apply search filter
    if (searchTerm) {
      groups = groups.filter(
        group =>
          group.metricName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          group.evals.some(
            metric =>
              metric.input?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              metric.output?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              metric.instructions?.toLowerCase().includes(searchTerm.toLowerCase()),
          ),
      );
    }

    // Apply sorting
    groups.sort((a, b) => {
      const direction = sortConfig.direction === 'asc' ? 1 : -1;
      switch (sortConfig.field) {
        case 'metricName':
          return direction * a.metricName.localeCompare(b.metricName);
        case 'averageScore':
          return direction * (a.averageScore - b.averageScore);
        default:
          return 0;
      }
    });

    return groups;
  }
}
