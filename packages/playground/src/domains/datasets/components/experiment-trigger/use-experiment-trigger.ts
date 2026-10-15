import { useMastraClient } from '@mastra/react';
import { useAgents } from '@mastra/react/hooks/agents';
import {
  datasetItemsQueryOptions,
  datasetQueryOptions,
  useDataset,
  useDatasetItems,
  useDatasetMutations,
  useDatasets,
} from '@mastra/react/hooks/datasets';
import { useWorkflows } from '@mastra/react/hooks/workflows';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { buildDefaultExperimentName, createNameSuffix } from '../../utils/default-names';
import type { TargetType } from './target-selector';
import { useScorers } from '@/domains/scores/hooks/use-scorers';

export interface ExperimentTriggerInitialValues {
  initialDatasetId?: string;
  initialDatasetVersion?: number;
  initialScorerIds?: string[];
  initialTargetType?: TargetType;
  initialTargetId?: string;
  initialName?: string;
  initialDescription?: string;
}

export type TargetOption = { value: string; label: string; type: TargetType; id: string };
export type ScorerOption = { value: string; label: string; description?: string };
export type DatasetOption = { value: string; label: string };

const toTargetValue = (type: TargetType, id: string) => `${type}:${id}`;

/** Agents, workflows and scorers in one list, so picking a target is one choice instead of two. */
function useTargetOptions() {
  const { data: agents, isLoading: agentsLoading } = useAgents();
  const { data: workflows, isLoading: workflowsLoading } = useWorkflows({});
  const { data: scorers, isLoading: scorersLoading } = useScorers();

  const make = (type: TargetType, id: string, label: string): TargetOption => ({
    value: toTargetValue(type, id),
    label,
    type,
    id,
  });

  const options: TargetOption[] = [
    ...Object.entries(agents ?? {}).map(([id, agent]) => make('agent', id, agent.name || id)),
    ...Object.entries(workflows ?? {}).map(([id, workflow]) => make('workflow', id, workflow.name || id)),
    ...Object.entries(scorers ?? {}).map(([id, scorer]) => make('scorer', id, scorer.scorer?.config?.name || id)),
  ];

  return { options, isLoading: agentsLoading || workflowsLoading || scorersLoading };
}

function useScorerOptions(): ScorerOption[] {
  const { data: scorers } = useScorers();
  return Object.entries(scorers ?? {})
    .filter(([, scorer]) => scorer.isRegistered)
    .map(([id, scorer]) => ({
      value: id,
      label: scorer.scorer?.config?.name || id,
      description: scorer.scorer?.config?.description || undefined,
    }));
}

/**
 * Warms what picking a dataset needs (its default scorers and item count) while it's highlighted in
 * the list, so the field and Scorers don't pop in after the click.
 */
const PREFETCH_STALE_MS = 30_000;

export function usePrefetchDataset() {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  return (datasetId: string | undefined) => {
    if (!datasetId) return;
    // Highlighting fires on every arrow key and keystroke: reuse a recent prefetch, and fail quietly
    // like the hooks do instead of retrying.
    void queryClient.prefetchQuery({
      ...datasetQueryOptions(client, datasetId),
      staleTime: PREFETCH_STALE_MS,
      retry: false,
    });
    void queryClient.prefetchInfiniteQuery({
      ...datasetItemsQueryOptions(client, { datasetId }),
      staleTime: PREFETCH_STALE_MS,
      retry: false,
    });
  };
}

/** "5 items · latest", or the pinned version when one is picked under Advanced. */
export function datasetDetail(itemCount: number | undefined, version: number | undefined) {
  if (itemCount === undefined) return undefined;
  const items = `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`;
  return `${items} · ${version === undefined ? 'latest' : `v${version}`}`;
}

function parseRequestContext(raw: string): Record<string, unknown> | undefined {
  if (!raw.trim()) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Request context must be valid JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Request context must be a JSON object');
  }
  return parsed as Record<string, unknown>;
}

const filledEntries = (values: Record<string, unknown>) =>
  Object.entries(values).filter(([, value]) => value !== undefined && value !== '');

/**
 * State for the New experiment dialog. Three choices (target, dataset, scorers); everything else has a
 * default: the dataset is the newest one, scorers are the dataset's defaults, and the name is the
 * target's name plus a short id unless the user types one.
 */
export function useExperimentTrigger(
  initial: ExperimentTriggerInitialValues & {
    onOpenChange: (open: boolean) => void;
    onSuccess?: (experimentId: string) => void;
  },
) {
  const { data: datasetsData } = useDatasets();
  const datasets: DatasetOption[] = (datasetsData?.datasets ?? []).map(d => ({ value: d.id, label: d.name }));

  const [pickedDatasetId, setPickedDatasetId] = useState(initial.initialDatasetId ?? '');
  // Opening without a dataset starts on the newest one.
  const datasetId = pickedDatasetId || datasets[0]?.value || '';
  const [version, setVersion] = useState(initial.initialDatasetVersion);
  const [targetValue, setTargetValue] = useState(
    initial.initialTargetType && initial.initialTargetId
      ? toTargetValue(initial.initialTargetType, initial.initialTargetId)
      : '',
  );
  // Unset until the user picks scorers; the dataset's default scorers apply meanwhile.
  const [pickedScorers, setPickedScorers] = useState<string[] | undefined>(initial.initialScorerIds);
  // Empty until the user types one; the auto name shows as the placeholder and is used on Run.
  const [name, setName] = useState(initial.initialName ?? '');
  const [description, setDescription] = useState(initial.initialDescription ?? '');
  const [requestContextRaw, setRequestContextRaw] = useState('');
  const [requestContextValues, setRequestContextValues] = useState<Record<string, unknown>>({});
  const [suffix] = useState(createNameSuffix);
  // A rerun that pins a version or carries a description opens with those fields showing.
  const [advancedOpen, setAdvancedOpen] = useState(
    initial.initialDatasetVersion !== undefined || Boolean(initial.initialDescription),
  );

  const { options: targetOptions, isLoading: targetsLoading } = useTargetOptions();
  const scorerOptions = useScorerOptions();
  const { data: dataset } = useDataset({ datasetId, queryOptions: { enabled: Boolean(datasetId) } });
  const { total: itemCount } = useDatasetItems({
    datasetId,
    search: undefined,
    version,
    queryOptions: { enabled: Boolean(datasetId) },
  });

  const defaultScorers = dataset?.scorerIds ?? [];
  const scorerIds = pickedScorers ?? defaultScorers;
  const requestContextSchema = dataset?.requestContextSchema as Record<string, unknown> | undefined;
  const hasRequestContextSchema = Boolean(requestContextSchema && Object.keys(requestContextSchema).length > 0);
  // Versions are numbered from 1, so a current version above 1 means there are older ones to pick.
  const showVersion = (dataset?.version ?? 1) > 1 || version !== undefined;

  // A preselected target (rerun) is named after its id until its display name loads.
  const target =
    targetOptions.find(option => option.value === targetValue) ??
    (initial.initialTargetType && initial.initialTargetId && targetValue
      ? {
          value: targetValue,
          label: initial.initialTargetId,
          type: initial.initialTargetType,
          id: initial.initialTargetId,
        }
      : undefined);
  const defaultName = buildDefaultExperimentName(target?.label ?? 'experiment', suffix);

  const { triggerExperiment } = useDatasetMutations();
  const isRunning = triggerExperiment.isPending;
  const canRun = Boolean(datasetId && target) && !isRunning;

  const resolveRequestContext = () => {
    if (hasRequestContextSchema) {
      const entries = filledEntries(requestContextValues);
      return entries.length > 0 ? Object.fromEntries(entries) : undefined;
    }
    return parseRequestContext(requestContextRaw);
  };

  const run = async () => {
    if (!canRun || !target) return;

    let requestContext: Record<string, unknown> | undefined;
    try {
      requestContext = resolveRequestContext();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Request context must be valid JSON');
      return;
    }

    try {
      const result = await triggerExperiment.mutateAsync({
        datasetId,
        name: name.trim() || defaultName,
        description: description.trim() || undefined,
        targetType: target.type,
        targetId: target.id,
        scorerIds: scorerIds.length > 0 ? scorerIds : undefined,
        version,
        requestContext,
      });
      toast.success('Experiment started');
      initial.onOpenChange(false);
      initial.onSuccess?.(result.experimentId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to start experiment');
    }
  };

  return {
    targetOptions,
    targetsLoading,
    target,
    setTargetValue,
    datasets,
    datasetId,
    setDataset: (id: string) => {
      setPickedDatasetId(id);
      setVersion(undefined);
      setPickedScorers(initial.initialScorerIds);
      setRequestContextValues({});
    },
    itemCount,
    version,
    setVersion,
    showVersion,
    scorerOptions,
    scorerIds,
    usesDefaultScorers: pickedScorers === undefined && defaultScorers.length > 0,
    setScorerIds: setPickedScorers,
    name,
    setName,
    defaultName,
    description,
    setDescription,
    requestContextSchema: hasRequestContextSchema ? requestContextSchema : undefined,
    requestContextRaw,
    setRequestContextRaw,
    setRequestContextValues,
    advancedOpen,
    setAdvancedOpen,
    canRun,
    isRunning,
    run,
  };
}
