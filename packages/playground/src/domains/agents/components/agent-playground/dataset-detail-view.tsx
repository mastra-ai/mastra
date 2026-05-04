import {
  Button,
  Chip,
  Combobox,
  CopyButton,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  ScrollArea,
  Spinner,
  Textarea,
  Txt,
  Icon,
  toast,
  cn,
} from '@mastra/playground-ui';
import { useQueryClient } from '@tanstack/react-query';
import { Play, Sparkles, Clock, ChevronRight, ChevronDown, Pencil, Save, X, Trash2 } from 'lucide-react';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { formatVersionLabel } from './format-version-label';
import { useAgentVersions } from '@/domains/agents/hooks/use-agent-versions';
import { useDatasetExperiments } from '@/domains/datasets/hooks/use-dataset-experiments';
import { useDatasetItems } from '@/domains/datasets/hooks/use-dataset-items';
import { useDatasetMutations } from '@/domains/datasets/hooks/use-dataset-mutations';
import { useDatasetVersions } from '@/domains/datasets/hooks/use-dataset-versions';
import { useMergedRequestContext } from '@/domains/request-context/context/schema-request-context';
import { useScorers } from '@/domains/scores/hooks/use-scorers';

interface DatasetDetailViewProps {
  agentId: string;
  datasetId: string;
  datasetName: string;
  datasetDescription?: string;
  datasetTags?: string[];
  datasetTargetType?: string | null;
  datasetTargetIds?: string[] | null;
  activeScorers?: string[];
  datasetScorerIds?: string[] | null;
  onGenerate: () => void;
  onViewExperiment: (experimentId: string) => void;
}

function formatTimestamp(date: string | Date) {
  const d = new Date(date);
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ', ' +
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  );
}

function truncateValue(value: unknown, maxLength = 120): string {
  if (value === undefined || value === null) return '-';
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  if (!str || str.length <= maxLength) return str || '-';
  return str.slice(0, maxLength) + '…';
}

function getExpectedTrajectoryLabel(expectedTrajectory: unknown): string {
  const traj = expectedTrajectory as Record<string, unknown> | undefined;
  const steps = Array.isArray(traj?.steps) ? traj.steps.length : 0;
  return steps > 0 ? `${steps} expected steps` : 'trajectory';
}

// Deterministic tag color from string
const TAG_COLORS = ['blue', 'green', 'purple', 'orange', 'cyan', 'pink', 'red', 'yellow'] as const;
function getTagColor(tag: string): (typeof TAG_COLORS)[number] {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = ((hash << 5) - hash + tag.charCodeAt(i)) | 0;
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

export function DatasetDetailView({
  agentId,
  datasetId,
  datasetName,
  datasetDescription,
  datasetTags = [],
  datasetTargetType,
  datasetTargetIds,
  activeScorers = [],
  datasetScorerIds = [],
  onGenerate,
  onViewExperiment,
}: DatasetDetailViewProps) {
  const [isRunning, setIsRunning] = useState(false);
  const isStartingRef = useRef(false);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [itemsCollapsed, setItemsCollapsed] = useState(false);
  const [runsCollapsed, setRunsCollapsed] = useState(false);
  const [scorersCollapsed, setScorersCollapsed] = useState(false);
  const [showAttachScorerDialog, setShowAttachScorerDialog] = useState(false);
  const [attachScorerSearch, setAttachScorerSearch] = useState('');
  const [selectedDatasetVersion, setSelectedDatasetVersion] = useState<string>('');
  const [selectedAgentVersion, setSelectedAgentVersion] = useState<string>('');

  // Scorers for dataset attachment
  const { data: allScorers } = useScorers();
  const { updateDataset } = useDatasetMutations();

  const attachedScorerIds = useMemo(() => new Set(datasetScorerIds ?? []), [datasetScorerIds]);

  const attachedScorerEntries = useMemo(() => {
    if (!allScorers) return [];
    return Object.entries(allScorers).filter(([id]) => attachedScorerIds.has(id));
  }, [allScorers, attachedScorerIds]);

  const unattachedScorerEntries = useMemo(() => {
    if (!allScorers) return [];
    return Object.entries(allScorers).filter(([id]) => !attachedScorerIds.has(id));
  }, [allScorers, attachedScorerIds]);

  const handleAttachScorer = useCallback(
    async (scorerId: string) => {
      const newScorerIds = [...(datasetScorerIds ?? []), scorerId];
      try {
        await updateDataset.mutateAsync({ datasetId, scorerIds: newScorerIds });
      } catch (error) {
        toast.error('Failed to attach scorer');
        throw error;
      }
    },
    [datasetId, datasetScorerIds, updateDataset],
  );

  const handleDetachScorer = useCallback(
    async (scorerId: string) => {
      const newScorerIds = (datasetScorerIds ?? []).filter(id => id !== scorerId);
      try {
        await updateDataset.mutateAsync({ datasetId, scorerIds: newScorerIds });
      } catch {
        toast.error('Failed to detach scorer');
      }
    },
    [datasetId, datasetScorerIds, updateDataset],
  );

  const { data: items = [], setEndOfListElement, isFetchingNextPage } = useDatasetItems(datasetId);
  const { data: experimentsData, refetch: refetchExperiments } = useDatasetExperiments(datasetId);
  const datasetExperiments = experimentsData?.experiments ?? [];

  const datasetVersionsQuery = useDatasetVersions(datasetId);
  const datasetVersions = datasetVersionsQuery.data ?? [];

  const isAgentTarget = !datasetTargetType || datasetTargetType === 'agent';
  const agentVersionsQuery = useAgentVersions({ agentId: isAgentTarget ? agentId : '' });
  const agentVersions = agentVersionsQuery.data?.versions ?? [];

  useEffect(() => {
    setSelectedDatasetVersion('');
  }, [datasetId]);

  useEffect(() => {
    setSelectedAgentVersion('');
  }, [agentId]);

  const mergedRequestContext = useMergedRequestContext();
  const queryClient = useQueryClient();
  const { triggerExperiment } = useDatasetMutations();

  const handleRunExperiment = useCallback(async () => {
    if (isStartingRef.current) return;

    isStartingRef.current = true;
    setIsRunning(true);
    try {
      const hasRequestContext = Object.keys(mergedRequestContext).length > 0;
      // Use the dataset's own target if it's not an agent dataset
      const expTargetType =
        datasetTargetType === 'scorer' || datasetTargetType === 'workflow' ? datasetTargetType : 'agent';
      // targetIds may come as a JSON string from some storage backends
      const parsedTargetIds = Array.isArray(datasetTargetIds)
        ? datasetTargetIds
        : typeof datasetTargetIds === 'string'
          ? (() => {
              try {
                return JSON.parse(datasetTargetIds);
              } catch {
                return [];
              }
            })()
          : [];
      const expTargetId = expTargetType !== 'agent' && parsedTargetIds[0] ? parsedTargetIds[0] : agentId;
      await triggerExperiment.mutateAsync({
        datasetId,
        targetType: expTargetType,
        targetId: expTargetId,
        ...(activeScorers.length > 0 ? { scorerIds: activeScorers } : {}),
        ...(hasRequestContext ? { requestContext: mergedRequestContext } : {}),
        ...(selectedDatasetVersion ? { version: Number(selectedDatasetVersion) } : {}),
        ...(selectedAgentVersion ? { agentVersion: selectedAgentVersion } : {}),
      });
      void queryClient.invalidateQueries({ queryKey: ['agent-experiments', agentId] });
      void refetchExperiments();
      // Poll a few times to pick up status changes
      const poll = setInterval(() => refetchExperiments(), 3000);
      setTimeout(() => clearInterval(poll), 30000);
      toast.success('Experiment started');
    } catch (error) {
      toast.error(`Failed to start experiment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      isStartingRef.current = false;
      setIsRunning(false);
    }
  }, [
    datasetId,
    activeScorers,
    agentId,
    datasetTargetType,
    datasetTargetIds,
    triggerExperiment,
    mergedRequestContext,
    queryClient,
    selectedDatasetVersion,
    selectedAgentVersion,
  ]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border1 space-y-3">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <Txt variant="ui-sm" className="text-neutral5 font-medium block truncate">
              {datasetName}
            </Txt>
            {datasetDescription && (
              <Txt variant="ui-xs" className="text-neutral3 block mt-0.5 truncate">
                {datasetDescription}
              </Txt>
            )}
            {datasetTags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {datasetTags.map(tag => (
                  <Chip key={tag} color={getTagColor(tag)} size="small">
                    {tag}
                  </Chip>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="sm" onClick={onGenerate}>
              <Icon size="sm">
                <Sparkles />
              </Icon>
              Generate
            </Button>
            <Button variant="cta" size="sm" onClick={handleRunExperiment} disabled={items.length === 0 || isRunning}>
              {isRunning ? (
                <>
                  <Spinner className="h-3 w-3" /> Running...
                </>
              ) : (
                <>
                  <Icon size="sm">
                    <Play />
                  </Icon>{' '}
                  Run Experiment
                </>
              )}
            </Button>
          </div>
        </div>
        {/* Version selectors */}
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <Txt variant="ui-xs" className="text-neutral3 mb-1 block">
              Dataset version
            </Txt>
            <Combobox
              options={[
                { label: 'Latest', value: '' },
                ...datasetVersions.map(v => ({
                  label: `v${v.version}`,
                  value: String(v.version),
                  description: v.isCurrent ? 'Current' : undefined,
                })),
              ]}
              value={selectedDatasetVersion}
              onValueChange={setSelectedDatasetVersion}
              placeholder="Latest"
              size="sm"
            />
          </div>
          {isAgentTarget && (
            <div className="flex-1 min-w-0">
              <Txt variant="ui-xs" className="text-neutral3 mb-1 block">
                Agent version
              </Txt>
              <div className="flex items-center gap-1">
                <Combobox
                  options={[
                    { label: 'Current', value: '' },
                    ...agentVersions.map(v => ({
                      label: `v${v.versionNumber}`,
                      value: v.id,
                      description: v.changeMessage ?? undefined,
                    })),
                  ]}
                  value={selectedAgentVersion}
                  onValueChange={setSelectedAgentVersion}
                  placeholder="Current"
                  size="sm"
                />
                {(selectedAgentVersion || agentVersions[0]?.id) && (
                  <CopyButton
                    content={selectedAgentVersion || agentVersions[0]?.id}
                    tooltip="Copy version ID"
                    size="sm"
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Scorers + Items + Past runs */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1 min-h-0">
          {/* Scorers section (collapsible) */}
          <div className="border-b border-border1">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setScorersCollapsed(prev => !prev)}
                className="flex-1 px-4 py-2 flex items-center gap-1 hover:bg-surface3 transition-colors"
              >
                <Icon size="sm" className="text-neutral3">
                  {scorersCollapsed ? <ChevronRight /> : <ChevronDown />}
                </Icon>
                <Txt variant="ui-xs" className="text-neutral3 font-semibold uppercase tracking-wider">
                  Scorers ({attachedScorerEntries.length})
                </Txt>
              </button>
              {unattachedScorerEntries.length > 0 && (
                <div className="pr-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowAttachScorerDialog(true)}>
                    Attach
                  </Button>
                </div>
              )}
            </div>
            {!scorersCollapsed &&
              (attachedScorerEntries.length === 0 ? (
                <div className="px-4 py-4 text-center">
                  <Txt variant="ui-xs" className="text-neutral3">
                    No scorers attached to this dataset.
                  </Txt>
                  {unattachedScorerEntries.length > 0 && (
                    <div className="mt-2">
                      <Button variant="outline" size="sm" onClick={() => setShowAttachScorerDialog(true)}>
                        Attach a scorer
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-border1">
                  {attachedScorerEntries.map(([id, scorer]) => {
                    const name = (scorer as { scorer?: { name?: string } }).scorer?.name || id;
                    return (
                      <div
                        key={id}
                        className="flex items-center justify-between px-4 py-1.5 hover:bg-surface3 transition-colors group"
                      >
                        <Txt variant="ui-xs" className="text-neutral5 truncate">
                          {name}
                        </Txt>
                        <button
                          type="button"
                          onClick={() => handleDetachScorer(id)}
                          aria-label={`Detach "${name}" from this dataset`}
                          className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity text-neutral3 hover:text-red-500 p-0.5"
                          title="Detach scorer"
                        >
                          <Icon size="sm">
                            <X />
                          </Icon>
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
          </div>

          {/* Items section (collapsible) */}
          <div className="border-b border-border1">
            <button
              type="button"
              onClick={() => setItemsCollapsed(prev => !prev)}
              className="w-full px-4 py-2 flex items-center gap-1 hover:bg-surface3 transition-colors"
            >
              <Icon size="sm" className="text-neutral3">
                {itemsCollapsed ? <ChevronRight /> : <ChevronDown />}
              </Icon>
              <Txt variant="ui-xs" className="text-neutral3 font-semibold uppercase tracking-wider">
                Items ({items.length})
              </Txt>
            </button>
            {!itemsCollapsed &&
              (items.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <Txt variant="ui-xs" className="text-neutral3">
                    No items yet. Use Generate to create test data.
                  </Txt>
                </div>
              ) : (
                <div className="divide-y divide-border1">
                  {items.map(item => {
                    const isExpanded = expandedItemId === item.id;
                    return (
                      <div key={item.id}>
                        <button
                          type="button"
                          onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                          className="w-full text-left px-4 py-2 hover:bg-surface3 transition-colors flex items-start gap-2"
                        >
                          <Icon size="sm" className="text-neutral3 mt-0.5 shrink-0">
                            {isExpanded ? <ChevronDown /> : <ChevronRight />}
                          </Icon>
                          <div className="flex-1 min-w-0 flex items-center gap-2">
                            <Txt variant="ui-xs" className="text-neutral5 block truncate flex-1">
                              {truncateValue(item.input)}
                            </Txt>
                            {item.expectedTrajectory != null && (
                              <Chip size="small" color="purple">
                                {getExpectedTrajectoryLabel(item.expectedTrajectory)}
                              </Chip>
                            )}
                          </div>
                        </button>
                        {isExpanded && <ExpandedItemEditor datasetId={datasetId} item={item} />}
                      </div>
                    );
                  })}
                  <div ref={setEndOfListElement} />
                  {isFetchingNextPage && (
                    <div className="flex items-center justify-center py-2">
                      <Spinner className="h-3 w-3" />
                    </div>
                  )}
                </div>
              ))}
          </div>

          {/* Past runs section (collapsible) */}
          <div>
            <button
              type="button"
              onClick={() => setRunsCollapsed(prev => !prev)}
              className="w-full px-4 py-2 flex items-center gap-1 hover:bg-surface3 transition-colors"
            >
              <Icon size="sm" className="text-neutral3">
                {runsCollapsed ? <ChevronRight /> : <ChevronDown />}
              </Icon>
              <Icon size="sm" className="text-neutral3">
                <Clock />
              </Icon>
              <Txt variant="ui-xs" className="text-neutral3 font-semibold uppercase tracking-wider">
                Past Runs ({datasetExperiments.length})
              </Txt>
            </button>
            {!runsCollapsed &&
              (datasetExperiments.length === 0 ? (
                <div className="px-4 py-4 text-center">
                  <Txt variant="ui-xs" className="text-neutral3">
                    No experiment runs yet
                  </Txt>
                </div>
              ) : (
                <div className="divide-y divide-border1">
                  {datasetExperiments.map(exp => (
                    <button
                      key={exp.id}
                      type="button"
                      onClick={() => onViewExperiment(exp.id)}
                      className="w-full text-left px-4 py-2 hover:bg-surface3 transition-colors flex items-center gap-2"
                    >
                      <ExperimentStatusDot status={exp.status} />
                      <div className="flex-1 min-w-0">
                        <Txt variant="ui-xs" className="text-neutral5 block">
                          {exp.startedAt ? formatTimestamp(exp.startedAt) : 'Unknown'}
                        </Txt>
                        <Txt variant="ui-xs" className="text-neutral3">
                          {exp.succeededCount}/{exp.totalItems} passed
                          {exp.datasetVersion != null && ` · ${formatVersionLabel('Dataset', exp.datasetVersion)}`}
                          {exp.agentVersion &&
                            (() => {
                              const av = agentVersions.find(v => v.id === exp.agentVersion);
                              return ` · ${formatVersionLabel('Agent', av ? av.versionNumber : exp.agentVersion)}`;
                            })()}
                        </Txt>
                      </div>
                      <Icon size="sm" className="text-neutral3">
                        <ChevronRight />
                      </Icon>
                    </button>
                  ))}
                </div>
              ))}
          </div>
        </ScrollArea>
      </div>

      {/* Attach Scorer Dialog */}
      <Dialog
        open={showAttachScorerDialog}
        onOpenChange={open => {
          setShowAttachScorerDialog(open);
          if (!open) setAttachScorerSearch('');
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Attach Scorer to Dataset</DialogTitle>
          </DialogHeader>
          <DialogBody className="max-h-[50vh] overflow-y-auto">
            {unattachedScorerEntries.length === 0 ? (
              <Txt variant="ui-sm" className="text-neutral3 py-4 text-center">
                No scorers available to attach.
              </Txt>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Search scorers..."
                  value={attachScorerSearch}
                  onChange={e => setAttachScorerSearch(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm rounded border border-border1 bg-surface2 text-text1 placeholder:text-neutral3 focus:outline-none focus:ring-1 focus:ring-accent1"
                />
                {unattachedScorerEntries
                  .filter(([id, scorer]) => {
                    if (!attachScorerSearch) return true;
                    const name = (scorer as { scorer?: { name?: string } }).scorer?.name || id;
                    return name.toLowerCase().includes(attachScorerSearch.toLowerCase());
                  })
                  .map(([id, scorer]) => {
                    const name = (scorer as { scorer?: { name?: string } }).scorer?.name || id;
                    return (
                      <button
                        key={id}
                        type="button"
                        className="w-full text-left px-3 py-2 rounded hover:bg-surface4 transition-colors"
                        onClick={async () => {
                          try {
                            await handleAttachScorer(id);
                            toast.success(`Attached "${name}" to this dataset`);
                            setShowAttachScorerDialog(false);
                          } catch {
                            // error toast already shown by handleAttachScorer
                          }
                        }}
                      >
                        <Txt variant="ui-sm" className="font-medium">
                          {name}
                        </Txt>
                      </button>
                    );
                  })}
              </div>
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

function ExpandedItemEditor({
  datasetId,
  item,
}: {
  datasetId: string;
  item: { id: string; input: unknown; groundTruth?: unknown; expectedTrajectory?: unknown; source?: unknown };
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [groundTruthValue, setGroundTruthValue] = useState('');
  const [trajectoryValue, setTrajectoryValue] = useState('');
  const { updateItem, deleteItem } = useDatasetMutations();

  const startEditing = useCallback(() => {
    setInputValue(formatValue(item.input));
    setGroundTruthValue(formatValue(item.groundTruth));
    setTrajectoryValue(formatValue(item.expectedTrajectory));
    setIsEditing(true);
  }, [item.input, item.groundTruth, item.expectedTrajectory]);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleDelete = useCallback(async () => {
    try {
      await deleteItem.mutateAsync({ datasetId, itemId: item.id });
      toast.success('Item deleted');
    } catch (error) {
      toast.error(`Failed to delete: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [deleteItem, datasetId, item.id]);

  const handleSave = useCallback(async () => {
    let parsedInput: unknown;
    try {
      parsedInput = JSON.parse(inputValue);
    } catch {
      parsedInput = inputValue;
    }

    let parsedGroundTruth: unknown | undefined;
    if (groundTruthValue.trim()) {
      try {
        parsedGroundTruth = JSON.parse(groundTruthValue);
      } catch {
        parsedGroundTruth = groundTruthValue;
      }
    }

    let parsedTrajectory: unknown | undefined;
    if (trajectoryValue.trim()) {
      try {
        parsedTrajectory = JSON.parse(trajectoryValue);
      } catch {
        parsedTrajectory = trajectoryValue;
      }
    }

    try {
      await updateItem.mutateAsync({
        datasetId,
        itemId: item.id,
        input: parsedInput,
        groundTruth: parsedGroundTruth,
        expectedTrajectory: parsedTrajectory,
      });
      toast.success('Item updated');
      setIsEditing(false);
    } catch (error) {
      toast.error(`Failed to update: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [inputValue, groundTruthValue, trajectoryValue, datasetId, item.id, updateItem]);

  if (isEditing) {
    return (
      <div className="px-4 pb-3 pl-10 space-y-2">
        <div>
          <Txt variant="ui-xs" className="text-neutral3 font-medium">
            Input
          </Txt>
          <Textarea
            value={inputValue}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInputValue(e.target.value)}
            className="mt-1 font-mono text-xs"
            rows={4}
          />
        </div>
        <div>
          <Txt variant="ui-xs" className="text-neutral3 font-medium">
            Ground Truth
          </Txt>
          <Textarea
            value={groundTruthValue}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setGroundTruthValue(e.target.value)}
            className="mt-1 font-mono text-xs"
            rows={3}
            placeholder="Optional"
          />
        </div>
        <div>
          <Txt variant="ui-xs" className="text-neutral3 font-medium">
            Expected Trajectory (JSON)
          </Txt>
          <Textarea
            value={trajectoryValue}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTrajectoryValue(e.target.value)}
            className="mt-1 font-mono text-xs"
            rows={3}
            placeholder="Optional — JSON trajectory expectation"
          />
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Button variant="cta" size="sm" onClick={handleSave} disabled={updateItem.isPending}>
            {updateItem.isPending ? (
              <Spinner className="h-3 w-3" />
            ) : (
              <Icon size="sm">
                <Save />
              </Icon>
            )}
            Save
          </Button>
          <Button variant="ghost" size="sm" onClick={cancelEditing}>
            <Icon size="sm">
              <X />
            </Icon>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-3 pl-10 space-y-2">
      <div>
        <Txt variant="ui-xs" className="text-neutral3 font-medium">
          Input
        </Txt>
        <pre className="text-xs text-neutral5 bg-surface1 rounded px-2 py-1.5 overflow-x-auto whitespace-pre-wrap wrap-break-word max-h-48 overflow-y-auto mt-1">
          {formatValue(item.input)}
        </pre>
      </div>
      {item.groundTruth !== undefined && item.groundTruth !== null && (
        <div>
          <Txt variant="ui-xs" className="text-neutral3 font-medium">
            Ground Truth
          </Txt>
          <pre className="text-xs text-neutral5 bg-surface1 rounded px-2 py-1.5 overflow-x-auto whitespace-pre-wrap wrap-break-word max-h-48 overflow-y-auto mt-1">
            {formatValue(item.groundTruth)}
          </pre>
        </div>
      )}
      {item.expectedTrajectory != null && (
        <div>
          <Txt variant="ui-xs" className="text-neutral3 font-medium">
            Expected Trajectory
          </Txt>
          <pre className="text-xs text-neutral5 bg-surface1 rounded px-2 py-1.5 overflow-x-auto whitespace-pre-wrap break-words max-h-48 overflow-y-auto mt-1">
            {formatValue(item.expectedTrajectory)}
          </pre>
        </div>
      )}
      <div className="flex items-center gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={startEditing}>
          <Icon size="sm">
            <Pencil />
          </Icon>
          Edit
        </Button>
        {isConfirmingDelete ? (
          <>
            <Txt variant="ui-xs" className="text-negative1 font-medium">
              Delete this item?
            </Txt>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={deleteItem.isPending}
              className="text-negative1 hover:text-negative1"
            >
              {deleteItem.isPending ? <Spinner className="h-3 w-3" /> : 'Yes'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setIsConfirmingDelete(false)}>
              No
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsConfirmingDelete(true)}
            className="text-neutral2 hover:text-negative1"
          >
            <Icon size="sm">
              <Trash2 />
            </Icon>
            Delete
          </Button>
        )}
        {item.source != null && (
          <Txt variant="ui-xs" className="text-neutral2">
            Source:{' '}
            {typeof item.source === 'object' && item.source !== null && 'type' in item.source
              ? String((item.source as unknown as Record<string, unknown>).type)
              : 'manual'}
          </Txt>
        )}
      </div>
    </div>
  );
}

function ExperimentStatusDot({ status }: { status: string }) {
  const color =
    status === 'completed'
      ? 'bg-positive1'
      : status === 'running'
        ? 'bg-warning1'
        : status === 'failed'
          ? 'bg-negative1'
          : 'bg-neutral3';
  return <div className={cn('w-2 h-2 rounded-full shrink-0', color)} />;
}
