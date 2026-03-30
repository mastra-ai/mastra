import { useQueryClient } from '@tanstack/react-query';
import { Play, Sparkles, Clock, ChevronRight, ChevronDown, Pencil, Save, X, Trash2 } from 'lucide-react';
import { useEffect, useState, useCallback, useRef } from 'react';
import { formatVersionLabel } from './format-version-label';
import { useAgentVersions } from '@/domains/agents/hooks/use-agent-versions';
import { useDatasetExperiments } from '@/domains/datasets/hooks/use-dataset-experiments';
import { useDatasetItems } from '@/domains/datasets/hooks/use-dataset-items';
import { useDatasetMutations } from '@/domains/datasets/hooks/use-dataset-mutations';
import { useDatasetVersions } from '@/domains/datasets/hooks/use-dataset-versions';
import { useMergedRequestContext } from '@/domains/request-context/context/schema-request-context';
import { Button } from '@/ds/components/Button';
import { Chip } from '@/ds/components/Chip';
import { Combobox } from '@/ds/components/Combobox';
import { CopyButton } from '@/ds/components/CopyButton';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { Spinner } from '@/ds/components/Spinner';
import { Textarea } from '@/ds/components/Textarea';
import { Txt } from '@/ds/components/Txt';
import { Icon } from '@/ds/icons/Icon';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

interface DatasetDetailViewProps {
  agentId: string;
  datasetId: string;
  datasetName: string;
  datasetDescription?: string;
  datasetTags?: string[];
  datasetTargetType?: string | null;
  datasetTargetIds?: string[] | null;
  activeScorers?: string[];
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
  onGenerate,
  onViewExperiment,
}: DatasetDetailViewProps) {
  const [isRunning, setIsRunning] = useState(false);
  const isStartingRef = useRef(false);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [itemsCollapsed, setItemsCollapsed] = useState(false);
  const [runsCollapsed, setRunsCollapsed] = useState(false);
  const [selectedDatasetVersion, setSelectedDatasetVersion] = useState<string>('');
  const [selectedAgentVersion, setSelectedAgentVersion] = useState<string>('');

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

      {/* Items + Past runs */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1 min-h-0">
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
                          <div className="flex-1 min-w-0">
                            <Txt variant="ui-xs" className="text-neutral5 block truncate">
                              {truncateValue(item.input)}
                            </Txt>
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
  item: { id: string; input: unknown; groundTruth?: unknown; source?: unknown };
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [groundTruthValue, setGroundTruthValue] = useState('');
  const { updateItem, deleteItem } = useDatasetMutations();

  const startEditing = useCallback(() => {
    setInputValue(formatValue(item.input));
    setGroundTruthValue(formatValue(item.groundTruth));
    setIsEditing(true);
  }, [item.input, item.groundTruth]);

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

    try {
      await updateItem.mutateAsync({
        datasetId,
        itemId: item.id,
        input: parsedInput,
        groundTruth: parsedGroundTruth,
      });
      toast.success('Item updated');
      setIsEditing(false);
    } catch (error) {
      toast.error(`Failed to update: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [inputValue, groundTruthValue, datasetId, item.id, updateItem]);

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
