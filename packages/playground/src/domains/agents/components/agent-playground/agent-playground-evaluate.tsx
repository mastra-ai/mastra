import type { DatasetRecord } from '@mastra/client-js';
import { Button, CreateButton } from '@mastra/playground-ui/components/Button';
import { Column, Columns } from '@mastra/playground-ui/components/Columns';
import { Combobox } from '@mastra/playground-ui/components/Combobox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@mastra/playground-ui/components/Dialog';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@mastra/playground-ui/components/InputGroup';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Tabs, TabContent, TabList, Tab } from '@mastra/playground-ui/components/Tabs';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { DatasetsIcon } from '@mastra/playground-ui/icons/DatasetsIcon';
import { ExperimentsIcon } from '@mastra/playground-ui/icons/ExperimentsIcon';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { ScorersIcon } from '@mastra/playground-ui/icons/ScorersIcon';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useQueryClient } from '@tanstack/react-query';
import {
  CircleSlashIcon,
  ChevronLeft,
  ClipboardCheck,
  ExternalLinkIcon,
  Paperclip,
  Plus,
  SearchIcon,
} from 'lucide-react';
import { useState, useMemo, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useWatch } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router';
import { useAgentEditFormContext } from '../../context/agent-edit-form-context';
import { useReviewQueue } from '../../context/review-queue-context';
import { useAgentExperiments } from '../../hooks/use-agent-experiments';
import type { AgentExperiment } from '../../hooks/use-agent-experiments';
import { useStoredAgentMutations } from '../../hooks/use-stored-agents';
import { mapScorersToApi, mapInstructionBlocksToApi } from '../../utils/agent-form-mappers';
import { AgentTopBarRunOptions } from '../agent-top-bar-controls';
import { ExperimentResultsPanel } from './agent-playground-eval';
import { AgentPlaygroundReview } from './agent-playground-review';
import { AttachButton } from './attach-button';
import { DatasetDetailView } from './dataset-detail-view';
import { RunExperimentButton } from './run-experiment-button';
import { ScorerDetailView } from './scorer-detail-view';
import { ScorerMiniEditor } from './scorer-mini-editor';
import { DatasetsList } from '@/domains/datasets/components/datasets-list/datasets-list';
import { ExperimentTriggerDialog } from '@/domains/datasets/components/experiment-trigger/experiment-trigger-dialog';
import { GenerateConfigDialog, GenerateReviewDialog } from '@/domains/datasets/components/generate-items-dialog';
import { useGenerationTasks } from '@/domains/datasets/context/generation-context';
import { useDatasetMutations } from '@/domains/datasets/hooks/use-dataset-mutations';
import { useDatasets } from '@/domains/datasets/hooks/use-datasets';
import { ExperimentsList } from '@/domains/experiments/components/experiments-list';
import { ScorersList } from '@/domains/scores/components/scorers-list/scorers-list';
import { useScorers } from '@/domains/scores/hooks/use-scorers';

type AgentEvalTab = 'experiments' | 'datasets' | 'scorers' | 'review';

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
  requestContextSchema?: string;
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

function EvaluateDocsLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button variant="ghost" as="a" href={href} target="_blank" rel="noopener noreferrer" icon={<ExternalLinkIcon />}>
      {children}
    </Button>
  );
}

export function AgentPlaygroundEvaluate({ agentId, requestContextSchema }: AgentPlaygroundEvaluateProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: AgentEvalTab =
    tabParam === 'datasets' || tabParam === 'scorers' || tabParam === 'review' ? tabParam : 'experiments';
  function setActiveTab(tab: AgentEvalTab) {
    setSearchParams(
      previous => {
        const next = new URLSearchParams(previous);
        next.set('tab', tab);
        return next;
      },
      { replace: true },
    );
  }
  const [detailView, setDetailView] = useState<DetailView>(null);
  const [showAttachDialog, setShowAttachDialog] = useState(false);
  const [attachDatasetId, setAttachDatasetId] = useState('');
  const [showAttachScorerDialog, setShowAttachScorerDialog] = useState(false);
  const [attachScorerId, setAttachScorerId] = useState('');
  const [showRunExperimentDialog, setShowRunExperimentDialog] = useState(false);
  const [generateDatasetId, setGenerateDatasetId] = useState<string | null>(null);
  const [reviewDatasetId, setReviewDatasetId] = useState<string | null>(null);

  // Search states for each tab
  const [experimentsSearch, setExperimentsSearch] = useState('');
  const [datasetsSearch, setDatasetsSearch] = useState('');
  const [scorersSearch, setScorersSearch] = useState('');

  const { form, isCodeAgentOverride } = useAgentEditFormContext();
  const { addItems } = useReviewQueue();

  const watchedScorers = useWatch({ control: form.control, name: 'scorers' });
  const agentScorers = useMemo(() => watchedScorers ?? {}, [watchedScorers]);
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

  // Filter datasets to those attached to this agent
  const datasets = allDatasets.filter(ds => {
    const ids = parseIdList(ds.targetIds);
    return ids.includes(agentId);
  });

  // Only agent-targeted or untyped datasets can be attached; workflow datasets would end up mislabeled.
  const unattachedDatasets = allDatasets.filter(ds => {
    if (ds.targetType && ds.targetType !== 'agent') return false;
    const ids = parseIdList(ds.targetIds);
    return !ids.includes(agentId);
  });

  const closeAttachDialog = () => {
    setShowAttachDialog(false);
    setAttachDatasetId('');
  };

  const closeAttachScorerDialog = () => {
    setShowAttachScorerDialog(false);
    setAttachScorerId('');
  };

  const datasetMap = useMemo(() => {
    const map = new Map<string, DatasetRecord>();
    datasets.forEach(ds => map.set(ds.id, ds));
    return map;
  }, [datasets]);

  const scorerEntries = useMemo(() => Object.entries(scorers || {}), [scorers]);
  const attachedScorers = useMemo(
    () => scorerEntries.filter(([id]) => !!agentScorers[id]),
    [scorerEntries, agentScorers],
  );
  const unattachedScorers = useMemo(
    () => scorerEntries.filter(([id]) => !agentScorers[id]),
    [scorerEntries, agentScorers],
  );

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

  const handleSendToReview = async (
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
    setActiveTab('review');
    setDetailView(null);
  };

  const handleCreateScorerFromFailures = (items: Array<{ input: unknown; output: unknown }>) => {
    setActiveTab('scorers');
    setDetailView({
      type: 'new-scorer',
      prefillTestItems: items.map(item => ({
        input: item.input,
        output: item.output,
        expectedDirection: 'low' as const,
      })),
    });
  };

  const attachedScorersRecord = useMemo(() => Object.fromEntries(attachedScorers), [attachedScorers]);

  // Close detail view when switching tabs
  const handleTabChange = (tab: AgentEvalTab) => {
    setActiveTab(tab);
    setDetailView(null);
  };

  // --- Detail view helpers ---

  function renderDetailPanel() {
    if (!detailView) return null;

    const backButton = (label: string, onClick: () => void) => (
      <div className="border-border1 flex items-center gap-2 border-b px-4 py-2">
        <Button variant="ghost" size="sm" onClick={onClick} icon={<ChevronLeft />}>
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
              <div className="text-neutral3 p-4">Experiment not found</div>
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
      return <ExperimentsList experiments={[]} isLoading />;
    }

    if (!experiments?.length) {
      return (
        <div className="flex h-full items-center justify-center">
          <EmptyState
            iconSlot={<CircleSlashIcon />}
            titleSlot="No Experiments yet"
            descriptionSlot="Run an experiment against a dataset to see results here."
            actionSlot={
              <div className="flex flex-col items-center gap-2">
                <Button variant="primary" onClick={() => setShowRunExperimentDialog(true)} icon={<Plus />}>
                  Run Experiment
                </Button>
                <EvaluateDocsLink href="https://mastra.ai/docs/evals/experiments">
                  Experiments Documentation
                </EvaluateDocsLink>
              </div>
            }
          />
        </div>
      );
    }

    return (
      <ExperimentsList
        experiments={experiments}
        datasets={datasets}
        isLoading={false}
        search={experimentsSearch}
        keyboardGlobal={false}
        selectedExperimentId={detailView?.type === 'experiment' ? detailView.id : undefined}
        onSelectExperiment={exp => {
          if (exp.datasetId) setDetailView({ type: 'experiment', id: exp.id, datasetId: exp.datasetId });
        }}
      />
    );
  }

  function renderDatasetsTab() {
    if (isLoadingDatasets) {
      return <DatasetsList datasets={[]} experiments={[]} isLoading />;
    }

    if (!datasets.length) {
      return (
        <div className="flex h-full items-center justify-center">
          <EmptyState
            iconSlot={<CircleSlashIcon />}
            titleSlot="No Datasets yet"
            descriptionSlot="Create or attach a dataset to start evaluating this agent."
            actionSlot={
              <div className="flex flex-col items-center gap-2">
                {unattachedDatasets.length > 0 ? (
                  <Button variant="primary" onClick={() => setShowAttachDialog(true)} icon={<Paperclip />}>
                    Attach Dataset
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    onClick={() =>
                      void navigate(`/datasets/new?targetType=agent&targetIds=${encodeURIComponent(agentId)}`)
                    }
                    icon={<Plus />}
                  >
                    Create Dataset
                  </Button>
                )}
                <EvaluateDocsLink href="https://mastra.ai/docs/evals/datasets">Datasets Documentation</EvaluateDocsLink>
              </div>
            }
          />
        </div>
      );
    }

    return (
      <DatasetsList
        datasets={datasets}
        experiments={experiments ?? []}
        isLoading={false}
        search={datasetsSearch}
        keyboardGlobal={false}
        selectedDatasetId={detailView?.type === 'dataset' ? detailView.id : undefined}
        onSelectDataset={ds => setDetailView({ type: 'dataset', id: ds.id })}
        renderTrailingCell={ds => {
          const genTask = generationTasks[ds.id];
          if (genTask?.status === 'generating') {
            return (
              <div className="flex items-center gap-1">
                <Spinner className="size-3" />
                <Txt variant="ui-xs" className="text-warning1">
                  Generating...
                </Txt>
              </div>
            );
          }
          if (genTask?.error) {
            return (
              <Txt variant="ui-xs" className="text-negative1">
                Failed
              </Txt>
            );
          }
          return null;
        }}
      />
    );
  }

  function renderScorersTab() {
    if (isLoadingScorers) {
      return <ScorersList scorers={{}} isLoading />;
    }

    if (!attachedScorers.length) {
      return (
        <div className="flex h-full items-center justify-center">
          <EmptyState
            iconSlot={<CircleSlashIcon />}
            titleSlot="No Scorers yet"
            descriptionSlot={
              isCodeAgentOverride
                ? 'Attaching scorers from Studio is only available for agents created in the editor. Configure scorers for this agent in code.'
                : "Attach or create a scorer to evaluate this agent's responses."
            }
            actionSlot={
              <div className="flex flex-col items-center gap-2">
                {isCodeAgentOverride ? null : unattachedScorers.length > 0 ? (
                  <Button variant="primary" onClick={() => setShowAttachScorerDialog(true)} icon={<Paperclip />}>
                    Attach Scorer
                  </Button>
                ) : (
                  <Button variant="primary" onClick={() => setDetailView({ type: 'new-scorer' })} icon={<Plus />}>
                    Create Scorer
                  </Button>
                )}
                <EvaluateDocsLink href="https://mastra.ai/docs/evals/overview">Scorers Documentation</EvaluateDocsLink>
              </div>
            }
          />
        </div>
      );
    }

    return (
      <ScorersList
        scorers={attachedScorersRecord}
        isLoading={false}
        search={scorersSearch}
        keyboardGlobal={false}
        selectedScorerId={detailView?.type === 'scorer' ? detailView.id : undefined}
        onSelectScorer={scorer => setDetailView({ type: 'scorer', id: scorer.id })}
      />
    );
  }

  function renderDialogs() {
    return (
      <>
        {showRunExperimentDialog && (
          <ExperimentTriggerDialog
            open
            onOpenChange={setShowRunExperimentDialog}
            initialTargetType="agent"
            initialTargetId={agentId}
            onSuccess={() => void queryClient.invalidateQueries({ queryKey: ['agent-experiments', agentId] })}
          />
        )}

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
        <Dialog open={showAttachDialog} onOpenChange={open => (open ? setShowAttachDialog(true) : closeAttachDialog())}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Attach Existing Dataset</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <Combobox
                options={unattachedDatasets.map(ds => ({
                  value: ds.id,
                  label: ds.name,
                  description: ds.description ?? undefined,
                }))}
                value={attachDatasetId}
                onValueChange={setAttachDatasetId}
                placeholder="Select a dataset..."
                searchPlaceholder="Search datasets..."
                emptyText="No datasets available to attach"
                className="w-full"
              />
            </DialogBody>
            <DialogFooter>
              <Button onClick={closeAttachDialog}>Cancel</Button>
              <Button
                variant="primary"
                icon={<Paperclip />}
                disabled={!attachDatasetId || updateDataset.isPending}
                onClick={async () => {
                  const ds = unattachedDatasets.find(item => item.id === attachDatasetId);
                  if (!ds) return;
                  try {
                    await updateDataset.mutateAsync({
                      datasetId: ds.id,
                      // Classify legacy/untyped datasets without overwriting existing target types.
                      targetType: ds.targetType ?? 'agent',
                      targetIds: [...parseIdList(ds.targetIds), agentId],
                    });
                    toast.success(`Dataset "${ds.name}" attached`);
                    closeAttachDialog();
                  } catch {
                    toast.error('Failed to attach dataset');
                  }
                }}
              >
                Attach
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Attach Existing Scorer Dialog */}
        <Dialog
          open={showAttachScorerDialog}
          onOpenChange={open => (open ? setShowAttachScorerDialog(true) : closeAttachScorerDialog())}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Attach Existing Scorer</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <Combobox
                options={unattachedScorers.map(([id, scorer]) => ({
                  value: id,
                  label: scorer.scorer?.name || id,
                  description: scorer.scorer?.description ?? undefined,
                }))}
                value={attachScorerId}
                onValueChange={setAttachScorerId}
                placeholder="Select a scorer..."
                searchPlaceholder="Search scorers..."
                emptyText="No scorers available to attach"
                className="w-full"
              />
            </DialogBody>
            <DialogFooter>
              <Button onClick={closeAttachScorerDialog}>Cancel</Button>
              <Button
                variant="primary"
                icon={<Paperclip />}
                disabled={!attachScorerId || updateStoredAgent.isPending || createStoredAgent.isPending}
                onClick={async () => {
                  const entry = unattachedScorers.find(([id]) => id === attachScorerId);
                  if (!entry) return;
                  const [id, scorer] = entry;
                  try {
                    await attachScorer(id, scorer);
                    toast.success(`Scorer "${scorer.scorer?.name || id}" attached`);
                    closeAttachScorerDialog();
                  } catch {
                    toast.error('Failed to attach scorer');
                  }
                }}
              >
                Attach
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  const hasDetailPanel = !!detailView;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Tabs<AgentEvalTab>
        defaultTab="experiments"
        value={activeTab}
        onValueChange={handleTabChange}
        className="flex h-full flex-col overflow-hidden"
      >
        {/* Same spacing as PageLayout.TopArea (p-4 / pb-3) so the tabs line up with the traces toolbar. */}
        <div className="flex items-center justify-between gap-x-2 px-4 pt-4 pb-3">
          <TabList variant="pill-ghost" className="min-w-0 flex-nowrap overflow-x-auto">
            <Tab value="experiments">
              <Icon size="sm">
                <ExperimentsIcon />
              </Icon>
              Experiments
            </Tab>
            <Tab value="datasets">
              <Icon size="sm">
                <DatasetsIcon />
              </Icon>
              Datasets
            </Tab>
            <Tab value="scorers">
              <Icon size="sm">
                <ScorersIcon />
              </Icon>
              Scorers
            </Tab>
            <Tab value="review">
              <Icon size="sm">
                <ClipboardCheck />
              </Icon>
              Review
            </Tab>
          </TabList>

          {/* Tab-specific actions */}
          <div className="ml-auto flex shrink-0 items-center gap-2 whitespace-nowrap">
            {activeTab === 'experiments' && !!experiments?.length && (
              <RunExperimentButton onClick={() => setShowRunExperimentDialog(true)} />
            )}
            {activeTab === 'datasets' && (
              <>
                <CreateButton
                  variant="ghost"
                  size="sm"
                  tooltip="Create a dataset"
                  onClick={() =>
                    void navigate(`/datasets/new?targetType=agent&targetIds=${encodeURIComponent(agentId)}`)
                  }
                >
                  New dataset
                </CreateButton>
                {unattachedDatasets.length > 0 && (
                  <AttachButton tooltip="Attach an existing dataset" onClick={() => setShowAttachDialog(true)} />
                )}
              </>
            )}
            {activeTab === 'scorers' && !isCodeAgentOverride && (
              <>
                <CreateButton
                  variant="ghost"
                  size="sm"
                  tooltip="Create a scorer"
                  onClick={() => setDetailView({ type: 'new-scorer' })}
                >
                  New scorer
                </CreateButton>
                {unattachedScorers.length > 0 && (
                  <AttachButton tooltip="Attach an existing scorer" onClick={() => setShowAttachScorerDialog(true)} />
                )}
              </>
            )}
            <AgentTopBarRunOptions requestContextSchema={requestContextSchema} />
          </div>
        </div>

        {/* Search bar below tabs */}
        {activeTab !== 'review' && (
          <div className="px-4 pb-3">
            {activeTab === 'experiments' && (
              <InputGroup variant="outline">
                <InputGroupAddon align="inline-start">
                  <SearchIcon />
                </InputGroupAddon>
                <InputGroupInput
                  type="search"
                  aria-label="Search experiments"
                  placeholder="Search experiments..."
                  value={experimentsSearch}
                  onChange={event => setExperimentsSearch(event.target.value)}
                />
              </InputGroup>
            )}
            {activeTab === 'datasets' && (
              <InputGroup variant="outline">
                <InputGroupAddon align="inline-start">
                  <SearchIcon />
                </InputGroupAddon>
                <InputGroupInput
                  type="search"
                  aria-label="Search datasets"
                  placeholder="Search datasets..."
                  value={datasetsSearch}
                  onChange={event => setDatasetsSearch(event.target.value)}
                />
              </InputGroup>
            )}
            {activeTab === 'scorers' && (
              <InputGroup variant="outline">
                <InputGroupAddon align="inline-start">
                  <SearchIcon />
                </InputGroupAddon>
                <InputGroupInput
                  type="search"
                  aria-label="Search scorers"
                  placeholder="Search scorers..."
                  value={scorersSearch}
                  onChange={event => setScorersSearch(event.target.value)}
                />
              </InputGroup>
            )}
          </div>
        )}

        <div className="flex-1 overflow-hidden px-4 pb-4">
          <TabContent value="review" className="h-full overflow-hidden py-0">
            <AgentPlaygroundReview agentId={agentId} onCreateScorer={handleCreateScorerFromFailures} />
          </TabContent>
          <TabContent value="experiments" className="h-full overflow-hidden py-0">
            <Columns className={hasDetailPanel && detailView?.type === 'experiment' ? 'grid-cols-[1fr_1fr]' : ''}>
              <Column>
                <Column.Content
                  className={!isLoadingExperiments && !experiments?.length ? 'content-stretch' : undefined}
                >
                  {renderExperimentsTab()}
                </Column.Content>
              </Column>
              {detailView?.type === 'experiment' && renderDetailPanel()}
            </Columns>
          </TabContent>

          <TabContent value="datasets" className="h-full overflow-hidden py-0">
            <Columns className={hasDetailPanel && detailView?.type === 'dataset' ? 'grid-cols-[1fr_1fr]' : ''}>
              <Column>
                <Column.Content className={!isLoadingDatasets && !datasets.length ? 'content-stretch' : undefined}>
                  {renderDatasetsTab()}
                </Column.Content>
              </Column>
              {detailView?.type === 'dataset' && renderDetailPanel()}
            </Columns>
          </TabContent>

          <TabContent value="scorers" className="h-full overflow-hidden py-0">
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
                <Column.Content
                  className={!isLoadingScorers && !attachedScorers.length ? 'content-stretch' : undefined}
                >
                  {renderScorersTab()}
                </Column.Content>
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
