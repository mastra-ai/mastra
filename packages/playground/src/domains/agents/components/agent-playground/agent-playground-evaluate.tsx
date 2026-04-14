import type { DatasetRecord } from '@mastra/client-js';
import {
  Badge,
  Button,
  Column,
  Columns,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  EmptyState,
  EntityList,
  EntityListSkeleton,
  Searchbar,
  Spinner,
  StatusBadge,
  Tabs,
  TabContent,
  TabList,
  Tab,
  Txt,
  Icon,
  toast,
} from '@mastra/playground-ui';
import { Database, GaugeIcon, FlaskConical, ChevronLeft, Plus, Paperclip } from 'lucide-react';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useWatch } from 'react-hook-form';
import { useAgentEditFormContext } from '../../context/agent-edit-form-context';
import { useReviewQueue } from '../../context/review-queue-context';
import { useAgentExperiments } from '../../hooks/use-agent-experiments';
import type { AgentExperiment } from '../../hooks/use-agent-experiments';
import { useStoredAgentMutations } from '../../hooks/use-stored-agents';
import { mapScorersToApi, mapInstructionBlocksToApi } from '../../utils/agent-form-mappers';
import { ExperimentResultsPanel } from './agent-playground-eval';
import { DatasetDetailView } from './dataset-detail-view';
import { formatVersionLabel } from './format-version-label';
import { ScorerDetailView } from './scorer-detail-view';
import { ScorerMiniEditor } from './scorer-mini-editor';
import { CreateDatasetDialog } from '@/domains/datasets/components/create-dataset-dialog';
import { GenerateConfigDialog, GenerateReviewDialog } from '@/domains/datasets/components/generate-items-dialog';
import { useGenerationTasks } from '@/domains/datasets/context/generation-context';
import { useDatasetMutations } from '@/domains/datasets/hooks/use-dataset-mutations';
import { useDatasets } from '@/domains/datasets/hooks/use-datasets';
import { useScorers } from '@/domains/scores/hooks/use-scorers';

type AgentEvalTab = 'experiments' | 'datasets' | 'scorers';

type DetailView =
  | null
  | { type: 'dataset'; id: string }
  | { type: 'scorer'; id: string }
  | {
      type: 'new-scorer';
      prefillTestItems?: Array<{ input: unknown; output: unknown; expectedDirection: 'high' | 'low' }>;
    }
  | { type: 'edit-scorer'; id: string; scorerData: Record<string, unknown> }
  | { type: 'experiment'; id: string; datasetId: string };

interface AgentPlaygroundEvaluateProps {
  agentId: string;
  onSwitchToReview?: () => void;
  pendingScorerItems?: Array<{ input: unknown; output: unknown }> | null;
  onPendingScorerItemsConsumed?: () => void;
}

function parseIdList(ids: unknown): string[] {
  if (Array.isArray(ids)) return ids;
  if (typeof ids === 'string') {
    try {
      const parsed = JSON.parse(ids);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // not JSON
    }
    return [ids];
  }
  return [];
}

function formatDate(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return '—';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {
  completed: 'success',
  running: 'warning',
  failed: 'error',
  pending: 'neutral',
};

export function AgentPlaygroundEvaluate({
  agentId,
  onSwitchToReview,
  pendingScorerItems,
  onPendingScorerItemsConsumed,
}: AgentPlaygroundEvaluateProps) {
  const [activeTab, setActiveTab] = useState<AgentEvalTab>('experiments');
  const [detailView, setDetailView] = useState<DetailView>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAttachDialog, setShowAttachDialog] = useState(false);
  const [attachDatasetSearch, setAttachDatasetSearch] = useState('');
  const [showAttachScorerDialog, setShowAttachScorerDialog] = useState(false);
  const [attachScorerSearch, setAttachScorerSearch] = useState('');
  const [generateDatasetId, setGenerateDatasetId] = useState<string | null>(null);
  const [reviewDatasetId, setReviewDatasetId] = useState<string | null>(null);

  // Search states for each tab
  const [experimentsSearch, setExperimentsSearch] = useState('');
  const [datasetsSearch, setDatasetsSearch] = useState('');
  const [scorersSearch, setScorersSearch] = useState('');

  const { form, isCodeAgentOverride } = useAgentEditFormContext();
  const { addItems } = useReviewQueue();

  const agentScorers = useWatch({ control: form.control, name: 'scorers' }) ?? {};
  const agentInstructions = useWatch({ control: form.control, name: 'instructions' });
  const agentDescription = useWatch({ control: form.control, name: 'description' });
  const agentTools = useWatch({ control: form.control, name: 'tools' });

  const { data: datasetsData, isLoading: isLoadingDatasets } = useDatasets();
  const allDatasets = datasetsData?.datasets ?? [];
  const { data: scorers, isLoading: isLoadingScorers } = useScorers();
  const { data: experiments, isLoading: isLoadingExperiments } = useAgentExperiments(agentId);
  const { tasks: generationTasks } = useGenerationTasks();
  const { updateDataset, updateExperimentResult } = useDatasetMutations();
  const { createStoredAgent, updateStoredAgent } = useStoredAgentMutations(agentId);

  const agentContext = useMemo(
    () => ({
      description: agentDescription || '',
      instructions: agentInstructions || '',
      tools: agentTools ? Object.keys(agentTools) : [],
    }),
    [agentDescription, agentInstructions, agentTools],
  );

  // Auto-open review dialog when generation finishes
  useEffect(() => {
    for (const [dsId, task] of Object.entries(generationTasks)) {
      if (task.status === 'review-ready' && task.items?.length) {
        setReviewDatasetId(dsId);
        break;
      }
    }
  }, [generationTasks]);

  // Handle pending scorer items from Review tab
  useEffect(() => {
    if (pendingScorerItems?.length) {
      setActiveTab('scorers');
      setDetailView({
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

  // Filter datasets to those attached to this agent
  const datasets = allDatasets.filter(ds => {
    const ids = parseIdList(ds.targetIds);
    return ids.includes(agentId);
  });

  const unattachedDatasets = allDatasets.filter(ds => {
    const ids = parseIdList(ds.targetIds);
    return !ids.includes(agentId);
  });

  const datasetExperimentMap = (experiments || []).reduce<Record<string, AgentExperiment>>((acc, exp) => {
    if (!acc[exp.datasetId] || new Date(exp.startedAt) > new Date(acc[exp.datasetId]!.startedAt)) {
      acc[exp.datasetId] = exp;
    }
    return acc;
  }, {});

  const datasetMap = useMemo(() => {
    const map = new Map<string, DatasetRecord>();
    datasets.forEach(ds => map.set(ds.id, ds));
    return map;
  }, [datasets]);

  const scorerEntries = Object.entries(scorers || {});
  const attachedScorers = scorerEntries.filter(([id]) => !!agentScorers[id]);
  const unattachedScorers = scorerEntries.filter(([id]) => !agentScorers[id]);

  // --- Scorer actions ---

  const persistScorers = useCallback(
    async (newScorers: Record<string, any>) => {
      form.setValue('scorers', newScorers, { shouldDirty: false });
      const scorersPayload = { scorers: mapScorersToApi(newScorers) };
      try {
        await updateStoredAgent.mutateAsync(scorersPayload);
      } catch (e) {
        // Update failed — likely a 404 for a code-defined agent with no stored override.
        // Create the stored override with minimum required fields + scorers.
        if (isCodeAgentOverride) {
          try {
            const values = form.getValues();
            await createStoredAgent.mutateAsync({
              id: agentId,
              name: values.name,
              instructions: mapInstructionBlocksToApi(values.instructionBlocks),
              model: values.model,
              ...scorersPayload,
            });
          } catch (createError) {
            console.error('Failed to persist scorer change:', createError);
            toast.error('Failed to save scorer changes');
          }
        } else {
          console.error('Failed to persist scorer change:', e);
          toast.error('Failed to save scorer changes');
        }
      }
    },
    [form, agentId, isCodeAgentOverride, createStoredAgent, updateStoredAgent],
  );

  const attachScorer = useCallback(
    async (scorerId: string, scorerData: Record<string, unknown>) => {
      const current = form.getValues('scorers') || {};
      const newScorers = {
        ...current,
        [scorerId]: {
          sampling: (scorerData as any).sampling,
        },
      };
      await persistScorers(newScorers);
    },
    [form, persistScorers],
  );

  const detachScorer = useCallback(
    async (scorerId: string) => {
      const current = form.getValues('scorers') || {};
      const { [scorerId]: _, ...rest } = current;
      await persistScorers(rest);
    },
    [form, persistScorers],
  );

  // --- Review actions ---

  const handleSendToReview = useCallback(
    async (
      selectedItems: Array<{
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
    ) => {
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

      addItems(
        selectedItems.map(item => ({
          id: item.id,
          itemId: item.itemId,
          input: item.input,
          output: item.output,
          error: item.error,
          scores: item.scores,
          experimentId: item.experimentId,
          datasetId: item.datasetId,
          traceId: item.traceId,
        })),
      );
      onSwitchToReview?.();
    },
    [addItems, onSwitchToReview, updateExperimentResult],
  );

  const handleCreateScorerFromFailures = useCallback((items: Array<{ input: unknown; output: unknown }>) => {
    setActiveTab('scorers');
    setDetailView({
      type: 'new-scorer',
      prefillTestItems: items.map(item => ({
        input: item.input,
        output: item.output,
        expectedDirection: 'low' as const,
      })),
    });
  }, []);

  // --- Filtered data for each tab ---

  const filteredExperiments = useMemo(() => {
    const exps = [...(experiments || [])].sort((a, b) => {
      const da = a.startedAt ? new Date(a.startedAt as string).getTime() : 0;
      const db = b.startedAt ? new Date(b.startedAt as string).getTime() : 0;
      return db - da;
    });
    if (!experimentsSearch) return exps;
    const term = experimentsSearch.toLowerCase();
    return exps.filter(exp => {
      const dsName = datasetMap.get(exp.datasetId)?.name ?? '';
      return (
        exp.id.toLowerCase().includes(term) ||
        dsName.toLowerCase().includes(term) ||
        (exp.targetId ?? '').toLowerCase().includes(term)
      );
    });
  }, [experiments, experimentsSearch, datasetMap]);

  const filteredDatasets = useMemo(() => {
    if (!datasetsSearch) return datasets;
    const term = datasetsSearch.toLowerCase();
    return datasets.filter(
      ds => ds.name.toLowerCase().includes(term) || (ds.description ?? '').toLowerCase().includes(term),
    );
  }, [datasets, datasetsSearch]);

  const filteredScorers = useMemo(() => {
    if (!scorersSearch) return attachedScorers;
    const term = scorersSearch.toLowerCase();
    return attachedScorers.filter(([id, scorer]) => {
      const name = scorer.scorer?.name || id;
      return name.toLowerCase().includes(term);
    });
  }, [attachedScorers, scorersSearch]);

  // Close detail view when switching tabs
  const handleTabChange = useCallback((tab: AgentEvalTab) => {
    setActiveTab(tab);
    setDetailView(null);
  }, []);

  // --- Detail view helpers ---

  function renderDetailPanel() {
    if (!detailView) return null;

    const backButton = (label: string, onClick: () => void) => (
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border1">
        <Button variant="ghost" size="sm" onClick={onClick}>
          <ChevronLeft className="size-4" />
          {label}
        </Button>
      </div>
    );

    if (detailView.type === 'dataset') {
      return (
        <Column withLeftSeparator>
          {backButton('Back to Datasets', () => setDetailView(null))}
          <Column.Content>
            <DatasetDetailView
              agentId={agentId}
              datasetId={detailView.id}
              datasetName={datasetMap.get(detailView.id)?.name ?? ''}
              datasetDescription={datasetMap.get(detailView.id)?.description ?? undefined}
              datasetTags={datasetMap.get(detailView.id)?.tags ?? undefined}
              datasetTargetType={datasetMap.get(detailView.id)?.targetType}
              datasetTargetIds={parseIdList(datasetMap.get(detailView.id)?.targetIds)}
              activeScorers={Object.keys(agentScorers)}
              datasetScorerIds={datasetMap.get(detailView.id)?.scorerIds ?? null}
              onGenerate={() => setGenerateDatasetId(detailView.id)}
              onViewExperiment={expId => setDetailView({ type: 'experiment', id: expId, datasetId: detailView.id })}
            />
          </Column.Content>
        </Column>
      );
    }

    if (detailView.type === 'scorer') {
      return (
        <Column withLeftSeparator>
          {backButton('Back to Scorers', () => setDetailView(null))}
          <Column.Content>
            <ScorerDetailView
              scorerId={detailView.id}
              scorerData={scorers?.[detailView.id]}
              isAttached={!!agentScorers[detailView.id]}
              onToggleAttach={async () => {
                if (agentScorers[detailView.id]) {
                  await detachScorer(detailView.id);
                } else {
                  await attachScorer(detailView.id, scorers?.[detailView.id] ?? {});
                }
              }}
              onEdit={() =>
                setDetailView({
                  type: 'edit-scorer',
                  id: detailView.id,
                  scorerData: scorers?.[detailView.id] ?? {},
                })
              }
              linkedDatasets={allDatasets.map(ds => ({ id: ds.id, name: ds.name }))}
              onViewDataset={dsId => {
                setActiveTab('datasets');
                setDetailView({ type: 'dataset', id: dsId });
              }}
            />
          </Column.Content>
        </Column>
      );
    }

    if (detailView.type === 'new-scorer') {
      return (
        <Column withLeftSeparator>
          {backButton('Back to Scorers', () => setDetailView(null))}
          <Column.Content>
            <ScorerMiniEditor
              onBack={() => setDetailView(null)}
              prefillTestItems={detailView.prefillTestItems}
              onSaved={(scorerId: string) => {
                void attachScorer(scorerId, {});
                setDetailView({ type: 'scorer', id: scorerId });
              }}
            />
          </Column.Content>
        </Column>
      );
    }

    if (detailView.type === 'edit-scorer') {
      return (
        <Column withLeftSeparator>
          {backButton('Back to Scorer', () => setDetailView({ type: 'scorer', id: detailView.id }))}
          <Column.Content>
            <ScorerMiniEditor
              onBack={() => setDetailView({ type: 'scorer', id: detailView.id })}
              editScorerId={detailView.id}
              editScorerData={detailView.scorerData}
              onSaved={() => setDetailView({ type: 'scorer', id: detailView.id })}
            />
          </Column.Content>
        </Column>
      );
    }

    if (detailView.type === 'experiment') {
      const exp = experiments?.find(e => e.id === detailView.id);
      if (!exp) {
        return (
          <Column withLeftSeparator>
            {backButton('Back to Experiments', () => setDetailView(null))}
            <Column.Content>
              <div className="p-4 text-neutral3">Experiment not found</div>
            </Column.Content>
          </Column>
        );
      }
      return (
        <Column withLeftSeparator>
          {backButton('Back to Experiments', () => setDetailView(null))}
          <Column.Content>
            <ExperimentResultsPanel
              experiment={exp}
              onBack={() => setDetailView(null)}
              onSendToReview={handleSendToReview}
              onCreateScorer={handleCreateScorerFromFailures}
            />
          </Column.Content>
        </Column>
      );
    }

    return null;
  }

  // --- Tab list rendering ---

  function renderExperimentsTab() {
    if (isLoadingExperiments) {
      return <EntityListSkeleton columns="auto 1fr auto auto auto auto auto" />;
    }

    if (!experiments?.length) {
      return (
        <div className="flex h-full items-center justify-center py-20">
          <EmptyState
            iconSlot={<FlaskConical className="size-10 text-neutral3" />}
            titleSlot="No Experiments Yet"
            descriptionSlot="Run experiments against your datasets to see results here."
          />
        </div>
      );
    }

    return (
      <EntityList columns="auto 1fr auto auto auto auto auto">
        <EntityList.Top>
          <EntityList.TopCell>Experiment</EntityList.TopCell>
          <EntityList.TopCell>Dataset</EntityList.TopCell>
          <EntityList.TopCell>Status</EntityList.TopCell>
          <EntityList.TopCell className="text-center">Items</EntityList.TopCell>
          <EntityList.TopCell className="text-center">Succeeded</EntityList.TopCell>
          <EntityList.TopCell className="text-center">Failed</EntityList.TopCell>
          <EntityList.TopCell>Date</EntityList.TopCell>
        </EntityList.Top>

        {filteredExperiments.map(exp => {
          const dsName = datasetMap.get(exp.datasetId)?.name ?? exp.datasetId.slice(0, 8);
          const status = exp.status ?? 'pending';
          const succeeded = exp.succeededCount ?? 0;
          const failed = exp.failedCount ?? 0;
          const total = exp.totalItems ?? 0;
          const successPct = total > 0 ? Math.round((succeeded / total) * 100) : 0;

          return (
            <EntityList.Row
              key={exp.id}
              selected={detailView?.type === 'experiment' && detailView.id === exp.id}
              onClick={() => setDetailView({ type: 'experiment', id: exp.id, datasetId: exp.datasetId })}
            >
              <EntityList.NameCell className="font-mono">{exp.id.slice(0, 8)}</EntityList.NameCell>
              <EntityList.TextCell>{dsName}</EntityList.TextCell>
              <EntityList.Cell>
                <StatusBadge variant={STATUS_VARIANT[status] ?? 'neutral'} withDot>
                  {status}
                </StatusBadge>
              </EntityList.Cell>
              <EntityList.TextCell className="text-center">{total}</EntityList.TextCell>
              <EntityList.TextCell className="text-center">
                <span className={succeeded > 0 ? 'text-accent1' : ''}>
                  {succeeded} ({successPct}%)
                </span>
              </EntityList.TextCell>
              <EntityList.TextCell className="text-center">
                <span className={failed > 0 ? 'text-accent2' : ''}>{failed}</span>
              </EntityList.TextCell>
              <EntityList.TextCell>{formatDate(exp.startedAt)}</EntityList.TextCell>
            </EntityList.Row>
          );
        })}
      </EntityList>
    );
  }

  function renderDatasetsTab() {
    if (isLoadingDatasets) {
      return <EntityListSkeleton columns="auto 1fr auto auto auto" />;
    }

    if (!datasets.length) {
      return (
        <div className="flex h-full items-center justify-center py-20">
          <EmptyState
            iconSlot={<Database className="size-10 text-neutral3" />}
            titleSlot="No Datasets"
            descriptionSlot="Create or attach a dataset to begin testing your agent."
          />
        </div>
      );
    }

    return (
      <EntityList columns="auto 1fr auto auto auto">
        <EntityList.Top>
          <EntityList.TopCell>Name</EntityList.TopCell>
          <EntityList.TopCell>Tags</EntityList.TopCell>
          <EntityList.TopCell>Latest Experiment</EntityList.TopCell>
          <EntityList.TopCell>Status</EntityList.TopCell>
          <EntityList.TopCell>Updated</EntityList.TopCell>
        </EntityList.Top>

        {filteredDatasets.map(ds => {
          const exp = datasetExperimentMap[ds.id];
          const genTask = generationTasks[ds.id];
          const isGenerating = genTask?.status === 'generating';

          return (
            <EntityList.Row
              key={ds.id}
              selected={detailView?.type === 'dataset' && detailView.id === ds.id}
              onClick={() => setDetailView({ type: 'dataset', id: ds.id })}
            >
              <EntityList.NameCell>{ds.name}</EntityList.NameCell>
              <EntityList.Cell>
                {ds.tags?.length ? (
                  <div className="flex gap-1">
                    {ds.tags.slice(0, 2).map(tag => (
                      <Badge key={tag} variant="default">
                        {tag}
                      </Badge>
                    ))}
                    {ds.tags.length > 2 && <Badge variant="default">+{ds.tags.length - 2}</Badge>}
                  </div>
                ) : (
                  <span className="text-neutral2">—</span>
                )}
              </EntityList.Cell>
              <EntityList.Cell>
                {exp ? <ExperimentBadge experiment={exp} /> : <span className="text-neutral2">No experiments</span>}
              </EntityList.Cell>
              <EntityList.Cell>
                {isGenerating ? (
                  <div className="flex items-center gap-1">
                    <Spinner className="size-3" />
                    <Txt variant="ui-xs" className="text-warning1">
                      Generating...
                    </Txt>
                  </div>
                ) : genTask?.error ? (
                  <Txt variant="ui-xs" className="text-negative1">
                    Failed
                  </Txt>
                ) : (
                  <span className="text-neutral2">—</span>
                )}
              </EntityList.Cell>
              <EntityList.TextCell>{formatDate(ds.updatedAt)}</EntityList.TextCell>
            </EntityList.Row>
          );
        })}
      </EntityList>
    );
  }

  function renderScorersTab() {
    if (isLoadingScorers) {
      return <EntityListSkeleton columns="auto 1fr auto auto" />;
    }

    if (!attachedScorers.length) {
      return (
        <div className="flex h-full items-center justify-center py-20">
          <EmptyState
            iconSlot={<GaugeIcon className="size-10 text-neutral3" />}
            titleSlot="No Scorers Attached"
            descriptionSlot="Attach or create a scorer to evaluate your agent's performance."
          />
        </div>
      );
    }

    return (
      <EntityList columns="auto 1fr auto auto">
        <EntityList.Top>
          <EntityList.TopCell>Name</EntityList.TopCell>
          <EntityList.TopCell>Source</EntityList.TopCell>
          <EntityList.TopCell>Description</EntityList.TopCell>
          <EntityList.TopCell>Datasets</EntityList.TopCell>
        </EntityList.Top>

        {filteredScorers.map(([id, scorer]) => {
          const name = scorer.scorer?.name || id;
          const description = scorer.scorer?.description || '';
          const source = scorer.source ?? 'stored';
          const linkedCount = allDatasets.filter(ds => {
            const scorerIds = ds.scorerIds ?? [];
            return scorerIds.includes(id);
          }).length;

          return (
            <EntityList.Row
              key={id}
              selected={detailView?.type === 'scorer' && detailView.id === id}
              onClick={() => setDetailView({ type: 'scorer', id })}
            >
              <EntityList.NameCell>
                <Icon size="sm" className="text-neutral3 mr-1.5">
                  <GaugeIcon />
                </Icon>
                {name}
              </EntityList.NameCell>
              <EntityList.Cell>
                <Badge variant={source === 'code' ? 'default' : 'success'}>{source}</Badge>
              </EntityList.Cell>
              <EntityList.TextCell className="truncate max-w-[200px]">
                {description || <span className="text-neutral2">—</span>}
              </EntityList.TextCell>
              <EntityList.TextCell>
                {linkedCount > 0 ? `${linkedCount} dataset${linkedCount > 1 ? 's' : ''}` : '—'}
              </EntityList.TextCell>
            </EntityList.Row>
          );
        })}
      </EntityList>
    );
  }

  function renderDialogs() {
    return (
      <>
        {/* Create Dataset Dialog */}
        <CreateDatasetDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} targetIds={[agentId]} />

        {/* Generate Config Dialog */}
        {generateDatasetId && (
          <GenerateConfigDialog
            datasetId={generateDatasetId}
            agentContext={agentContext}
            onDismiss={() => setGenerateDatasetId(null)}
          />
        )}

        {/* Generate Review Dialog */}
        {reviewDatasetId &&
          generationTasks[reviewDatasetId]?.status === 'review-ready' &&
          generationTasks[reviewDatasetId]?.items && (
            <GenerateReviewDialog
              datasetId={reviewDatasetId}
              items={generationTasks[reviewDatasetId]!.items!}
              modelId={generationTasks[reviewDatasetId]!.modelId}
              onDismiss={() => setReviewDatasetId(null)}
            />
          )}

        {/* Attach Existing Dataset Dialog */}
        <Dialog open={showAttachDialog} onOpenChange={setShowAttachDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Attach Existing Dataset</DialogTitle>
            </DialogHeader>
            <DialogBody className="max-h-[50vh] overflow-y-auto">
              <Searchbar onSearch={setAttachDatasetSearch} label="Search datasets" placeholder="Search datasets..." />
              {unattachedDatasets
                .filter(ds => !attachDatasetSearch || ds.name.toLowerCase().includes(attachDatasetSearch.toLowerCase()))
                .map(ds => (
                  <button
                    key={ds.id}
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-surface3 rounded-md transition-colors flex items-center justify-between"
                    onClick={async () => {
                      try {
                        await updateDataset.mutateAsync({
                          datasetId: ds.id,
                          targetIds: [...parseIdList(ds.targetIds), agentId],
                        });
                        toast.success(`Dataset "${ds.name}" attached`);
                        setShowAttachDialog(false);
                      } catch {
                        toast.error('Failed to attach dataset');
                      }
                    }}
                  >
                    <div>
                      <Txt variant="ui-sm" className="font-medium">
                        {ds.name}
                      </Txt>
                      {ds.description && (
                        <Txt variant="ui-xs" className="text-neutral3 block">
                          {ds.description}
                        </Txt>
                      )}
                    </div>
                  </button>
                ))}
              {unattachedDatasets.filter(
                ds => !attachDatasetSearch || ds.name.toLowerCase().includes(attachDatasetSearch.toLowerCase()),
              ).length === 0 && (
                <Txt variant="ui-sm" className="text-neutral3 text-center py-4 block">
                  No datasets available to attach
                </Txt>
              )}
            </DialogBody>
          </DialogContent>
        </Dialog>

        {/* Attach Existing Scorer Dialog */}
        <Dialog open={showAttachScorerDialog} onOpenChange={setShowAttachScorerDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Attach Existing Scorer</DialogTitle>
            </DialogHeader>
            <DialogBody className="max-h-[50vh] overflow-y-auto">
              <Searchbar onSearch={setAttachScorerSearch} label="Search scorers" placeholder="Search scorers..." />
              {unattachedScorers
                .filter(([id, scorer]) => {
                  if (!attachScorerSearch) return true;
                  const name = scorer.scorer?.name || id;
                  return name.toLowerCase().includes(attachScorerSearch.toLowerCase());
                })
                .map(([id, scorer]) => (
                  <button
                    key={id}
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-surface3 rounded-md transition-colors flex items-center justify-between"
                    onClick={async () => {
                      try {
                        await attachScorer(id, scorer);
                        toast.success(`Scorer "${scorer.scorer?.name || id}" attached`);
                        setShowAttachScorerDialog(false);
                      } catch {
                        toast.error('Failed to attach scorer');
                      }
                    }}
                  >
                    <div>
                      <Txt variant="ui-sm" className="font-medium">
                        {scorer.scorer?.name || id}
                      </Txt>
                      {scorer.scorer?.description && (
                        <Txt variant="ui-xs" className="text-neutral3 block">
                          {scorer.scorer.description}
                        </Txt>
                      )}
                    </div>
                  </button>
                ))}
              {unattachedScorers.filter(([id, scorer]) => {
                if (!attachScorerSearch) return true;
                const name = scorer.scorer?.name || id;
                return name.toLowerCase().includes(attachScorerSearch.toLowerCase());
              }).length === 0 && (
                <Txt variant="ui-sm" className="text-neutral3 text-center py-4 block">
                  No scorers available to attach
                </Txt>
              )}
            </DialogBody>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  const hasDetailPanel = !!detailView;

  return (
    <div className="flex h-full flex-col overflow-hidden p-4">
      <Tabs<AgentEvalTab>
        defaultTab="experiments"
        value={activeTab}
        onValueChange={handleTabChange}
        className="flex flex-col h-full overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-border1">
          <TabList className="border-b-0">
            <Tab value="experiments">Experiments</Tab>
            <Tab value="datasets">Datasets</Tab>
            <Tab value="scorers">Scorers</Tab>
          </TabList>

          {/* Tab-specific actions */}
          <div className="flex items-center gap-2">
            {activeTab === 'datasets' && (
              <>
                {unattachedDatasets.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setShowAttachDialog(true)}>
                    <Paperclip className="size-3.5 mr-1" />
                    Attach
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setShowCreateDialog(true)}>
                  <Plus className="size-3.5 mr-1" />
                  Create
                </Button>
              </>
            )}
            {activeTab === 'scorers' && (
              <>
                {unattachedScorers.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setShowAttachScorerDialog(true)}>
                    <Paperclip className="size-3.5 mr-1" />
                    Attach
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setDetailView({ type: 'new-scorer' })}>
                  <Plus className="size-3.5 mr-1" />
                  New
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Search bar below tabs */}
        <div className="py-2 border-b border-border1">
          {activeTab === 'experiments' && (
            <Searchbar onSearch={setExperimentsSearch} label="Search experiments" placeholder="Search experiments..." />
          )}
          {activeTab === 'datasets' && (
            <Searchbar onSearch={setDatasetsSearch} label="Search datasets" placeholder="Search datasets..." />
          )}
          {activeTab === 'scorers' && (
            <Searchbar onSearch={setScorersSearch} label="Search scorers" placeholder="Search scorers..." />
          )}
        </div>

        <div className="flex-1 overflow-hidden">
          <TabContent value="experiments" className="h-full overflow-hidden">
            <Columns className={hasDetailPanel && detailView?.type === 'experiment' ? 'grid-cols-[1fr_1fr]' : ''}>
              <Column>
                <Column.Content>{renderExperimentsTab()}</Column.Content>
              </Column>
              {detailView?.type === 'experiment' && renderDetailPanel()}
            </Columns>
          </TabContent>

          <TabContent value="datasets" className="h-full overflow-hidden">
            <Columns className={hasDetailPanel && detailView?.type === 'dataset' ? 'grid-cols-[1fr_1fr]' : ''}>
              <Column>
                <Column.Content>{renderDatasetsTab()}</Column.Content>
              </Column>
              {detailView?.type === 'dataset' && renderDetailPanel()}
            </Columns>
          </TabContent>

          <TabContent value="scorers" className="h-full overflow-hidden">
            <Columns
              className={
                hasDetailPanel &&
                (detailView?.type === 'scorer' ||
                  detailView?.type === 'new-scorer' ||
                  detailView?.type === 'edit-scorer')
                  ? 'grid-cols-[1fr_1fr]'
                  : ''
              }
            >
              <Column>
                <Column.Content>{renderScorersTab()}</Column.Content>
              </Column>
              {(detailView?.type === 'scorer' ||
                detailView?.type === 'new-scorer' ||
                detailView?.type === 'edit-scorer') &&
                renderDetailPanel()}
            </Columns>
          </TabContent>
        </div>
      </Tabs>

      {renderDialogs()}
    </div>
  );
}

// --- Sub-components ---

function ExperimentBadge({ experiment }: { experiment: AgentExperiment }) {
  const { status, succeededCount, totalItems } = experiment;

  const versionTags = [
    experiment.datasetVersion != null ? formatVersionLabel('Dataset', experiment.datasetVersion) : null,
    experiment.agentVersion ? formatVersionLabel('Agent', experiment.agentVersion) : null,
  ].filter(Boolean);

  const versionLine =
    versionTags.length > 0 ? (
      <Txt variant="ui-xs" className="text-neutral3">
        {versionTags.join(' · ')}
      </Txt>
    ) : null;

  if (status === 'running' || status === 'pending') {
    return (
      <div className="flex flex-col">
        <Txt variant="ui-xs" className="text-warning1">
          {status === 'running' ? 'Running...' : 'Pending...'}
        </Txt>
        {versionLine}
      </div>
    );
  }

  if (totalItems === 0) {
    return (
      <div className="flex flex-col">
        <Txt variant="ui-xs" className="text-neutral3">
          No results
        </Txt>
        {versionLine}
      </div>
    );
  }

  const passRate = succeededCount / totalItems;
  const colorClass = passRate >= 0.8 ? 'text-positive1' : passRate >= 0.5 ? 'text-warning1' : 'text-negative1';

  return (
    <div className="flex flex-col">
      <Txt variant="ui-xs" className={colorClass}>
        {succeededCount}/{totalItems} passed
      </Txt>
      {versionLine}
    </div>
  );
}
