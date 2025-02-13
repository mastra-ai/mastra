import { format, formatDistanceToNow } from 'date-fns';
import { AnimatePresence } from 'framer-motion';
import { ChevronRight, RefreshCcwIcon, Copy, Search, SortAsc, SortDesc } from 'lucide-react';
import React, { useState, useMemo, useCallback } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { cn } from '@/lib/utils';

import { Evals, useEvalsByAgentId } from '@/hooks/use-evals';

type SortDirection = 'asc' | 'desc';

type SortConfig = {
  field: keyof GroupedEvals | 'timestamp' | 'score';
  direction: SortDirection;
};

type GroupedEvals = {
  metricName: string;
  averageScore: number;
  evals: Evals[];
};

type CopyableCell = {
  content: string;
  label: string;
};

function CopyableContent({ content, label }: CopyableCell) {
  const handleCopy = () => {
    navigator.clipboard.writeText(content);
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="group relative flex items-center gap-2">
            <span className="truncate">{content}</span>
            <Button
              variant="ghost"
              size="sm"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={e => {
                e.stopPropagation();
                handleCopy();
              }}
              aria-label={`Copy ${label}`}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Click to copy {label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ScoreIndicator({ score }: { score: number }) {
  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'bg-green-500';
    if (score >= 0.6) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex items-center gap-2">
      <Progress value={score * 100} className={cn('w-20 h-2', getScoreColor(score))} />
      <span>{(score * 100).toFixed(0)}%</span>
    </div>
  );
}

function FormattedDate({ date }: { date: string }) {
  const formattedDate = useMemo(() => {
    const dateObj = new Date(date);
    const relativeTime = formatDistanceToNow(dateObj, { addSuffix: true });
    const fullDate = format(dateObj, 'PPpp');
    return { relativeTime, fullDate };
  }, [date]);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger className="text-left">{formattedDate.relativeTime}</TooltipTrigger>
        <TooltipContent>
          <p>{formattedDate.fullDate}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

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
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'metricName', direction: 'asc' });

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }, []);

  const toggleMetric = (metricName: string) => {
    const newExpanded = new Set(expandedMetrics);
    if (newExpanded.has(metricName)) {
      newExpanded.delete(metricName);
    } else {
      newExpanded.add(metricName);
    }
    setExpandedMetrics(newExpanded);
  };

  const toggleSort = (field: SortConfig['field']) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const getSortIcon = (field: SortConfig['field']) => {
    if (sortConfig.field !== field) return null;
    return sortConfig.direction === 'asc' ? (
      <SortAsc className="h-4 w-4 ml-1" />
    ) : (
      <SortDesc className="h-4 w-4 ml-1" />
    );
  };

  const groupEvals = (evaluations: Evals[]): GroupedEvals[] => {
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
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 p-4 bg-mastra-bg-2 rounded-lg">
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
      </div>

      <Table>
        <TableHeader className="bg-[#171717] sticky top-0 z-10">
          <TableRow className="border-gray-6 border-b-[0.1px] text-[0.8125rem]">
            <TableHead className="w-12"></TableHead>
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
        <TableBody className="border-b border-gray-6">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i} className="border-b-gray-6 border-b-[0.1px] text-[0.8125rem]">
                <TableCell className="w-12">
                  <Skeleton className="h-8 w-8 rounded-full" />
                </TableCell>
                <TableCell className="min-w-[200px]">
                  <Skeleton className="h-4 w-3/4" />
                </TableCell>
                <TableCell className="flex-1">
                  <Skeleton className="h-4 w-full" />
                </TableCell>
                <TableCell className="w-48">
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell className="w-48">
                  <Skeleton className="h-4 w-16" />
                </TableCell>
              </TableRow>
            ))
          ) : groupEvals(evals).length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-32 text-center text-mastra-el-3">
                <div className="flex flex-col items-center gap-2">
                  <Search className="h-8 w-8" />
                  <p>No evaluations found</p>
                  {searchTerm && <p className="text-sm">Try adjusting your search terms</p>}
                </div>
              </TableCell>
            </TableRow>
          ) : (
            <AnimatePresence>
              {groupEvals(evals).map(group => (
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
                      <CopyableContent content={group.metricName} label="metric name" />
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
                      <TableCell colSpan={5} className="p-0">
                        <div className="bg-mastra-bg-3 rounded-lg m-2 overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow className="text-[0.7rem] text-mastra-el-3 hover:bg-transparent">
                                <TableHead className="pl-12">Timestamp</TableHead>
                                <TableHead className="min-w-[200px]">Input</TableHead>
                                <TableHead className="min-w-[200px]">Output</TableHead>
                                <TableHead className="min-w-[200px]">Instructions</TableHead>
                                <TableHead className="w-48">Score</TableHead>
                                {showTestName && <TableHead>Test Name</TableHead>}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {group.evals.map((evaluation, index) => (
                                <TableRow
                                  key={`${group.metricName}-${index}`}
                                  className="text-[0.8125rem] hover:bg-mastra-bg-2/50"
                                >
                                  <TableCell className="pl-12 text-mastra-el-4">
                                    <FormattedDate date={evaluation.createdAt} />
                                  </TableCell>
                                  <TableCell className="text-mastra-el-4">
                                    <CopyableContent content={evaluation.input} label="input" />
                                  </TableCell>
                                  <TableCell className="text-mastra-el-4">
                                    <CopyableContent content={evaluation.output} label="output" />
                                  </TableCell>
                                  <TableCell className="text-mastra-el-4">
                                    <CopyableContent content={evaluation.instructions} label="instructions" />
                                  </TableCell>
                                  <TableCell className="text-mastra-el-4">
                                    <ScoreIndicator score={evaluation.result.score} />
                                  </TableCell>
                                  {showTestName && (
                                    <TableCell className="text-mastra-el-4">{evaluation.testInfo?.testName}</TableCell>
                                  )}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </AnimatePresence>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
