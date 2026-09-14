import { Button, CreateButton } from '@mastra/playground-ui/components/Button';
import { Combobox } from '@mastra/playground-ui/components/Combobox';
import type { ComboboxOption } from '@mastra/playground-ui/components/Combobox';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@mastra/playground-ui/components/InputGroup';
import { Kbd } from '@mastra/playground-ui/components/Kbd';
import { Tabs, TabContent, TabList, Tab } from '@mastra/playground-ui/components/Tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { DatasetsIcon } from '@mastra/playground-ui/icons/DatasetsIcon';
import { ExperimentsIcon } from '@mastra/playground-ui/icons/ExperimentsIcon';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { ScorersIcon } from '@mastra/playground-ui/icons/ScorersIcon';
import { useKeydown } from '@mastra/playground-ui/keyboard/use-keydown';
import { toast } from '@mastra/playground-ui/utils/toast';
import { ClipboardCheck, Paperclip, Play, SearchIcon } from 'lucide-react';
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useWatch } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router';
import { isAgentEvalTab, type AgentEvalTab } from '../../agent-evals-link';
import { useAgentEditFormContext } from '../../context/agent-edit-form-context';
import { useAgentExperiments } from '../../hooks/use-agent-experiments';
import { useStoredAgentMutations } from '../../hooks/use-stored-agents';
import { mapScorersToApi, mapInstructionBlocksToApi } from '../../utils/agent-form-mappers';
import { AgentTopBarRunOptions } from '../agent-top-bar-controls';
import { DatasetsList } from '@/domains/datasets/components/datasets-list/datasets-list';
import { NoDatasetsInfo } from '@/domains/datasets/components/datasets-list/no-datasets-info';
import { ExperimentTriggerDialog } from '@/domains/datasets/components/experiment-trigger/experiment-trigger-dialog';
import { useDatasetMutations } from '@/domains/datasets/hooks/use-dataset-mutations';
import { useDatasets } from '@/domains/datasets/hooks/use-datasets';
import { ExperimentsList } from '@/domains/experiments/components/experiments-list';
import { NoExperimentsInfo } from '@/domains/experiments/components/no-experiments-info';
import { DatasetReview } from '@/domains/review/components/dataset-review';
import { useReviewSummary } from '@/domains/review/hooks/use-review-summary';
import { buildReviewByExperimentMap } from '@/domains/review/review-maps';
import { NoScorersInfo } from '@/domains/scores/components/scorers-list/no-scorers-info';
import { ScorersList } from '@/domains/scores/components/scorers-list/scorers-list';
import { useScorers } from '@/domains/scores/hooks/use-scorers';
import { useLinkComponent } from '@/lib/framework';

export const ATTACH_SHORTCUT = 'a';
export const RUN_EXPERIMENT_SHORTCUT = 'r';

interface AttachComboboxProps {
  label: string;
  searchPlaceholder: string;
  emptyText: string;
  options: ComboboxOption[];
  onValueChange: (value: string) => void;
}

/** "Attach" combobox: `A` toggles it open. Mount at most one per view. */
function AttachCombobox({ label, searchPlaceholder, emptyText, options, onValueChange }: AttachComboboxProps) {
  const [open, setOpen] = useState(false);

  useKeydown({ [ATTACH_SHORTCUT]: () => setOpen(prev => !prev) });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <Combobox
            variant="ghost"
            size="sm"
            className="w-auto"
            align="end"
            aria-label={label}
            placeholder={
              <span className="flex items-center gap-1.5">
                <Icon size="sm">
                  <Paperclip />
                </Icon>
                Attach
              </span>
            }
            searchPlaceholder={searchPlaceholder}
            emptyText={emptyText}
            options={options}
            value=""
            open={open}
            onOpenChange={setOpen}
            onValueChange={onValueChange}
          />
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <span className="inline-flex items-center gap-1.5">
          {label}
          <Kbd size="xs">A</Kbd>
        </span>
      </TooltipContent>
    </Tooltip>
  );
}

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

/**
 * Agent-scoped Evals: the same list components as the top-level Experiments / Datasets / Scorers /
 * Review pages, pre-filtered to this agent. Rows navigate to the entity pages.
 */
export function AgentPlaygroundEvaluate({ agentId, requestContextSchema }: AgentPlaygroundEvaluateProps) {
  const navigate = useNavigate();
  const { paths } = useLinkComponent();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<AgentEvalTab>(() => {
    const requested = searchParams.get('tab');
    return isAgentEvalTab(requested) ? requested : 'experiments';
  });
  const [experimentsSearch, setExperimentsSearch] = useState('');
  const [datasetsSearch, setDatasetsSearch] = useState('');
  const [scorersSearch, setScorersSearch] = useState('');

  const { form, isCodeAgentOverride } = useAgentEditFormContext();
  const watchedScorers = useWatch({ control: form.control, name: 'scorers' });
  const agentScorers = useMemo(() => watchedScorers ?? {}, [watchedScorers]);
  const attachedScorerIds = useMemo(() => Object.keys(agentScorers), [agentScorers]);

  const { data: datasetsData, isLoading: isLoadingDatasets } = useDatasets();
  const allDatasets = useMemo(() => datasetsData?.datasets ?? [], [datasetsData]);
  const { data: scorers, isLoading: isLoadingScorers } = useScorers();
  const { data: experiments, isLoading: isLoadingExperiments } = useAgentExperiments(agentId, attachedScorerIds);
  const { data: reviewSummary } = useReviewSummary();
  const reviewByExperiment = useMemo(() => buildReviewByExperimentMap(reviewSummary), [reviewSummary]);
  const { updateDataset } = useDatasetMutations();
  const { createStoredAgent, updateStoredAgent } = useStoredAgentMutations(agentId);

  const datasets = allDatasets.filter(ds => parseIdList(ds.targetIds).includes(agentId));
  const unattachedDatasets = allDatasets.filter(ds => !parseIdList(ds.targetIds).includes(agentId));

  const scorerEntries = useMemo(() => Object.entries(scorers || {}), [scorers]);
  const attachedScorers = useMemo(
    () => Object.fromEntries(scorerEntries.filter(([id]) => !!agentScorers[id])),
    [scorerEntries, agentScorers],
  );
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
      await persistScorers({ ...current, [scorerId]: { sampling: (scorerData as any).sampling } });
    },
    [form, persistScorers],
  );

  const datasetOptions = useMemo(
    () => unattachedDatasets.map(ds => ({ value: ds.id, label: ds.name, description: ds.description ?? undefined })),
    [unattachedDatasets],
  );
  const scorerOptions = useMemo(
    () =>
      unattachedScorers.map(([id, scorer]) => ({
        value: id,
        label: scorer.scorer?.name || id,
        description: scorer.scorer?.description ?? undefined,
      })),
    [unattachedScorers],
  );

  const handleAttachDataset = useCallback(
    async (datasetId: string) => {
      const ds = allDatasets.find(d => d.id === datasetId);
      if (!ds) return;
      try {
        await updateDataset.mutateAsync({
          datasetId: ds.id,
          // Classify legacy/untyped datasets without overwriting existing target types.
          targetType: ds.targetType ?? 'agent',
          targetIds: [...parseIdList(ds.targetIds), agentId],
        });
        toast.success(`Dataset "${ds.name}" attached`);
      } catch {
        toast.error('Failed to attach dataset');
      }
    },
    [allDatasets, updateDataset, agentId],
  );

  const handleAttachScorer = useCallback(
    async (scorerId: string) => {
      const scorer = scorers?.[scorerId];
      if (!scorer) return;
      try {
        await attachScorer(scorerId, scorer);
        toast.success(`Scorer "${scorer.scorer?.name || scorerId}" attached`);
      } catch {
        toast.error('Failed to attach scorer');
      }
    },
    [scorers, attachScorer],
  );

  // `?attachScorer=<id>` is set by the scorer create page when it was opened from this tab.
  const attachScorerParam = searchParams.get('attachScorer');
  const handledAttachScorerRef = useRef<string | null>(null);
  useEffect(() => {
    if (!attachScorerParam || !scorers?.[attachScorerParam]) return;
    if (handledAttachScorerRef.current === attachScorerParam) return;
    handledAttachScorerRef.current = attachScorerParam;
    void handleAttachScorer(attachScorerParam).finally(() => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          next.delete('attachScorer');
          return next;
        },
        { replace: true },
      );
    });
  }, [attachScorerParam, scorers, handleAttachScorer, setSearchParams]);

  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const isExperimentsTab = activeTab === 'experiments';
  useKeydown({ [RUN_EXPERIMENT_SHORTCUT]: () => setRunDialogOpen(true) }, { enabled: isExperimentsTab });

  const goToCreateScorer = useCallback(
    () => void navigate(`${paths.cmsScorersCreateLink()}?agentId=${encodeURIComponent(agentId)}`),
    [navigate, paths, agentId],
  );
  const goToCreateDataset = useCallback(
    () =>
      void navigate(
        `/datasets/new?targetType=agent&targetIds=${encodeURIComponent(agentId)}&agentId=${encodeURIComponent(agentId)}`,
      ),
    [navigate, agentId],
  );

  // Experiments are fetched per dataset, so they are "loading" until datasets are in.
  const isLoadingAgentExperiments = isLoadingDatasets || isLoadingExperiments;
  const noExperiments = !isLoadingAgentExperiments && (experiments ?? []).length === 0;
  const noDatasets = !isLoadingAgentExperiments && datasets.length === 0;
  const noScorers = !isLoadingScorers && Object.keys(attachedScorers).length === 0;

  const searchInput = (label: string, onChange: (value: string) => void) => (
    <InputGroup variant="outline">
      <InputGroupAddon align="inline-start">
        <SearchIcon />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        aria-label={`Search ${label}`}
        placeholder={`Search ${label}...`}
        onChange={event => onChange(event.target.value)}
      />
    </InputGroup>
  );

  const activeSearch =
    activeTab === 'experiments' && (experiments ?? []).length > 0
      ? searchInput('experiments', setExperimentsSearch)
      : activeTab === 'datasets' && datasets.length > 0
        ? searchInput('datasets', setDatasetsSearch)
        : activeTab === 'scorers' && Object.keys(attachedScorers).length > 0
          ? searchInput('scorers', setScorersSearch)
          : null;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Tabs<AgentEvalTab>
        defaultTab="experiments"
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex h-full flex-col overflow-hidden"
      >
        <div className="border-border1 flex items-center justify-between gap-2 border-b px-1.5 py-1.5">
          <TabList variant="pill-ghost" className="min-w-0 overflow-x-auto">
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

          <div className="flex shrink-0 items-center gap-2">
            {isExperimentsTab && (
              <Button
                variant="ghost"
                size="sm"
                icon={<Play />}
                onClick={() => setRunDialogOpen(true)}
                tooltip={
                  <span className="inline-flex items-center gap-1.5">
                    Run an experiment against this agent
                    <Kbd size="xs">R</Kbd>
                  </span>
                }
              >
                Run experiment
              </Button>
            )}
            {activeTab === 'datasets' && (
              <>
                <CreateButton variant="ghost" size="sm" tooltip="Create a dataset" onClick={goToCreateDataset}>
                  New dataset
                </CreateButton>
                {unattachedDatasets.length > 0 && (
                  <AttachCombobox
                    label="Attach dataset"
                    searchPlaceholder="Search datasets..."
                    emptyText="No datasets available to attach"
                    options={datasetOptions}
                    onValueChange={handleAttachDataset}
                  />
                )}
              </>
            )}
            {activeTab === 'scorers' && (
              <>
                <CreateButton variant="ghost" size="sm" tooltip="Create a scorer" onClick={goToCreateScorer}>
                  New scorer
                </CreateButton>
                {unattachedScorers.length > 0 && (
                  <AttachCombobox
                    label="Attach scorer"
                    searchPlaceholder="Search scorers..."
                    emptyText="No scorers available to attach"
                    options={scorerOptions}
                    onValueChange={handleAttachScorer}
                  />
                )}
              </>
            )}
            <AgentTopBarRunOptions requestContextSchema={requestContextSchema} />
          </div>
        </div>

        <ExperimentTriggerDialog
          open={runDialogOpen}
          onOpenChange={setRunDialogOpen}
          initialTargetType="agent"
          initialTargetId={agentId}
          onSuccess={experimentId => void navigate(`/experiments/${experimentId}`)}
        />

        {/* Search bar below tabs (Review owns its own toolbar) */}
        {activeSearch && <div className="px-4 py-3">{activeSearch}</div>}

        <div className="min-h-0 flex-1 overflow-hidden px-4 pb-4">
          <TabContent value="experiments" className="h-full overflow-auto">
            {noExperiments ? (
              <NoExperimentsInfo onRunExperiment={() => setRunDialogOpen(true)} />
            ) : (
              <ExperimentsList
                experiments={experiments ?? []}
                datasets={allDatasets}
                reviewByExperiment={reviewByExperiment}
                isLoading={isLoadingAgentExperiments}
                search={experimentsSearch}
              />
            )}
          </TabContent>
          <TabContent value="datasets" className="h-full overflow-auto">
            {noDatasets ? (
              <NoDatasetsInfo onCreateClick={goToCreateDataset} />
            ) : (
              <DatasetsList
                datasets={datasets}
                experiments={experiments ?? []}
                isLoading={isLoadingAgentExperiments}
                search={datasetsSearch}
              />
            )}
          </TabContent>
          <TabContent value="scorers" className="h-full overflow-auto">
            {noScorers ? (
              <NoScorersInfo />
            ) : (
              <ScorersList scorers={attachedScorers} isLoading={isLoadingScorers} search={scorersSearch} />
            )}
          </TabContent>
          <TabContent value="review" className="h-full overflow-hidden">
            {/* DatasetReview renders PageLayout.TopArea + MainArea and expects the PageLayout grid rows. */}
            <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] pt-2">
              <DatasetReview
                targetType="agent"
                targetId={agentId}
                detailPanelVariant="inline"
                onCreateScorer={goToCreateScorer}
              />
            </div>
          </TabContent>
        </div>
      </Tabs>
    </div>
  );
}
