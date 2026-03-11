import { Play, CheckCircle, XCircle, Clock, Loader2, ChevronDown, ChevronRight, ArrowLeft } from 'lucide-react';
import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons/Icon';
import { Spinner } from '@/ds/components/Spinner';
import { Label } from '@/ds/components/Label';
import { Txt } from '@/ds/components/Txt';
import { Badge } from '@/ds/components/Badge';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/ds/components/Collapsible/collapsible';
import { CopyButton } from '@/ds/components/CopyButton/copy-button';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { DatasetCombobox } from '@/domains/datasets/components/dataset-combobox';
import { ScorerSelector } from '@/domains/datasets/components/experiment-trigger/scorer-selector';
import { useDatasetMutations } from '@/domains/datasets/hooks/use-dataset-mutations';
import { useMergedRequestContext } from '@/domains/request-context/context/schema-request-context';
import { useDatasetExperimentResults, useScoresByExperimentId } from '@/domains/datasets/hooks/use-dataset-experiments';
import { LLMProviders, LLMModels } from '@/domains/llm';
import { useAgentExperiments } from '../../hooks/use-agent-experiments';
import { useAgentEditFormContext } from '../../context/agent-edit-form-context';
import type { AgentExperiment } from '../../hooks/use-agent-experiments';

interface AgentPlaygroundEvalProps {
  agentId: string;
  onSaveDraft: (changeMessage?: string) => Promise<void>;
}

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

function PastRunRow({
  experiment,
  isSelected,
  onClick,
}: {
  experiment: AgentExperiment;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-4 py-3 border-b border-border1 hover:bg-surface3 transition-colors w-full text-left cursor-pointer',
        isSelected && 'bg-surface3',
      )}
    >
      <Icon size="sm" className="text-neutral3 shrink-0">
        {isSelected ? <ChevronDown /> : <ChevronRight />}
      </Icon>
      <ExperimentStatusBadge status={experiment.status} />
      <Txt variant="ui-xs" className="text-neutral2 shrink-0">
        {experiment.startedAt ? formatTimestamp(experiment.startedAt) : '-'}
      </Txt>
      <Txt variant="ui-sm" className="text-neutral5 truncate flex-1">
        {experiment.datasetName}
      </Txt>
      {experiment.status === 'completed' && (
        <Txt variant="ui-xs" className="text-neutral3 shrink-0">
          {experiment.succeededCount}/{experiment.totalItems} passed
        </Txt>
      )}
    </button>
  );
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

function ResultOutputSection({ output }: { output: unknown }) {
  const parsed = parseOutput(output);

  return (
    <div className="space-y-2">
      {/* Response text */}
      {parsed.text ? (
        <div className="space-y-1">
          <Txt variant="ui-xs" className="text-neutral3 font-medium">
            Response
          </Txt>
          <div className="text-sm text-neutral5 bg-surface1 rounded px-3 py-2 whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
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
          <pre className="text-xs text-neutral4 bg-surface1 rounded px-3 py-2 overflow-x-auto whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
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
                  <pre className="text-xs text-neutral4 bg-surface2 rounded px-3 py-2 ml-4 mt-1 overflow-x-auto whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
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
                  <pre className="text-xs text-neutral4 bg-surface2 rounded px-3 py-2 ml-4 mt-1 overflow-x-auto whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
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

      {/* Trace ID */}
      {parsed.traceId && (
        <div className="flex items-center gap-2">
          <Txt variant="ui-xs" className="text-neutral3 font-medium">
            Trace
          </Txt>
          <Txt variant="ui-xs" className="text-neutral2 font-mono truncate">
            {parsed.traceId}
          </Txt>
          <CopyButton content={parsed.traceId} tooltip="Copy trace ID" size="sm" />
        </div>
      )}

      {/* Fallback if no structured content */}
      {!parsed.text && !parsed.object && parsed.toolCalls.length === 0 && (
        <div className="space-y-1">
          <Txt variant="ui-xs" className="text-neutral3 font-medium">
            Output
          </Txt>
          <pre className="text-xs text-neutral4 bg-surface1 rounded px-3 py-2 overflow-x-auto whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
            {formatResultValue(output)}
          </pre>
        </div>
      )}
    </div>
  );
}

function ExperimentResultsPanel({ experiment, onBack }: { experiment: AgentExperiment; onBack: () => void }) {
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
          {experiment.datasetName} &middot; {experiment.startedAt ? formatTimestamp(experiment.startedAt) : '-'}
        </Txt>
      </div>

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

              return (
                <div key={result.id} className="border-b border-border1 px-4 py-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={hasError ? 'error' : 'success'}>{hasError ? 'Error' : 'Success'}</Badge>
                    <Txt variant="ui-xs" className="text-neutral2 font-mono">
                      {result.itemId.slice(0, 8)}
                    </Txt>
                    {itemScores.length > 0 && (
                      <div className="flex items-center gap-2 ml-auto">
                        {itemScores.map(s => (
                          <Badge key={s.scorerId} variant="default">
                            {s.scorerId}: {s.score.toFixed(3)}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Input */}
                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-neutral3 font-medium hover:text-neutral5">
                      <ChevronRight className="h-3 w-3 shrink-0" />
                      Input
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <pre className="text-xs text-neutral4 bg-surface1 rounded px-3 py-2 mt-1 overflow-x-auto whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                        {formatResultValue(result.input)}
                      </pre>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Output or Error */}
                  {hasError ? (
                    <div className="space-y-1">
                      <Txt variant="ui-xs" className="text-red-400 font-medium">
                        Error
                      </Txt>
                      <pre className="text-xs text-red-300 bg-surface1 rounded px-3 py-2 overflow-x-auto whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                        {formatResultValue(result.error)}
                      </pre>
                    </div>
                  ) : (
                    <ResultOutputSection output={result.output} />
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
    </div>
  );
}

export function AgentPlaygroundEval({ agentId, onSaveDraft }: AgentPlaygroundEvalProps) {
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');
  const [selectedScorers, setSelectedScorers] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const isStartingExperimentRef = useRef(false);
  const [selectedExperimentId, setSelectedExperimentId] = useState<string | null>(null);

  const { form } = useAgentEditFormContext();
  const isDirty = form.formState.isDirty;

  const [experimentProvider, setExperimentProvider] = useState(() => form.getValues('model.provider') || '');
  const [experimentModel, setExperimentModel] = useState(() => form.getValues('model.name') || '');
  const mergedRequestContext = useMergedRequestContext();

  const queryClient = useQueryClient();
  const { triggerExperiment } = useDatasetMutations();
  const { data: experiments, isLoading: isLoadingExperiments } = useAgentExperiments(agentId);

  const handleRunExperiment = useCallback(async () => {
    if (isStartingExperimentRef.current) return;

    if (!selectedDatasetId) {
      toast.error('Please select a dataset');
      return;
    }

    isStartingExperimentRef.current = true;
    setIsRunning(true);
    try {
      // Apply experiment model override to form before saving
      if (experimentProvider) {
        form.setValue('model.provider', experimentProvider);
        form.setValue('model.name', experimentModel);
      }

      // Save draft first to persist current config
      await onSaveDraft();

      // Then trigger the experiment
      const hasRequestContext = Object.keys(mergedRequestContext).length > 0;
      await triggerExperiment.mutateAsync({
        datasetId: selectedDatasetId,
        targetType: 'agent',
        targetId: agentId,
        ...(selectedScorers.length > 0 ? { scorerIds: selectedScorers } : {}),
        ...(hasRequestContext ? { requestContext: mergedRequestContext } : {}),
      });

      queryClient.invalidateQueries({ queryKey: ['agent-experiments', agentId] });
      toast.success('Experiment started');
    } catch (error) {
      toast.error(`Failed to start experiment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      isStartingExperimentRef.current = false;
      setIsRunning(false);
    }
  }, [
    selectedDatasetId,
    selectedScorers,
    agentId,
    onSaveDraft,
    triggerExperiment,
    mergedRequestContext,
    queryClient,
    experimentProvider,
    experimentModel,
    form,
  ]);

  const selectedExperiment = selectedExperimentId ? experiments?.find(e => e.id === selectedExperimentId) : null;

  // Show results panel when an experiment is selected
  if (selectedExperiment) {
    return <ExperimentResultsPanel experiment={selectedExperiment} onBack={() => setSelectedExperimentId(null)} />;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 space-y-4 border-b border-border1">
        <Txt variant="ui-sm" className="text-neutral3">
          Run your agent against a dataset to evaluate its performance. Select a dataset, choose scorers to grade the
          results, and optionally override the model. Any request context values you've set will be included
          automatically.
        </Txt>

        {/* Dataset selector */}
        <div className="grid gap-2">
          <Label>Dataset</Label>
          <DatasetCombobox
            value={selectedDatasetId}
            onValueChange={setSelectedDatasetId}
            placeholder="Select a dataset..."
            variant="outline"
            disabled={isRunning}
          />
        </div>

        {/* Scorer selector */}
        <ScorerSelector
          selectedScorers={selectedScorers}
          setSelectedScorers={setSelectedScorers}
          disabled={isRunning}
        />

        {/* Provider + Model selector (local state, not persisted to agent form) */}
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1">
            <Label>Provider</Label>
            <LLMProviders
              value={experimentProvider}
              onValueChange={value => {
                setExperimentProvider(value);
                setExperimentModel('');
              }}
            />
          </div>
          <div className="grid gap-1">
            <Label>Model</Label>
            <LLMModels llmId={experimentProvider} value={experimentModel} onValueChange={setExperimentModel} />
          </div>
        </div>

        {/* Run button */}
        <div className="flex items-center justify-end gap-3">
          {isDirty && !isRunning && (
            <Txt variant="ui-xs" className="text-neutral3">
              Current changes will be saved before running
            </Txt>
          )}
          <Button variant="cta" onClick={handleRunExperiment} disabled={!selectedDatasetId || isRunning}>
            {isRunning ? (
              <>
                <Spinner className="h-4 w-4" />
                Running...
              </>
            ) : (
              <>
                <Icon>
                  <Play />
                </Icon>
                Run Experiment
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Past runs */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border1">
          <Icon size="sm" className="text-neutral3">
            <Clock />
          </Icon>
          <Txt variant="ui-sm" className="font-medium text-neutral5">
            Past Runs
          </Txt>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          {isLoadingExperiments ? (
            <div className="flex items-center justify-center py-8">
              <Spinner className="h-5 w-5" />
            </div>
          ) : !experiments || experiments.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Txt variant="ui-sm" className="text-neutral2">
                No experiment runs yet
              </Txt>
            </div>
          ) : (
            <div>
              {experiments.map(experiment => (
                <PastRunRow
                  key={experiment.id}
                  experiment={experiment}
                  isSelected={experiment.id === selectedExperimentId}
                  onClick={() => setSelectedExperimentId(experiment.id)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
