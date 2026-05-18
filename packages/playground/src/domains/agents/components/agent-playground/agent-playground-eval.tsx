import {
  Badge,
  Button,
  Checkbox,
  Chip,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
  CopyButton,
  ScrollArea,
  Spinner,
  Txt,
  Icon,
  cn,
} from '@mastra/playground-ui';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  ChevronRight,
  ArrowLeft,
  ClipboardCheck,
  Award,
  ExternalLink,
} from 'lucide-react';
import { useState } from 'react';

import type { AgentExperiment } from '../../hooks/use-agent-experiments';
import { useAgentVersions } from '../../hooks/use-agent-versions';
import { formatVersionLabel } from './format-version-label';
import { useDatasetExperimentResults, useScoresByExperimentId } from '@/domains/datasets/hooks/use-dataset-experiments';
import { TraceDialog } from '@/domains/observability/components/trace-dialog';
import { useLinkComponent } from '@/lib/framework';

function formatTimestamp(dateStr: string | Date): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ExperimentStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return (
        <Badge variant="success" className="gap-1">
          <CheckCircle className="h-3 w-3" />
          completed
        </Badge>
      );
    case 'failed':
      return (
        <Badge variant="error" className="gap-1">
          <XCircle className="h-3 w-3" />
          failed
        </Badge>
      );
    case 'running':
      return (
        <Badge variant="info" className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          running
        </Badge>
      );
    case 'pending':
      return (
        <Badge variant="default" className="gap-1">
          <Clock className="h-3 w-3" />
          pending
        </Badge>
      );
    default:
      return <Badge variant="default">{status}</Badge>;
  }
}

function formatResultValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

interface ParsedOutput {
  text: string | undefined;
  object: Record<string, unknown> | undefined;
  toolCalls: Array<{ toolName: string; args: Record<string, unknown> }>;
  toolResults: unknown[];
  usage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined;
  traceId: string | undefined;
  error: string | undefined;
}

function normalizeToolCalls(raw: unknown): ParsedOutput['toolCalls'] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap(call => {
    if (!call || typeof call !== 'object') return [];
    const c = call as Record<string, unknown>;
    return [
      {
        toolName: typeof c.toolName === 'string' ? c.toolName : 'Unknown tool',
        args: c.args && typeof c.args === 'object' && !Array.isArray(c.args) ? (c.args as Record<string, unknown>) : {},
      },
    ];
  });
}

function parseOutput(output: unknown): ParsedOutput {
  const obj = output && typeof output === 'object' ? (output as Record<string, unknown>) : {};
  return {
    text: typeof obj.text === 'string' ? obj.text : undefined,
    object: obj.object && typeof obj.object === 'object' ? (obj.object as Record<string, unknown>) : undefined,
    toolCalls: normalizeToolCalls(obj.toolCalls),
    toolResults: Array.isArray(obj.toolResults) ? obj.toolResults : [],
    usage: obj.usage && typeof obj.usage === 'object' ? (obj.usage as ParsedOutput['usage']) : undefined,
    traceId: typeof obj.traceId === 'string' ? obj.traceId : undefined,
    error: typeof obj.error === 'string' ? obj.error : obj.error ? String(obj.error) : undefined,
  };
}

function TrajectoryStepsSection({ traceId }: { traceId: string }) {
  const client = useMastraClient();
  const [isOpen, setIsOpen] = useState(false);

  const {
    data: trajectory,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['trajectory', traceId],
    queryFn: () => client.getTraceTrajectory(traceId),
    enabled: isOpen,
  });

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-purple-400 font-medium hover:text-purple-300">
        <ChevronRight className="h-3 w-3 shrink-0" />
        Trajectory Steps
      </CollapsibleTrigger>
      <CollapsibleContent>
        {isLoading ? (
          <div className="flex items-center gap-2 mt-1 px-3 py-2">
            <Spinner className="h-3 w-3" />
            <Txt variant="ui-xs" className="text-neutral3">
              Loading trajectory...
            </Txt>
          </div>
        ) : isError ? (
          <Txt variant="ui-xs" className="text-red-400 mt-1 px-3 py-2">
            Failed to load trajectory steps
          </Txt>
        ) : trajectory?.steps && trajectory.steps.length > 0 ? (
          <div className="mt-1 space-y-1">
            {trajectory.steps.map((step: Record<string, unknown>, i: number) => (
              <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-surface1 rounded text-xs">
                <Chip size="small" color="purple">
                  {String(step.stepType || 'step')}
                </Chip>
                <span className="text-neutral5 font-mono font-medium">{String(step.name || `Step ${i + 1}`)}</span>
                {typeof step.durationMs === 'number' && (
                  <span className="text-neutral2 ml-auto">{step.durationMs}ms</span>
                )}
              </div>
            ))}
            {typeof trajectory.totalDurationMs === 'number' && (
              <Txt variant="ui-xs" className="text-neutral3 px-3 py-1">
                Total: {trajectory.totalDurationMs}ms
              </Txt>
            )}
          </div>
        ) : (
          <Txt variant="ui-xs" className="text-neutral2 mt-1 px-3 py-2">
            No trajectory steps found
          </Txt>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function ResultOutputSection({
  output,
  traceId,
  onViewTrace,
}: {
  output: unknown;
  traceId?: string | null;
  onViewTrace?: (traceId: string) => void;
}) {
  const parsed = parseOutput(output);
  const effectiveTraceId = traceId || parsed.traceId;

  return (
    <div className="space-y-2">
      {/* Response text */}
      {parsed.text ? (
        <div className="space-y-1">
          <Txt variant="ui-xs" className="text-neutral3 font-medium">
            Response
          </Txt>
          <div className="text-sm text-neutral5 bg-surface1 rounded px-3 py-2 whitespace-pre-wrap wrap-break-word max-h-48 overflow-y-auto">
            {parsed.text}
          </div>
        </div>
      ) : null}

      {/* Object output (for structured generation) */}
      {parsed.object && (
        <div className="space-y-1">
          <Txt variant="ui-xs" className="text-neutral3 font-medium">
            Structured Output
          </Txt>
          <pre className="text-xs text-neutral4 bg-surface1 rounded px-3 py-2 overflow-x-auto whitespace-pre-wrap wrap-break-word max-h-48 overflow-y-auto">
            {JSON.stringify(parsed.object, null, 2)}
          </pre>
        </div>
      )}

      {/* Tool Calls */}
      {parsed.toolCalls.length > 0 && (
        <div className="space-y-1">
          <Txt variant="ui-xs" className="text-neutral3 font-medium">
            Tool Calls ({parsed.toolCalls.length})
          </Txt>
          <div className="space-y-1">
            {parsed.toolCalls.map((call, i) => (
              <Collapsible key={i}>
                <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-neutral4 hover:text-neutral5 w-full text-left px-2 py-1 rounded bg-surface1">
                  <ChevronRight className="h-3 w-3 shrink-0" />
                  <span className="font-mono font-medium">{call.toolName}</span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <pre className="text-xs text-neutral4 bg-surface2 rounded px-3 py-2 ml-4 mt-1 overflow-x-auto whitespace-pre-wrap wrap-break-word max-h-32 overflow-y-auto">
                    {JSON.stringify(call.args, null, 2)}
                  </pre>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </div>
      )}

      {/* Tool Results */}
      {parsed.toolResults.length > 0 && (
        <div className="space-y-1">
          <Txt variant="ui-xs" className="text-neutral3 font-medium">
            Tool Results ({parsed.toolResults.length})
          </Txt>
          <div className="space-y-1">
            {parsed.toolResults.map((result, i) => (
              <Collapsible key={i}>
                <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-neutral4 hover:text-neutral5 w-full text-left px-2 py-1 rounded bg-surface1">
                  <ChevronRight className="h-3 w-3 shrink-0" />
                  <span className="font-mono">Result {i + 1}</span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <pre className="text-xs text-neutral4 bg-surface2 rounded px-3 py-2 ml-4 mt-1 overflow-x-auto whitespace-pre-wrap wrap-break-word max-h-32 overflow-y-auto">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </div>
      )}

      {/* Usage stats */}
      {parsed.usage && (
        <div className="flex items-center gap-3">
          <Txt variant="ui-xs" className="text-neutral3 font-medium">
            Usage
          </Txt>
          <Txt variant="ui-xs" className="text-neutral2 font-mono">
            {parsed.usage.promptTokens} prompt · {parsed.usage.completionTokens} completion · {parsed.usage.totalTokens}{' '}
            total
          </Txt>
        </div>
      )}

      {/* Trace ID + View Trace button */}
      {effectiveTraceId && (
        <div className="flex items-center gap-2">
          <Txt variant="ui-xs" className="text-neutral3 font-medium">
            Trace
          </Txt>
          <Txt variant="ui-xs" className="text-neutral2 font-mono truncate">
            {effectiveTraceId}
          </Txt>
          <CopyButton content={effectiveTraceId} tooltip="Copy trace ID" size="sm" />
          {onViewTrace && (
            <button
              type="button"
              onClick={() => onViewTrace(effectiveTraceId)}
              className="flex items-center gap-1 text-xs text-accent1 hover:text-accent2 transition-colors cursor-pointer"
            >
              <ExternalLink className="h-3 w-3" />
              View Trace
            </button>
          )}
        </div>
      )}

      {/* Fallback if no structured content */}
      {!parsed.text && !parsed.object && parsed.toolCalls.length === 0 && (
        <div className="space-y-1">
          <Txt variant="ui-xs" className="text-neutral3 font-medium">
            Output
          </Txt>
          <pre className="text-xs text-neutral4 bg-surface1 rounded px-3 py-2 overflow-x-auto whitespace-pre-wrap wrap-break-word max-h-48 overflow-y-auto">
            {formatResultValue(output)}
          </pre>
        </div>
      )}
    </div>
  );
}

export function ExperimentResultsPanel({
  experiment,
  onBack,
  onSendToReview,
  onCreateScorer,
}: {
  experiment: AgentExperiment;
  onBack: () => void;
  onSendToReview?: (
    items: Array<{
      id: string;
      input: unknown;
      output: unknown;
      error: unknown;
      itemId: string;
      datasetId: string;
      scores?: Record<string, number>;
      experimentId?: string;
      traceId?: string;
    }>,
  ) => void;
  onCreateScorer?: (items: Array<{ input: unknown; output: unknown }>) => void;
}) {
  const client = useMastraClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewingTraceId, setViewingTraceId] = useState<string | undefined>();
  const experimentStatus = experiment.status as 'running' | 'pending' | 'completed' | 'failed';
  const {
    data: results,
    isLoading,
    setEndOfListElement,
    isFetchingNextPage,
    hasNextPage,
  } = useDatasetExperimentResults({
    datasetId: experiment.datasetId,
    experimentId: experiment.id,
    experimentStatus,
  });
  const { data: scoresByItemId } = useScoresByExperimentId(experiment.id, experimentStatus);

  const agentId = experiment.targetType === 'agent' ? experiment.targetId : '';
  const { data: agentVersionsData } = useAgentVersions({ agentId });
  const agentVersions = agentVersionsData?.versions ?? [];
  const { navigate } = useLinkComponent();

  const { data: traceData, isLoading: isLoadingTrace } = useQuery({
    queryKey: ['trace-light', viewingTraceId],
    queryFn: () => client.getTraceLight(viewingTraceId!),
    enabled: !!viewingTraceId,
  });

  const toggleItem = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllFailed = () => {
    if (!results) return;
    const failedIds = results.filter(r => Boolean(r.error)).map(r => r.id);
    setSelectedIds(new Set(failedIds));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const selectedResults = results?.filter(r => selectedIds.has(r.id)) || [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border1">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-neutral3 hover:text-neutral5 transition-colors cursor-pointer"
        >
          <Icon size="sm">
            <ArrowLeft />
          </Icon>
          <Txt variant="ui-xs">Back</Txt>
        </button>
        <div className="flex-1" />
        <ExperimentStatusBadge status={experiment.status} />
        <Txt variant="ui-xs" className="text-neutral2">
          {experiment.datasetName}
          {experiment.datasetVersion != null && ` ${formatVersionLabel('Dataset', experiment.datasetVersion)}`}
          {experiment.agentVersion &&
            (() => {
              const av = agentVersions.find(v => v.id === experiment.agentVersion);
              const label = formatVersionLabel('Agent', av ? av.versionNumber : experiment.agentVersion);
              return (
                <>
                  {' · '}
                  <button
                    type="button"
                    className="underline hover:text-neutral5 transition-colors cursor-pointer"
                    onClick={() =>
                      navigate(`/agents/${agentId}/editor?version=${encodeURIComponent(experiment.agentVersion!)}`)
                    }
                  >
                    {label}
                  </button>
                </>
              );
            })()}
          {' · '}
          {experiment.startedAt ? formatTimestamp(experiment.startedAt) : '-'}
        </Txt>
      </div>

      {/* Selection action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-surface3 border-b border-border1">
          <Txt variant="ui-xs" className="text-neutral5 font-medium">
            {selectedIds.size} selected
          </Txt>
          <div className="flex-1" />
          {onCreateScorer && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onCreateScorer(
                  selectedResults.map(r => ({
                    input: r.input,
                    output: r.output,
                  })),
                );
              }}
            >
              <Icon size="sm">
                <Award />
              </Icon>
              Create Scorer
            </Button>
          )}
          {onSendToReview && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onSendToReview(
                  selectedResults.map(r => {
                    const itemScores = scoresByItemId?.[r.itemId];
                    const scores: Record<string, number> = {};
                    if (itemScores) {
                      for (const s of itemScores) {
                        if (typeof s.score === 'number') {
                          scores[s.scorerId || 'unknown'] = s.score;
                        }
                      }
                    }
                    return {
                      id: r.id,
                      input: r.input,
                      output: r.output,
                      error: r.error,
                      itemId: r.itemId,
                      datasetId: experiment.datasetId,
                      scores,
                      experimentId: experiment.id,
                      traceId: r.traceId ?? undefined,
                    };
                  }),
                );
              }}
            >
              <Icon size="sm">
                <ClipboardCheck />
              </Icon>
              Send to Review
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={clearSelection}>
            Clear
          </Button>
        </div>
      )}

      {/* Quick filter bar */}
      {results && results.length > 0 && selectedIds.size === 0 && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border1">
          <Button variant="ghost" size="sm" onClick={selectAllFailed}>
            Select all failures
          </Button>
        </div>
      )}

      {/* Results */}
      <ScrollArea className="flex-1 min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner className="h-5 w-5" />
          </div>
        ) : !results || results.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Txt variant="ui-sm" className="text-neutral2">
              No results yet
            </Txt>
          </div>
        ) : (
          <div>
            {results.map(result => {
              const hasError = Boolean(result.error);
              const itemScores = scoresByItemId?.[result.itemId] ?? [];
              const isChecked = selectedIds.has(result.id);

              return (
                <div
                  key={result.id}
                  className={cn('border-b border-border1 px-4 py-3 space-y-2', isChecked && 'bg-surface3/50')}
                >
                  <div className="flex items-center gap-2">
                    <Checkbox checked={isChecked} onCheckedChange={() => toggleItem(result.id)} />
                    <Badge variant={hasError ? 'error' : 'success'}>{hasError ? 'Error' : 'Success'}</Badge>
                    <Txt variant="ui-xs" className="text-neutral2 font-mono">
                      {result.itemId.slice(0, 8)}
                    </Txt>
                    {itemScores.length > 0 && (
                      <div className="flex items-center gap-2 ml-auto flex-wrap">
                        {itemScores
                          .filter(s => s.entityType !== 'TRAJECTORY')
                          .map(s => (
                            <Badge key={s.scorerId} variant="default">
                              {s.scorerId}: {s.score.toFixed(3)}
                            </Badge>
                          ))}
                        {itemScores
                          .filter(s => s.entityType === 'TRAJECTORY')
                          .map(s => (
                            <Chip key={s.scorerId} size="small" color="purple">
                              {s.scorerId}: {s.score.toFixed(3)}
                            </Chip>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Trajectory Score Details */}
                  {itemScores.some(s => s.entityType === 'TRAJECTORY') && (
                    <Collapsible>
                      <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-purple-400 font-medium hover:text-purple-300">
                        <ChevronRight className="h-3 w-3 shrink-0" />
                        Trajectory Score Details
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-1 space-y-2">
                          {itemScores
                            .filter(s => s.entityType === 'TRAJECTORY')
                            .map(s => (
                              <div key={s.scorerId} className="bg-surface1 rounded px-3 py-2 space-y-1">
                                <Txt variant="ui-xs" className="text-purple-400 font-medium">
                                  {s.scorerId}
                                </Txt>
                                {s.reason && <p className="text-xs text-neutral4">{s.reason}</p>}
                                {s.preprocessStepResult && (
                                  <pre className="text-xs text-neutral3 overflow-x-auto whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                                    {JSON.stringify(s.preprocessStepResult, null, 2)}
                                  </pre>
                                )}
                              </div>
                            ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}

                  {/* Trajectory Steps (lazy-loaded) */}
                  {result.traceId && itemScores.some(s => s.entityType === 'TRAJECTORY') && (
                    <TrajectoryStepsSection traceId={result.traceId} />
                  )}

                  {/* Input */}
                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-neutral3 font-medium hover:text-neutral5">
                      <ChevronRight className="h-3 w-3 shrink-0" />
                      Input
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <pre className="text-xs text-neutral4 bg-surface1 rounded px-3 py-2 mt-1 overflow-x-auto whitespace-pre-wrap wrap-break-word max-h-32 overflow-y-auto">
                        {formatResultValue(result.input)}
                      </pre>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Output or Error */}
                  {hasError ? (
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <Txt variant="ui-xs" className="text-red-400 font-medium">
                          Error
                        </Txt>
                        <pre className="text-xs text-red-300 bg-surface1 rounded px-3 py-2 overflow-x-auto whitespace-pre-wrap wrap-break-word max-h-32 overflow-y-auto">
                          {formatResultValue(result.error)}
                        </pre>
                      </div>
                      {result.traceId && (
                        <div className="flex items-center gap-2">
                          <Txt variant="ui-xs" className="text-neutral3 font-medium">
                            Trace
                          </Txt>
                          <Txt variant="ui-xs" className="text-neutral2 font-mono truncate">
                            {result.traceId}
                          </Txt>
                          <CopyButton content={result.traceId} tooltip="Copy trace ID" size="sm" />
                          <button
                            type="button"
                            onClick={() => setViewingTraceId(result.traceId!)}
                            className="flex items-center gap-1 text-xs text-accent1 hover:text-accent2 transition-colors cursor-pointer"
                          >
                            <ExternalLink className="h-3 w-3" />
                            View Trace
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <ResultOutputSection
                      output={result.output}
                      traceId={result.traceId}
                      onViewTrace={setViewingTraceId}
                    />
                  )}
                </div>
              );
            })}
            {/* Infinite scroll sentinel */}
            <div ref={setEndOfListElement} className="h-1">
              {isFetchingNextPage && (
                <div className="flex items-center justify-center py-4">
                  <Spinner className="h-4 w-4" />
                </div>
              )}
              {!hasNextPage && results.length > 0 && (
                <div className="text-center py-2">
                  <Txt variant="ui-xs" className="text-neutral2">
                    All results loaded
                  </Txt>
                </div>
              )}
            </div>
          </div>
        )}
      </ScrollArea>

      {/* Trace Dialog */}
      <TraceDialog
        traceId={viewingTraceId}
        traceSpans={traceData?.spans}
        isOpen={!!viewingTraceId}
        onClose={() => setViewingTraceId(undefined)}
        isLoadingSpans={isLoadingTrace}
        computeTraceLink={(tid, spanId) => `/observability?traceId=${tid}${spanId ? `&spanId=${spanId}` : ''}`}
      />
    </div>
  );
}

// Note: AgentPlaygroundEval has been replaced by sidebar-based navigation in agent-playground-evaluate.tsx.
// ExperimentResultsPanel above is the only component still used externally.
