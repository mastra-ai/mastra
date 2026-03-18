import { useState, useMemo, useCallback, useEffect } from 'react';

import { Txt } from '@/ds/components/Txt';
import { Button } from '@/ds/components/Button';
import { Searchbar } from '@/ds/components/Searchbar';

import { Badge } from '@/ds/components/Badge';
import { Icon } from '@/ds/icons/Icon';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/ds/components/Collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '@/ds/components/Dialog';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { Sparkles, Database, Award, FlaskConical, ChevronRight } from 'lucide-react';

import { useDatasets } from '@/domains/datasets/hooks/use-datasets';
import { useAgentExperiments, type AgentExperiment } from '../../hooks/use-agent-experiments';
import { useScorers } from '@/domains/scores/hooks/use-scorers';
import { useAgentEditFormContext } from '../../context/agent-edit-form-context';
import { useWatch } from 'react-hook-form';
import { CreateDatasetDialog } from '@/domains/datasets/components/create-dataset-dialog';
import { GenerateItemsDialog } from '@/domains/datasets/components/generate-items-dialog';
import { usePlaygroundModel } from '../../context/playground-model-context';
import { useDatasetMutations } from '@/domains/datasets/hooks/use-dataset-mutations';
import { useReviewQueue } from '../../context/review-queue-context';
import { useStoredAgentMutations } from '../../hooks/use-stored-agents';
import { mapScorersToApi } from '../../utils/agent-form-mappers';
import { ScorerMiniEditor } from './scorer-mini-editor';
import { DatasetDetailView } from './dataset-detail-view';
import { ScorerDetailView } from './scorer-detail-view';
import { ExperimentResultsPanel } from './agent-playground-eval';

type EvaluateView =
  | { type: 'overview' }
  | { type: 'dataset'; id: string }
  | { type: 'scorer'; id: string }
  | { type: 'new-scorer'; prefillTestItems?: Array<{ input: unknown; output: unknown; expectedDirection: 'high' | 'low' }> }
  | { type: 'edit-scorer'; id: string; scorerData: Record<string, unknown> }
  | { type: 'experiment'; id: string; datasetId: string };

interface AgentPlaygroundEvaluateProps {
  agentId: string;
  onSwitchToReview?: () => void;
  pendingScorerItems?: Array<{ input: unknown; output: unknown }> | null;
  onPendingScorerItemsConsumed?: () => void;
}

export function AgentPlaygroundEvaluate({ agentId, onSwitchToReview, pendingScorerItems, onPendingScorerItemsConsumed }: AgentPlaygroundEvaluateProps) {
  const [view, setView] = useState<EvaluateView>({ type: 'overview' });
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAttachDialog, setShowAttachDialog] = useState(false);
  const [attachDatasetSearch, setAttachDatasetSearch] = useState('');
  const [showAttachScorerDialog, setShowAttachScorerDialog] = useState(false);
  const [attachScorerSearch, setAttachScorerSearch] = useState('');
  const [generateDatasetId, setGenerateDatasetId] = useState<string | null>(null);
  const [scorerSearch, setScorerSearch] = useState('');
  const { addItems } = useReviewQueue();
  const { updateExperimentResult, updateDataset } = useDatasetMutations();
  const { provider, model } = usePlaygroundModel();
  const modelId = provider && model ? `${provider}/${model}` : '';

  // Handle pending scorer items from Review tab
  useEffect(() => {
    if (pendingScorerItems && pendingScorerItems.length > 0) {
      setView({
        type: 'new-scorer',
        prefillTestItems: pendingScorerItems.map(item => ({
          input: item.input,
          output: item.output,
          expectedDirection: 'low' as const,
        })),
      });
      onPendingScorerItemsConsumed?.();
    }
  }, [pendingScorerItems, onPendingScorerItemsConsumed]);

  const { data: datasetsData, isLoading: datasetsLoading } = useDatasets();
  const { data: scorers } = useScorers();
  const { form } = useAgentEditFormContext();
  const agentScorers = useWatch({ control: form.control, name: 'scorers' }) || {};
  const attachedScorerIds = useMemo(() => Object.keys(agentScorers), [agentScorers]);
  const { data: experiments } = useAgentExperiments(agentId, attachedScorerIds);
  const agentInstructions = useWatch({ control: form.control, name: 'instructions' });
  const agentDescription = useWatch({ control: form.control, name: 'description' });
  const agentTools = useWatch({ control: form.control, name: 'tools' });

  const agentContext = useMemo(() => ({
    description: agentDescription || undefined,
    instructions: agentInstructions || undefined,
    tools: agentTools ? Object.keys(agentTools) : undefined,
  }), [agentDescription, agentInstructions, agentTools]);

  const allDatasets = datasetsData?.datasets || [];
  // targetIds may come as a JSON string from some storage backends — normalize
  const parseTargetIds = (ids: unknown): string[] => {
    if (Array.isArray(ids)) return ids;
    if (typeof ids === 'string') { try { const p = JSON.parse(ids); return Array.isArray(p) ? p : []; } catch { return []; } }
    return [];
  };
  // Show datasets attached to this agent, plus unattached datasets
  const datasets = allDatasets.filter(ds => {
    const ids = parseTargetIds((ds as any).targetIds);
    if (ids.length === 0) return true; // unattached
    return ids.includes(agentId);
  });
  // Datasets that exist but aren't attached to this agent
  const unattachedDatasets = allDatasets.filter(ds => {
    const ids = parseTargetIds((ds as any).targetIds);
    return ids.length > 0 && !ids.includes(agentId);
  });

  const datasetExperimentMap = (experiments || []).reduce<Record<string, AgentExperiment>>((acc, exp) => {
    if (!acc[exp.datasetId] || new Date(exp.startedAt) > new Date(acc[exp.datasetId]!.startedAt)) {
      acc[exp.datasetId] = exp;
    }
    return acc;
  }, {});

  const { updateStoredAgent } = useStoredAgentMutations(agentId);

  const scorerEntries = Object.entries(scorers || {});
  const attachedScorers = scorerEntries.filter(([id]) => !!agentScorers[id]);
  const unattachedScorers = scorerEntries.filter(([id]) => !agentScorers[id]);

  const persistScorers = useCallback(async (newScorers: Record<string, any>) => {
    // Update form state
    form.setValue('scorers', newScorers, { shouldDirty: false });
    // Persist to storage via stored agent API
    try {
      await updateStoredAgent.mutateAsync({
        scorers: mapScorersToApi(newScorers),
      });
    } catch (e) {
      console.error('Failed to persist scorer change:', e);
    }
  }, [form, updateStoredAgent]);

  const attachScorer = useCallback(async (scorerId: string, scorerData: Record<string, unknown>) => {
    const current = form.getValues('scorers') || {};
    const newScorers = {
      ...current,
      [scorerId]: {
        sampling: (scorerData as any).sampling,
      },
    };
    await persistScorers(newScorers);
  }, [form, persistScorers]);

  const detachScorer = useCallback(async (scorerId: string) => {
    const current = form.getValues('scorers') || {};
    const { [scorerId]: _, ...rest } = current;
    await persistScorers(rest);
  }, [form, persistScorers]);

  const handleSendToReview = useCallback(async (selectedItems: Array<{ id: string; input: unknown; output: unknown; error: unknown; itemId: string; datasetId: string; scores?: Record<string, number>; experimentId?: string; traceId?: string }>) => {
    // Persist status to backend
    for (const item of selectedItems) {
      if (item.experimentId && item.datasetId) {
        try {
          await updateExperimentResult.mutateAsync({
            datasetId: item.datasetId,
            experimentId: item.experimentId,
            resultId: item.id,
            status: 'needs-review',
          });
        } catch {
          // Continue even if one fails
        }
      }
    }

    // Also add to local context for immediate UI
    addItems(selectedItems.map(item => ({
      id: item.id,
      itemId: item.itemId,
      input: item.input,
      output: item.output,
      error: item.error,
      scores: item.scores,
      experimentId: item.experimentId,
      datasetId: item.datasetId,
      traceId: item.traceId,
    })));
    onSwitchToReview?.();
  }, [addItems, onSwitchToReview, updateExperimentResult]);

  const handleCreateScorerFromFailures = useCallback((items: Array<{ input: unknown; output: unknown }>) => {
    setView({
      type: 'new-scorer',
      prefillTestItems: items.map(item => ({
        input: item.input,
        output: item.output,
        expectedDirection: 'low' as const,
      })),
    });
  }, []);

  const selectedExperiment = view.type === 'experiment'
    ? experiments?.find(e => e.id === view.id)
    : null;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left sidebar: Navigation */}
      <div className="w-[240px] flex-shrink-0 border-r border-border1 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1">
          <div className="p-3">
            {/* Datasets */}
            <Collapsible defaultOpen>
              <div className="flex items-center justify-between mb-2">
                <CollapsibleTrigger className="flex items-center gap-1">
                  <ChevronRight className="h-3 w-3 text-neutral3" />
                  <Txt variant="ui-xs" className="text-neutral3 font-semibold uppercase tracking-wider">
                    Datasets
                  </Txt>
                </CollapsibleTrigger>
                <div className="flex items-center gap-1">
                  {unattachedDatasets.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => setShowAttachDialog(true)}>
                      Attach
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setShowCreateDialog(true)}>
                    + New
                  </Button>
                </div>
              </div>
              <CollapsibleContent>
                {datasetsLoading ? (
                  <Txt variant="ui-xs" className="text-neutral3 px-2 py-4">Loading...</Txt>
                ) : datasets.length === 0 ? (
                  <div className="px-2 py-3 text-center">
                    <Txt variant="ui-xs" className="text-neutral3">No datasets yet</Txt>
                    <div className="mt-2">
                      <Button variant="outline" size="sm" onClick={() => setShowCreateDialog(true)}>
                        Create first dataset
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {datasets.map(ds => {
                      const exp = datasetExperimentMap[ds.id];
                      const isActive = view.type === 'dataset' && view.id === ds.id;
                      return (
                        <NavItem
                          key={ds.id}
                          isActive={isActive}
                          icon={<Database />}
                          label={ds.name}
                          onClick={() => setView({ type: 'dataset', id: ds.id })}
                          badge={exp ? <ExperimentBadge experiment={exp} /> : undefined}
                          action={
                            <button
                              type="button"
                              onClick={(e: React.MouseEvent) => {
                                e.stopPropagation();
                                setGenerateDatasetId(ds.id);
                              }}
                              className="text-neutral3 hover:text-accent1 transition-colors p-0.5"
                              title="Generate test data with AI"
                            >
                              <Icon size="sm"><Sparkles /></Icon>
                            </button>
                          }
                        />
                      );
                    })}
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>

            <div className="border-t border-border1 my-3" />

            {/* Scorers */}
            <Collapsible defaultOpen>
              <div className="flex items-center justify-between mb-2">
                <CollapsibleTrigger className="flex items-center gap-1">
                  <ChevronRight className="h-3 w-3 text-neutral3" />
                  <Txt variant="ui-xs" className="text-neutral3 font-semibold uppercase tracking-wider">
                    Scorers
                  </Txt>
                </CollapsibleTrigger>
                <div className="flex items-center gap-1">
                  {unattachedScorers.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => setShowAttachScorerDialog(true)}>
                      Attach
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setView({ type: 'new-scorer' })}>
                    + New
                  </Button>
                </div>
              </div>
              <CollapsibleContent>
                {attachedScorers.length > 3 && (
                  <div className="mb-2">
                    <Searchbar
                      size="sm"
                      placeholder="Filter scorers..."
                      label="Filter scorers"
                      onSearch={setScorerSearch}
                    />
                  </div>
                )}

                <div className="space-y-0.5">
                  {filteredScorers(attachedScorers, scorerSearch).map(([id, scorer]) => {
                    const isActive = view.type === 'scorer' && view.id === id;
                    return (
                      <NavItem
                        key={id}
                        isActive={isActive}
                        icon={<Award />}
                        label={scorer.scorer?.name || id}
                        onClick={() => setView({ type: 'scorer', id })}
                        badge={
                          scorer.source === 'code' ? (
                            <span title="Defined in code"><Badge variant="default" className="text-[9px] px-1 py-0">Code</Badge></span>
                          ) : undefined
                        }
                      />
                    );
                  })}
                  {attachedScorers.length === 0 && (
                    <div className="px-2 py-3 text-center">
                      <Txt variant="ui-xs" className="text-neutral3">No scorers attached</Txt>
                      {unattachedScorers.length > 0 && (
                        <div className="mt-2">
                          <Button variant="outline" size="sm" onClick={() => setShowAttachScorerDialog(true)}>
                            Attach a scorer
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            <div className="border-t border-border1 my-3" />

            {/* Past Experiments */}
            <Collapsible defaultOpen>
              <div className="flex items-center justify-between mb-2">
                <CollapsibleTrigger className="flex items-center gap-1">
                  <ChevronRight className="h-3 w-3 text-neutral3" />
                  <Txt variant="ui-xs" className="text-neutral3 font-semibold uppercase tracking-wider">
                    Experiments
                  </Txt>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent>
                {experiments && experiments.length > 0 ? (
                  <div className="space-y-0.5">
                    {experiments.slice(0, 10).map(exp => {
                      const isActive = view.type === 'experiment' && view.id === exp.id;
                      const ds = allDatasets.find(d => d.id === exp.datasetId);
                      return (
                        <NavItem
                          key={exp.id}
                          isActive={isActive}
                          icon={<FlaskConical />}
                          label={ds?.name || 'Unknown dataset'}
                          onClick={() => setView({ type: 'experiment', id: exp.id, datasetId: exp.datasetId })}
                          badge={<ExperimentBadge experiment={exp} />}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <Txt variant="ui-xs" className="text-neutral3 px-2">No runs yet</Txt>
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>
        </ScrollArea>
      </div>

      {/* Right: Detail view */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {view.type === 'overview' && (
          <OverviewPanel datasetsCount={datasets.length} scorersCount={scorerEntries.length} />
        )}
        {view.type === 'dataset' && (() => {
          // Look up in allDatasets — scorer datasets may not be in the agent-filtered `datasets` list
          const viewDs = allDatasets.find(d => d.id === view.id);
          return (
          <DatasetDetailView
            agentId={agentId}
            datasetId={view.id}
            datasetName={viewDs?.name || ''}
            datasetDescription={viewDs?.description || undefined}
            datasetTags={(viewDs as any)?.tags ?? []}
            datasetTargetType={(viewDs as any)?.targetType}
            datasetTargetIds={(viewDs as any)?.targetIds}
            activeScorers={Object.keys(agentScorers)}
            onGenerate={() => setGenerateDatasetId(view.id)}
            onViewExperiment={(experimentId: string) => setView({ type: 'experiment', id: experimentId, datasetId: view.id })}
          />
          );
        })()}
        {view.type === 'scorer' && (() => {
          // Include datasets linked via targetType/targetIds AND legacy metadata.datasetId
          const scorerEntry = (scorers || {})[view.id];
          const legacyDatasetId = ((scorerEntry as Record<string, unknown> | undefined)?.metadata as { datasetId?: string } | undefined)?.datasetId;
          const scorerLinkedDatasets = allDatasets.filter(ds =>
            (ds.targetType === 'scorer' && parseTargetIds((ds as any).targetIds).includes(view.id)) ||
            (legacyDatasetId && ds.id === legacyDatasetId)
          ).map(ds => ({ id: ds.id, name: ds.name }));
          return (
            <ScorerDetailView
              scorerId={view.id}
              scorerData={(scorers || {})[view.id]}
              isAttached={!!agentScorers[view.id]}
              onToggleAttach={() => {
                const scorer = (scorers || {})[view.id];
                if (scorer) {
                  if (agentScorers[view.id]) {
                    detachScorer(view.id);
                  } else {
                    attachScorer(view.id, scorer);
                  }
                }
              }}
              onEdit={() => setView({ type: 'edit-scorer', id: view.id, scorerData: (scorers || {})[view.id] || {} })}
              linkedDatasets={scorerLinkedDatasets}
              onViewDataset={(datasetId) => setView({ type: 'dataset', id: datasetId })}
            />
          );
        })()}
        {view.type === 'new-scorer' && (
          <ScorerMiniEditor
            onBack={() => setView({ type: 'overview' })}
            onSaved={() => setView({ type: 'overview' })}
            prefillTestItems={view.prefillTestItems}
          />
        )}
        {view.type === 'edit-scorer' && (
          <ScorerMiniEditor
            onBack={() => setView({ type: 'scorer', id: view.id })}
            onSaved={() => setView({ type: 'scorer', id: view.id })}
            editScorerId={view.id}
            editScorerData={view.scorerData}
          />
        )}
        {view.type === 'experiment' && selectedExperiment && (
          <ExperimentResultsPanel
            experiment={selectedExperiment}
            onBack={() => setView({ type: 'dataset', id: view.datasetId })}
            onSendToReview={handleSendToReview}
            onCreateScorer={handleCreateScorerFromFailures}
          />
        )}
      </div>

      {/* Dialogs */}
      <CreateDatasetDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        targetType="agent"
        targetIds={[agentId]}
      />
      {generateDatasetId && (
        <GenerateItemsDialog
          datasetId={generateDatasetId}
          modelId={modelId}
          agentContext={agentContext}
          onDismiss={() => setGenerateDatasetId(null)}
        />
      )}

      {/* Attach Existing Dataset dialog */}
      <Dialog open={showAttachDialog} onOpenChange={(open) => { setShowAttachDialog(open); if (!open) setAttachDatasetSearch(''); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Attach Existing Dataset</DialogTitle>
          </DialogHeader>
          <DialogBody className="max-h-[50vh] overflow-y-auto">
            {unattachedDatasets.length === 0 ? (
              <Txt variant="ui-sm" className="text-neutral3 py-4 text-center">No datasets available to attach.</Txt>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Search datasets..."
                  value={attachDatasetSearch}
                  onChange={e => setAttachDatasetSearch(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm rounded border border-border1 bg-surface2 text-text1 placeholder:text-neutral3 focus:outline-none focus:ring-1 focus:ring-accent1"
                />
                {unattachedDatasets
                  .filter(ds => !attachDatasetSearch || ds.name.toLowerCase().includes(attachDatasetSearch.toLowerCase()))
                  .map(ds => (
                  <button
                    key={ds.id}
                    type="button"
                    className="w-full text-left px-3 py-2 rounded hover:bg-surface4 transition-colors"
                    onClick={async () => {
                      try {
                        const existingIds = parseTargetIds((ds as any).targetIds);
                        await updateDataset.mutateAsync({
                          datasetId: ds.id,
                          targetType: ds.targetType || 'agent',
                          targetIds: [...existingIds, agentId],
                        });
                        toast.success(`Attached "${ds.name}" to this agent`);
                        setShowAttachDialog(false);
                      } catch (error) {
                        toast.error(`Failed to attach dataset: ${error instanceof Error ? error.message : 'Unknown error'}`);
                      }
                    }}
                  >
                    <Txt variant="ui-sm" className="font-medium">{ds.name}</Txt>
                    {ds.description && (
                      <Txt variant="ui-xs" className="text-neutral3 mt-0.5">{ds.description}</Txt>
                    )}
                  </button>
                ))}
              </div>
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>

      {/* Attach Existing Scorer dialog */}
      <Dialog open={showAttachScorerDialog} onOpenChange={(open) => { setShowAttachScorerDialog(open); if (!open) setAttachScorerSearch(''); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Attach Existing Scorer</DialogTitle>
          </DialogHeader>
          <DialogBody className="max-h-[50vh] overflow-y-auto">
            {unattachedScorers.length === 0 ? (
              <Txt variant="ui-sm" className="text-neutral3 py-4 text-center">No scorers available to attach.</Txt>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Search scorers..."
                  value={attachScorerSearch}
                  onChange={e => setAttachScorerSearch(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm rounded border border-border1 bg-surface2 text-text1 placeholder:text-neutral3 focus:outline-none focus:ring-1 focus:ring-accent1"
                />
                {unattachedScorers
                  .filter(([id, scorer]) => !attachScorerSearch || (scorer.scorer?.name || id).toLowerCase().includes(attachScorerSearch.toLowerCase()))
                  .map(([id, scorer]) => (
                  <button
                    key={id}
                    type="button"
                    className="w-full text-left px-3 py-2 rounded hover:bg-surface4 transition-colors"
                    onClick={() => {
                      attachScorer(id, scorer);
                      toast.success(`Attached "${scorer.scorer?.name || id}" to this agent`);
                      setShowAttachScorerDialog(false);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Txt variant="ui-sm" className="font-medium">{scorer.scorer?.name || id}</Txt>
                      {scorer.source === 'code' && (
                        <Badge variant="default" className="text-[9px] px-1 py-0">Code</Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Sub-components ---

function NavItem({
  isActive,
  icon,
  label,
  onClick,
  badge,
  action,
}: {
  isActive: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  badge?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left px-2 py-1.5 rounded-md transition-colors flex items-center gap-2 group',
        isActive ? 'bg-accent1/10 text-accent1' : 'hover:bg-surface3 text-neutral5',
      )}
    >
      <Icon size="sm" className={isActive ? 'text-accent1' : 'text-neutral3'}>
        {icon}
      </Icon>
      <div className="flex-1 min-w-0">
        <Txt variant="ui-xs" className="truncate block font-medium">
          {label}
        </Txt>
        {badge && <div className="mt-0.5">{badge}</div>}
      </div>
      {action && (
        <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {action}
        </div>
      )}
    </button>
  );
}

function OverviewPanel({ datasetsCount, scorersCount }: { datasetsCount: number; scorersCount: number }) {
  return (
    <div className="flex items-center justify-center h-full p-8">
      <div className="text-center max-w-md space-y-4">
        <Txt variant="ui-lg" className="text-neutral5 font-medium block">
          Evaluate
        </Txt>
        <Txt variant="ui-sm" className="text-neutral3 block">
          Select a dataset or scorer from the sidebar to view details, run experiments, and iterate on your agent&apos;s performance.
        </Txt>
        <div className="flex items-center justify-center gap-6 pt-2">
          <div className="text-center">
            <Txt variant="ui-lg" className="text-neutral5 font-semibold block">{datasetsCount}</Txt>
            <Txt variant="ui-xs" className="text-neutral3">Datasets</Txt>
          </div>
          <div className="text-center">
            <Txt variant="ui-lg" className="text-neutral5 font-semibold block">{scorersCount}</Txt>
            <Txt variant="ui-xs" className="text-neutral3">Scorers</Txt>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExperimentBadge({ experiment }: { experiment: AgentExperiment }) {
  const { status, succeededCount, totalItems } = experiment;

  if (status === 'running' || status === 'pending') {
    return <Txt variant="ui-xs" className="text-warning1">{status === 'running' ? 'Running...' : 'Pending...'}</Txt>;
  }

  if (totalItems === 0) {
    return <Txt variant="ui-xs" className="text-neutral3">No results</Txt>;
  }

  const passRate = succeededCount / totalItems;
  const colorClass = passRate >= 0.8 ? 'text-positive1' : passRate >= 0.5 ? 'text-warning1' : 'text-negative1';

  return <Txt variant="ui-xs" className={colorClass}>{succeededCount}/{totalItems} passed</Txt>;
}

function filteredScorers(entries: [string, any][], search: string) {
  if (!search) return entries;
  const q = search.toLowerCase();
  return entries.filter(([id, s]) => {
    const name = s.scorer?.name || id;
    return name.toLowerCase().includes(q);
  });
}
