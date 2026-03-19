import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  ThumbsUp,
  ThumbsDown,
  Trash2,
  Loader2,
  X,
  Plus,
  Tag,
  ChevronDown,
  Pencil,
  Check,
  CheckCircle,
} from 'lucide-react';
import { useMastraClient } from '@mastra/react';

import { Txt } from '@/ds/components/Txt';
import { Button, ButtonWithTooltip } from '@/ds/components/Button';
import { Badge } from '@/ds/components/Badge';
import { TooltipProvider } from '@/ds/components/Tooltip';
import { Icon } from '@/ds/icons/Icon';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { Textarea } from '@/ds/components/Textarea';
import { Input } from '@/ds/components/Input';
import { Label } from '@/ds/components/Label';
import { Spinner } from '@/ds/components/Spinner';
import { Popover, PopoverTrigger, PopoverContent } from '@/ds/components/Popover';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/ds/components/Dialog';
import { Checkbox } from '@/ds/components/Checkbox';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';

import { useReviewQueue, type ReviewItem } from '../../context/review-queue-context';
import { useReviewItems } from '../../hooks/use-review-items';
import { useCompletedItems } from '../../hooks/use-completed-items';
import { usePlaygroundModel } from '../../context/playground-model-context';
import { LLMProviders, LLMModels, cleanProviderId } from '@/domains/llm';
import { useDatasets } from '@/domains/datasets/hooks/use-datasets';
import { useDatasetMutations } from '@/domains/datasets/hooks/use-dataset-mutations';

function formatUnknown(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

interface AgentPlaygroundReviewProps {
  agentId: string;
  onCreateScorer?: (items: Array<{ input: unknown; output: unknown }>) => void;
}

export function AgentPlaygroundReview({ agentId, onCreateScorer }: AgentPlaygroundReviewProps) {
  const { items, setItemTags, rateItem, commentItem, removeItem, completeItem, loadPersistedItems } = useReviewQueue();
  const { data: persistedItems } = useReviewItems(agentId);
  const { data: completedItems, refetch: refetchCompleted } = useCompletedItems(agentId);
  const client = useMastraClient();
  const { provider, model } = usePlaygroundModel();
  const { data: allDatasets } = useDatasets();
  const { updateDataset } = useDatasetMutations();

  // Load persisted review items on mount / when data changes
  useEffect(() => {
    if (persistedItems && persistedItems.length > 0) {
      loadPersistedItems(persistedItems);
    }
  }, [persistedItems, loadPersistedItems]);

  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [showCompleted, setShowCompleted] = useState(false);

  // Analyze config dialog
  const [showAnalyzeDialog, setShowAnalyzeDialog] = useState(false);
  const [analyzeMode, setAnalyzeMode] = useState<'untagged' | 'selected'>('untagged');
  const [analyzePrompt, setAnalyzePrompt] = useState('');
  const [analyzeProvider, setAnalyzeProvider] = useState(provider);
  const [analyzeModel, setAnalyzeModel] = useState(model);

  // Proposed tag assignments from Analyze
  const [proposedAssignments, setProposedAssignments] = useState<
    Array<{ itemId: string; tags: string[]; reason: string; accepted: boolean }>
  >([]);
  const [showProposalDialog, setShowProposalDialog] = useState(false);
  const [analysisModelId, setAnalysisModelId] = useState<string | null>(null);

  // Collect tag vocabulary from datasets that items belong to
  const datasets = allDatasets?.datasets;
  const datasetTagVocabulary = useMemo(() => {
    if (!datasets) return [] as string[];
    const datasetIds = new Set(items.map(i => i.datasetId).filter(Boolean));
    const vocab = new Set<string>();
    for (const ds of datasets) {
      if (datasetIds.has(ds.id) && Array.isArray((ds as any).tags)) {
        for (const t of (ds as any).tags) vocab.add(t);
      }
    }
    // Also include any tags already applied to items
    for (const item of items) {
      for (const t of item.tags) vocab.add(t);
    }
    return Array.from(vocab).sort();
  }, [datasets, items]);

  // Sync new tags back to dataset vocabulary
  const syncTagToDataset = useCallback(
    (tag: string) => {
      if (!datasets) return;
      // Find which datasets are in use and add the tag if missing
      const datasetIds = new Set(items.map(i => i.datasetId).filter(Boolean));
      for (const ds of datasets) {
        if (datasetIds.has(ds.id)) {
          const existingTags: string[] = Array.isArray((ds as any).tags) ? (ds as any).tags : [];
          if (!existingTags.includes(tag)) {
            updateDataset.mutate({
              datasetId: ds.id,
              tags: [...existingTags, tag],
            } as any);
          }
        }
      }
    },
    [datasets, items, updateDataset],
  );

  const openAnalyzeDialog = useCallback(
    (mode: 'untagged' | 'selected') => {
      setAnalyzeMode(mode);
      setAnalyzePrompt('');
      setAnalyzeProvider(provider);
      setAnalyzeModel(model);
      setShowAnalyzeDialog(true);
    },
    [provider, model],
  );

  const handleAnalyze = useCallback(async () => {
    if (!analyzeProvider || !analyzeModel) return;
    const targetItems =
      analyzeMode === 'untagged'
        ? items.filter(i => i.tags.length === 0)
        : items.filter(i => selectedItemIds.has(i.id));

    if (targetItems.length === 0) return;

    setShowAnalyzeDialog(false);
    setIsAnalyzing(true);
    try {
      const modelId = `${analyzeProvider}/${analyzeModel}`;
      const result = await client.clusterFailures({
        modelId,
        items: targetItems.map(item => ({
          id: item.id,
          input: item.input,
          output: item.output,
          error: typeof item.error === 'string' ? item.error : item.error ? JSON.stringify(item.error) : undefined,
          scores: item.scores,
          existingTags: item.tags.length > 0 ? item.tags : undefined,
        })),
        availableTags: datasetTagVocabulary.length > 0 ? datasetTagVocabulary : undefined,
        prompt: analyzePrompt.trim() || undefined,
      });

      // Build per-item proposed tags from the response
      const proposals = (result.proposedTags ?? [])
        .filter((p: any) => p.tags.length > 0)
        .map((p: any) => ({
          itemId: p.itemId,
          tags: p.tags as string[],
          reason: (p.reason as string) || '',
          accepted: true, // accepted by default
        }));

      if (proposals.length > 0) {
        setAnalysisModelId(modelId);
        setProposedAssignments(proposals);
        setShowProposalDialog(true);
      } else {
        toast.success('Analysis complete — no new tags proposed.');
      }
    } catch (err) {
      console.error('Failed to analyze failures:', err);
      toast.error('Analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  }, [items, analyzeProvider, analyzeModel, client, selectedItemIds, datasetTagVocabulary, analyzeMode, analyzePrompt]);

  const handleAcceptProposals = useCallback(() => {
    const accepted = proposedAssignments.filter(p => p.accepted);
    for (const proposal of accepted) {
      const item = items.find(i => i.id === proposal.itemId);
      if (item) {
        const merged = Array.from(new Set([...item.tags, ...proposal.tags]));
        setItemTags(proposal.itemId, merged);
      }
    }
    const allNewTags = new Set(accepted.flatMap(p => p.tags));
    for (const tag of allNewTags) {
      syncTagToDataset(tag);
    }
    const tagCount = allNewTags.size;
    const itemCount = accepted.length;
    toast.success(
      `Applied ${tagCount} tag${tagCount !== 1 ? 's' : ''} to ${itemCount} item${itemCount !== 1 ? 's' : ''}`,
    );
    setShowProposalDialog(false);
    setProposedAssignments([]);
  }, [proposedAssignments, items, setItemTags, syncTagToDataset]);

  // Filter items by tag
  const filteredItems = useMemo(() => {
    let result = items;
    if (activeTagFilter) {
      if (activeTagFilter === '__untagged__') {
        result = result.filter(i => i.tags.length === 0);
      } else {
        result = result.filter(i => i.tags.includes(activeTagFilter));
      }
    }
    return result;
  }, [items, activeTagFilter]);

  // Collect all unique tags with counts
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      for (const tag of item.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return counts;
  }, [items]);

  const untaggedCount = items.filter(i => i.tags.length === 0).length;

  // Rating counts
  const ratingCounts = useMemo(
    () => ({
      positive: items.filter(i => i.rating === 'positive').length,
      negative: items.filter(i => i.rating === 'negative').length,
    }),
    [items],
  );

  // Bulk selection
  const toggleSelect = useCallback((id: string) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedItemIds.size === filteredItems.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(filteredItems.map(i => i.id)));
    }
  }, [selectedItemIds.size, filteredItems]);

  const handleBulkTag = useCallback(
    (tag: string) => {
      for (const id of selectedItemIds) {
        const item = items.find(i => i.id === id);
        if (item && !item.tags.includes(tag)) {
          setItemTags(id, [...item.tags, tag]);
        }
      }
      syncTagToDataset(tag);
    },
    [selectedItemIds, items, setItemTags, syncTagToDataset],
  );

  const handleBulkRemoveTag = useCallback(
    (tag: string) => {
      for (const id of selectedItemIds) {
        const item = items.find(i => i.id === id);
        if (item && item.tags.includes(tag)) {
          setItemTags(
            id,
            item.tags.filter(t => t !== tag),
          );
        }
      }
    },
    [selectedItemIds, items, setItemTags],
  );

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left sidebar */}
      <div className="w-[280px] flex-shrink-0 border-r border-border1 flex flex-col overflow-hidden">
        <div className="p-3 flex-1 overflow-y-auto">
          {/* Analyze + Tags */}
          <div className="flex items-center justify-between mb-2">
            <Txt variant="ui-xs" className="text-neutral3 font-semibold uppercase tracking-wider">
              Tags
            </Txt>
            <DropdownMenu>
              <DropdownMenu.Trigger asChild>
                <Button variant="ghost" size="sm" disabled={items.length === 0 || isAnalyzing}>
                  {isAnalyzing ? (
                    <>
                      <Icon size="sm">
                        <Loader2 className="animate-spin" />
                      </Icon>
                      Analyzing...
                    </>
                  ) : (
                    <>
                      Analyze
                      <Icon size="sm">
                        <ChevronDown />
                      </Icon>
                    </>
                  )}
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="end">
                <DropdownMenu.Item disabled={untaggedCount === 0} onSelect={() => openAnalyzeDialog('untagged')}>
                  Analyze untagged ({untaggedCount})
                </DropdownMenu.Item>
                <DropdownMenu.Item disabled={selectedItemIds.size === 0} onSelect={() => openAnalyzeDialog('selected')}>
                  Analyze selected ({selectedItemIds.size})
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu>
          </div>

          {items.length === 0 ? (
            <div className="px-2 py-8 text-center">
              <Txt variant="ui-xs" className="text-neutral3">
                No items to review yet.
              </Txt>
              <Txt variant="ui-xs" className="text-neutral3 mt-1 block">
                Run experiments in the Evaluate tab, then send failures here for analysis.
              </Txt>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTagFilter(null);
                    setShowCompleted(false);
                  }}
                  className={cn(
                    'w-full text-left px-2 py-1 rounded-md text-xs transition-colors',
                    !activeTagFilter && !showCompleted
                      ? 'bg-accent1/10 text-accent1'
                      : 'hover:bg-surface3 text-neutral4',
                  )}
                >
                  All ({items.length})
                </button>
                {Array.from(tagCounts.entries()).map(([tag, count]) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      setActiveTagFilter(activeTagFilter === tag ? null : tag);
                      setShowCompleted(false);
                    }}
                    className={cn(
                      'w-full text-left px-2 py-1 rounded-md text-xs transition-colors flex items-center justify-between',
                      activeTagFilter === tag && !showCompleted
                        ? 'bg-accent1/10 text-accent1'
                        : 'hover:bg-surface3 text-neutral4',
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      <Icon size="sm">
                        <Tag />
                      </Icon>
                      {tag}
                    </span>
                    <Badge variant="default">{count}</Badge>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTagFilter(activeTagFilter === '__untagged__' ? null : '__untagged__');
                    setShowCompleted(false);
                  }}
                  className={cn(
                    'w-full text-left px-2 py-1 rounded-md text-xs transition-colors',
                    activeTagFilter === '__untagged__' && !showCompleted
                      ? 'bg-accent1/10 text-accent1'
                      : 'hover:bg-surface3 text-neutral4',
                  )}
                >
                  Untagged ({untaggedCount})
                </button>
              </div>
            </div>
          )}

          {/* Rating summary */}
          {items.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border1 space-y-1">
              <Txt variant="ui-xs" className="text-neutral3 font-semibold uppercase tracking-wider mb-2">
                Ratings
              </Txt>
              <div className="flex items-center gap-2">
                <Badge variant="success">
                  <Icon size="sm">
                    <ThumbsUp />
                  </Icon>
                  {ratingCounts.positive}
                </Badge>
                <Badge variant="error">
                  <Icon size="sm">
                    <ThumbsDown />
                  </Icon>
                  {ratingCounts.negative}
                </Badge>
              </div>
            </div>
          )}

          {/* Completed items toggle */}
          <div className="mt-4 pt-3 border-t border-border1">
            <button
              type="button"
              onClick={() => {
                setShowCompleted(!showCompleted);
                if (!showCompleted) setActiveTagFilter(null);
              }}
              className={cn(
                'w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors flex items-center justify-between',
                showCompleted ? 'bg-positive1/10 text-positive1' : 'hover:bg-surface3 text-neutral4',
              )}
            >
              <span className="flex items-center gap-1.5">
                <Icon size="sm">
                  <CheckCircle />
                </Icon>
                Completed
              </span>
              <Badge variant="default">{completedItems?.length ?? 0}</Badge>
            </button>
          </div>
        </div>
      </div>

      {/* Right: Annotation queue or Completed view */}
      <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
        {showCompleted ? (
          <>
            <div className="p-3 border-b border-border1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon size="sm" className="text-positive1">
                    <CheckCircle />
                  </Icon>
                  <Txt variant="ui-sm" className="text-neutral5 font-medium">
                    Completed Reviews
                  </Txt>
                </div>
                <Txt variant="ui-xs" className="text-neutral3">
                  {completedItems?.length ?? 0} item{(completedItems?.length ?? 0) !== 1 ? 's' : ''}
                </Txt>
              </div>
            </div>
            {!completedItems || completedItems.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center px-8">
                  <Txt variant="ui-sm" className="text-neutral3 block">
                    No completed reviews yet
                  </Txt>
                  <Txt variant="ui-xs" className="text-neutral3 mt-2 block">
                    Items marked as complete will appear here for auditing.
                  </Txt>
                </div>
              </div>
            ) : (
              <ScrollArea className="flex-1 min-h-0">
                <div className="p-2 space-y-2">
                  {completedItems.map(item => (
                    <ReviewItemCard
                      key={item.id}
                      item={item}
                      isExpanded={expandedItemId === item.id}
                      isSelected={false}
                      isCompleted
                      onToggleSelect={() => {}}
                      onToggleExpand={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)}
                      onRate={() => {}}
                      onSetTags={() => {}}
                      onComment={() => {}}
                      onRemove={() => {}}
                      tagVocabulary={[]}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </>
        ) : (
          <>
            <div className="p-3 border-b border-border1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Txt variant="ui-sm" className="text-neutral5 font-medium">
                    Review Queue
                  </Txt>
                  {filteredItems.length > 1 && (
                    <button type="button" onClick={toggleSelectAll} className="text-xs text-accent1 hover:underline">
                      {selectedItemIds.size === filteredItems.length ? 'Deselect all' : 'Select all'}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {selectedItemIds.size > 0 && (
                    <BulkTagPicker
                      selectedCount={selectedItemIds.size}
                      vocabulary={datasetTagVocabulary}
                      onApplyTag={handleBulkTag}
                      onRemoveTag={handleBulkRemoveTag}
                      onNewTag={tag => {
                        handleBulkTag(tag);
                      }}
                    />
                  )}
                  {onCreateScorer && filteredItems.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onCreateScorer(
                          filteredItems.map(item => ({
                            input: item.input,
                            output: item.output,
                          })),
                        );
                      }}
                    >
                      Create Scorer ({filteredItems.length})
                    </Button>
                  )}
                  <Txt variant="ui-xs" className="text-neutral3">
                    {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}
                  </Txt>
                </div>
              </div>
            </div>

            {filteredItems.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center px-8">
                  <Txt variant="ui-sm" className="text-neutral3 block">
                    No items to review
                  </Txt>
                  <Txt variant="ui-xs" className="text-neutral3 mt-2 block">
                    When you identify failures in experiment results, send them here to annotate, cluster, and create
                    scorers from failure patterns.
                  </Txt>
                </div>
              </div>
            ) : (
              <ScrollArea className="flex-1 min-h-0">
                <div className="p-2 space-y-2">
                  {filteredItems.map(item => (
                    <ReviewItemCard
                      key={item.id}
                      item={item}
                      isExpanded={expandedItemId === item.id}
                      isSelected={selectedItemIds.has(item.id)}
                      onToggleSelect={() => toggleSelect(item.id)}
                      onToggleExpand={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)}
                      onRate={rating => rateItem(item.id, rating)}
                      onSetTags={tags => {
                        setItemTags(item.id, tags);
                        // Sync new tags to dataset vocabulary
                        for (const t of tags) {
                          if (!datasetTagVocabulary.includes(t)) {
                            syncTagToDataset(t);
                          }
                        }
                      }}
                      onComment={comment => commentItem(item.id, comment)}
                      onRemove={() => removeItem(item.id)}
                      onComplete={async () => {
                        await completeItem(item.id);
                        refetchCompleted();
                      }}
                      tagVocabulary={datasetTagVocabulary}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </>
        )}
      </div>

      {/* Analyze configuration dialog */}
      <Dialog open={showAnalyzeDialog} onOpenChange={setShowAnalyzeDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Analyze {analyzeMode === 'untagged' ? 'Untagged' : 'Selected'} Items</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Model</Label>
                <div className="flex items-center gap-1.5">
                  <div className="w-[160px]">
                    <LLMProviders
                      value={analyzeProvider}
                      onValueChange={value => {
                        const cleaned = cleanProviderId(value);
                        setAnalyzeProvider(cleaned);
                        setAnalyzeModel('');
                      }}
                      size="sm"
                    />
                  </div>
                  <div className="flex-1">
                    <LLMModels llmId={analyzeProvider} value={analyzeModel} onValueChange={setAnalyzeModel} size="sm" />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <Label>Items</Label>
                <Txt variant="ui-sm" className="text-neutral4">
                  {analyzeMode === 'untagged'
                    ? `${untaggedCount} untagged item${untaggedCount !== 1 ? 's' : ''}`
                    : `${selectedItemIds.size} selected item${selectedItemIds.size !== 1 ? 's' : ''}`}
                </Txt>
              </div>

              <div className="space-y-1">
                <Label>Instructions (optional)</Label>
                <Textarea
                  value={analyzePrompt}
                  onChange={e => setAnalyzePrompt(e.target.value)}
                  placeholder="e.g., Focus on tool usage failures, pay attention to whether the agent hallucinated..."
                  rows={3}
                  disabled={isAnalyzing}
                />
                <Txt variant="ui-xs" className="text-neutral2">
                  Guide the LLM on what to look for when tagging items
                </Txt>
              </div>
            </div>
          </DialogBody>
          <DialogFooter className="px-6">
            <Button variant="ghost" onClick={() => setShowAnalyzeDialog(false)} disabled={isAnalyzing}>
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={handleAnalyze}
              disabled={isAnalyzing || !analyzeProvider || !analyzeModel}
            >
              {isAnalyzing ? (
                <>
                  <Spinner className="mr-2" />
                  Analyzing...
                </>
              ) : (
                'Analyze'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Proposal confirmation dialog */}
      <Dialog open={showProposalDialog} onOpenChange={setShowProposalDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Proposed Tag Assignments</DialogTitle>
            {analysisModelId && (
              <Txt variant="ui-xs" className="text-neutral3 mt-1">
                Analyzed by <span className="font-medium text-neutral4">{analysisModelId}</span>
              </Txt>
            )}
          </DialogHeader>
          <DialogBody className="max-h-[400px] overflow-y-auto space-y-2">
            {proposedAssignments.map((proposal, idx) => {
              const item = items.find(i => i.id === proposal.itemId);
              const inputStr =
                typeof item?.input === 'string' ? item.input : item?.input ? JSON.stringify(item.input) : '';
              return (
                <div
                  key={proposal.itemId}
                  className={cn(
                    'flex items-start gap-2 p-2 rounded-md border border-border1',
                    proposal.accepted ? 'bg-surface1' : 'bg-surface1 opacity-50',
                  )}
                >
                  <Checkbox
                    checked={proposal.accepted}
                    onCheckedChange={checked => {
                      setProposedAssignments(prev =>
                        prev.map((p, i) => (i === idx ? { ...p, accepted: !!checked } : p)),
                      );
                    }}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <Txt variant="ui-xs" className="text-neutral4 truncate block">
                      {inputStr || `Item ${proposal.itemId.slice(0, 8)}`}
                    </Txt>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {proposal.tags.map((tag, tagIdx) => (
                        <ProposalTag
                          key={`${tag}-${tagIdx}`}
                          tag={tag}
                          onRename={newTag => {
                            setProposedAssignments(prev =>
                              prev.map((p, i) =>
                                i === idx
                                  ? {
                                      ...p,
                                      tags: p.tags.map((t, ti) => (ti === tagIdx ? newTag.trim() : t)).filter(Boolean),
                                    }
                                  : p,
                              ),
                            );
                          }}
                          onRemove={() => {
                            setProposedAssignments(prev =>
                              prev.map((p, i) =>
                                i === idx ? { ...p, tags: p.tags.filter((_, ti) => ti !== tagIdx) } : p,
                              ),
                            );
                          }}
                        />
                      ))}
                    </div>
                    {proposal.reason && (
                      <Txt variant="ui-xs" className="text-neutral3 mt-1 block italic">
                        {proposal.reason}
                      </Txt>
                    )}
                  </div>
                </div>
              );
            })}
          </DialogBody>
          <DialogFooter className="px-6">
            <Button variant="ghost" onClick={() => setShowProposalDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={handleAcceptProposals}
              disabled={!proposedAssignments.some(p => p.accepted)}
            >
              Apply ({proposedAssignments.filter(p => p.accepted).length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ----- Proposal Tag (editable inline) -----

function ProposalTag({
  tag,
  onRename,
  onRemove,
}: {
  tag: string;
  onRename: (newTag: string) => void;
  onRemove: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(tag);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleConfirm = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== tag) {
      onRename(trimmed);
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <span className="inline-flex items-center gap-0.5 bg-surface3 border border-border1 rounded-md px-1">
        <input
          ref={inputRef}
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleConfirm();
            }
            if (e.key === 'Escape') {
              setEditValue(tag);
              setIsEditing(false);
            }
          }}
          onBlur={handleConfirm}
          className="bg-transparent text-xs text-neutral4 outline-none w-20 py-0.5"
        />
        <button
          type="button"
          onMouseDown={e => {
            e.preventDefault();
            handleConfirm();
          }}
          className="text-positive1 hover:text-positive2 p-0.5"
        >
          <Check className="w-3 h-3" />
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-0.5 bg-surface3 border border-border1 rounded-md px-1.5 py-0.5 text-xs text-neutral4 group">
      {tag}
      <button
        type="button"
        onClick={() => {
          setEditValue(tag);
          setIsEditing(true);
        }}
        className="text-neutral2 hover:text-neutral4 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Edit tag"
      >
        <Pencil className="w-3 h-3" />
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="text-neutral2 hover:text-negative1 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Remove tag"
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

// ----- Tag Picker -----

function TagPicker({
  tags,
  vocabulary,
  onSetTags,
}: {
  tags: string[];
  vocabulary: string[];
  onSetTags: (tags: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = vocabulary.filter(t => !tags.includes(t) && t.toLowerCase().includes(search.toLowerCase()));

  const canCreate = search.trim() && !vocabulary.includes(search.trim()) && !tags.includes(search.trim());

  const addTag = (tag: string) => {
    onSetTags([...tags, tag]);
    setSearch('');
  };

  const removeTag = (tag: string) => {
    onSetTags(tags.filter(t => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && search.trim()) {
      e.preventDefault();
      addTag(search.trim());
    }
  };

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {tags.map(tag => (
        <span
          key={tag}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-accent1/10 text-accent1 text-[10px] font-medium"
        >
          {tag}
          <button type="button" onClick={() => removeTag(tag)} className="hover:text-accent1/70">
            <X className="w-2.5 h-2.5" />
          </button>
        </span>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] text-neutral3 hover:text-neutral5 hover:bg-surface3 transition-colors"
          >
            <Plus className="w-3 h-3" />
            tag
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-2" align="start">
          <Input
            ref={inputRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search or create tag..."
            className="h-7 text-xs mb-1"
            autoFocus
          />
          <div className="max-h-32 overflow-y-auto space-y-0.5">
            {filtered.map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => addTag(tag)}
                className="w-full text-left px-2 py-1 text-xs rounded hover:bg-surface3 text-neutral4"
              >
                {tag}
              </button>
            ))}
            {canCreate && (
              <button
                type="button"
                onClick={() => addTag(search.trim())}
                className="w-full text-left px-2 py-1 text-xs rounded hover:bg-surface3 text-accent1"
              >
                Create &quot;{search.trim()}&quot;
              </button>
            )}
            {filtered.length === 0 && !canCreate && (
              <Txt variant="ui-xs" className="text-neutral2 px-2 py-1">
                {vocabulary.length === 0 ? 'Type to create a tag' : 'No matching tags'}
              </Txt>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ----- Bulk Tag Picker -----

function BulkTagPicker({
  selectedCount,
  vocabulary,
  onApplyTag,
  onRemoveTag,
  onNewTag,
}: {
  selectedCount: number;
  vocabulary: string[];
  onApplyTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onNewTag: (tag: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = vocabulary.filter(t => t.toLowerCase().includes(search.toLowerCase()));
  const canCreate = search.trim() && !vocabulary.includes(search.trim());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Icon size="sm">
            <Tag />
          </Icon>
          Tag {selectedCount} items
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="end">
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && search.trim()) {
              e.preventDefault();
              if (canCreate) {
                onNewTag(search.trim());
              } else {
                onApplyTag(search.trim());
              }
              setSearch('');
            }
          }}
          placeholder="Search or create tag..."
          className="h-7 text-xs mb-1"
          autoFocus
        />
        <div className="max-h-40 overflow-y-auto space-y-0.5">
          {filtered.map(tag => (
            <div key={tag} className="flex items-center justify-between px-2 py-1 text-xs rounded hover:bg-surface3">
              <button type="button" onClick={() => onApplyTag(tag)} className="text-left flex-1 text-neutral4">
                {tag}
              </button>
              <button
                type="button"
                onClick={() => onRemoveTag(tag)}
                className="text-neutral2 hover:text-negative1 ml-2"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {canCreate && (
            <button
              type="button"
              onClick={() => {
                onNewTag(search.trim());
                setSearch('');
              }}
              className="w-full text-left px-2 py-1 text-xs rounded hover:bg-surface3 text-accent1"
            >
              Create &amp; apply &quot;{search.trim()}&quot;
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ----- Review Item Card -----

function ReviewItemCard({
  item,
  isExpanded,
  isSelected,
  isCompleted,
  onToggleSelect,
  onToggleExpand,
  onRate,
  onSetTags,
  onComment,
  onRemove,
  onComplete,
  tagVocabulary,
}: {
  item: ReviewItem;
  isExpanded: boolean;
  isSelected: boolean;
  isCompleted?: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onRate: (rating: 'positive' | 'negative' | undefined) => void;
  onSetTags: (tags: string[]) => void;
  onComment: (comment: string) => void;
  onRemove: () => void;
  onComplete?: () => void | Promise<void>;
  tagVocabulary: string[];
}) {
  const [localComment, setLocalComment] = useState(item.comment || '');
  const [commentSaved, setCommentSaved] = useState(false);

  const inputPreview = (() => {
    try {
      if (typeof item.input === 'string') return item.input.slice(0, 80);
      return JSON.stringify(item.input).slice(0, 80);
    } catch {
      return String(item.input).slice(0, 80);
    }
  })();

  return (
    <div
      className={cn(
        'border border-border1 rounded-lg p-3 transition-colors',
        isSelected && 'ring-1 ring-accent1',
        item.tags.length > 0 && 'border-l-2 border-l-accent1',
      )}
    >
      {/* Header row */}
      <div className="flex items-center gap-2">
        {isCompleted ? (
          <Icon size="sm" className="text-positive1 shrink-0">
            <CheckCircle />
          </Icon>
        ) : (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="w-3.5 h-3.5 rounded border-border1 accent-accent1"
          />
        )}
        <button type="button" onClick={onToggleExpand} className="flex-1 text-left min-w-0">
          <Txt variant="ui-xs" className="text-neutral4 truncate block">
            {inputPreview}
          </Txt>
        </button>
      </div>

      {/* Error indicator */}
      {Boolean(item.error) && (
        <Txt variant="ui-xs" className="text-negative1 mt-1 block truncate">
          Error: {typeof item.error === 'string' ? item.error : 'Failed'}
        </Txt>
      )}

      {/* Rating + Tags + Remove row */}
      <TooltipProvider delayDuration={200}>
        <div className="flex items-center gap-2 mt-2">
          {/* Rating: thumbs up / down */}
          <div className="flex items-center gap-0.5 mr-1">
            <ButtonWithTooltip
              tooltipContent="Good — this result is acceptable"
              variant={item.rating === 'positive' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onRate(item.rating === 'positive' ? undefined : 'positive')}
              disabled={isCompleted}
            >
              <Icon size="sm" className={item.rating === 'positive' ? 'text-positive1' : ''}>
                <ThumbsUp />
              </Icon>
            </ButtonWithTooltip>
            <ButtonWithTooltip
              tooltipContent="Bad — this result is wrong"
              variant={item.rating === 'negative' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onRate(item.rating === 'negative' ? undefined : 'negative')}
              disabled={isCompleted}
            >
              <Icon size="sm" className={item.rating === 'negative' ? 'text-negative1' : ''}>
                <ThumbsDown />
              </Icon>
            </ButtonWithTooltip>
          </div>

          {/* Tags */}
          <div className="flex-1 min-w-0">
            {isCompleted ? (
              item.tags.length > 0 ? (
                <div className="flex items-center gap-1 flex-wrap">
                  {item.tags.map(t => (
                    <Badge key={t} variant="default">
                      {t}
                    </Badge>
                  ))}
                </div>
              ) : null
            ) : (
              <TagPicker tags={item.tags} vocabulary={tagVocabulary} onSetTags={onSetTags} />
            )}
          </div>

          {!isCompleted && (
            <>
              {/* Mark complete — only enabled if item has tags or a comment */}
              <ButtonWithTooltip
                tooltipContent={
                  item.tags.length > 0 || item.comment ? 'Mark as complete' : 'Add a tag or comment before completing'
                }
                variant="ghost"
                size="sm"
                onClick={onComplete}
                disabled={item.tags.length === 0 && !item.comment}
              >
                <Icon size="sm" className={item.tags.length > 0 || item.comment ? 'text-positive1' : 'text-neutral3'}>
                  <CheckCircle />
                </Icon>
              </ButtonWithTooltip>

              {/* Delete from review */}
              <ButtonWithTooltip tooltipContent="Delete from review queue" variant="ghost" size="sm" onClick={onRemove}>
                <Icon size="sm" className="text-neutral3">
                  <Trash2 />
                </Icon>
              </ButtonWithTooltip>
            </>
          )}
        </div>
      </TooltipProvider>

      {/* Scores from experiment */}
      {item.scores && Object.keys(item.scores).length > 0 && (
        <div className="flex items-center gap-2 mt-1.5">
          {Object.entries(item.scores).map(([scorerId, score]) => (
            <Badge key={scorerId} variant={score >= 0.5 ? 'success' : 'error'}>
              {scorerId.slice(0, 12)}: {score.toFixed(3)}
            </Badge>
          ))}
        </div>
      )}

      {/* Expanded content */}
      {isExpanded && (
        <div className="mt-3 space-y-2 pt-2 border-t border-border1">
          <div>
            <Txt variant="ui-xs" className="text-neutral3 font-medium block mb-1">
              Input
            </Txt>
            <pre className="text-xs text-neutral4 bg-surface3 rounded px-3 py-2 overflow-x-auto whitespace-pre-wrap break-words max-h-24 overflow-y-auto">
              {typeof item.input === 'string' ? item.input : JSON.stringify(item.input, null, 2)}
            </pre>
          </div>
          <div>
            <Txt variant="ui-xs" className="text-neutral3 font-medium block mb-1">
              {item.error ? 'Error' : 'Output'}
            </Txt>
            <pre
              className={cn(
                'text-xs rounded px-3 py-2 overflow-x-auto whitespace-pre-wrap break-words max-h-24 overflow-y-auto',
                item.error ? 'text-negative1 bg-negative1/10' : 'text-neutral4 bg-surface3',
              )}
            >
              {formatUnknown(item.error || item.output)}
            </pre>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Txt variant="ui-xs" className="text-neutral3 font-medium">
                Comment
              </Txt>
              {commentSaved && (
                <Txt variant="ui-xs" className="text-positive1">
                  Saved
                </Txt>
              )}
            </div>
            <Textarea
              value={localComment}
              onChange={e => {
                setLocalComment(e.target.value);
                setCommentSaved(false);
              }}
              onBlur={() => {
                if (localComment !== item.comment) {
                  onComment(localComment);
                  setCommentSaved(true);
                  setTimeout(() => setCommentSaved(false), 2000);
                }
              }}
              placeholder="What went wrong? How should this be handled?"
              rows={2}
            />
            <Txt variant="ui-xs" className="text-neutral2 mt-0.5">
              Saves automatically on blur
            </Txt>
          </div>
        </div>
      )}
    </div>
  );
}
