import { useMastraClient } from '@mastra/react';
import { CheckCircle, ChevronDown, Sparkles } from 'lucide-react';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useDatasetReviewItems, useDatasetCompletedItems } from '../hooks/use-dataset-review-items';
import { ProposalTag } from './proposal-tag';
import type { ReviewItem } from './review-item-card';
import { ReviewItemCard } from './review-item-card';
import { useDatasetMutations } from '@/domains/datasets/hooks/use-dataset-mutations';
import { useDataset } from '@/domains/datasets/hooks/use-datasets';
import { LLMProviders, LLMModels } from '@/domains/llm';
import { BulkTagPicker } from '@/domains/shared/components/bulk-tag-picker';
import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import { Checkbox } from '@/ds/components/Checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ds/components/Dialog';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import { Label } from '@/ds/components/Label';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { Spinner } from '@/ds/components/Spinner';
import { Textarea } from '@/ds/components/Textarea';
import { Txt } from '@/ds/components/Txt';
import { Icon } from '@/ds/icons/Icon';
import { cn } from '@/lib/utils';
export interface DatasetReviewProps {
  datasetId: string;
}

export function DatasetReview({ datasetId }: DatasetReviewProps) {
  const client = useMastraClient();
  const { data: dataset } = useDataset(datasetId);
  const { data: reviewItems, isLoading: isLoadingReview } = useDatasetReviewItems(datasetId);
  const { data: completedItems, isLoading: isLoadingCompleted } = useDatasetCompletedItems(datasetId);
  const { updateExperimentResult } = useDatasetMutations();

  // Local state
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [showCompleted, setShowCompleted] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Analyze dialog
  const [showAnalyzeDialog, setShowAnalyzeDialog] = useState(false);
  const [analyzeMode, setAnalyzeMode] = useState<'untagged' | 'selected'>('untagged');
  const [analyzePrompt, setAnalyzePrompt] = useState('');
  const [analyzeProvider, setAnalyzeProvider] = useState('');
  const [analyzeModel, setAnalyzeModel] = useState('');

  // Proposal dialog
  const [proposedAssignments, setProposedAssignments] = useState<
    Array<{ itemId: string; tags: string[]; reason: string; accepted: boolean }>
  >([]);
  const [showProposalDialog, setShowProposalDialog] = useState(false);

  // Items in local state — null means "not hydrated yet", [] means "user cleared all"
  const [localItems, setLocalItems] = useState<ReviewItem[] | null>(null);
  const items = localItems ?? reviewItems ?? [];

  // Sync server data to local on initial load
  useEffect(() => {
    if (reviewItems && localItems === null) {
      setLocalItems(reviewItems);
    }
  }, [reviewItems]);

  // Tag vocabulary from dataset + existing item tags
  const datasetTagVocabulary = useMemo(() => {
    const tags = new Set<string>();
    if (dataset?.tags) {
      for (const t of dataset.tags) tags.add(t);
    }
    for (const item of items) {
      for (const t of item.tags) tags.add(t);
    }
    return [...tags].sort();
  }, [dataset, items]);

  const syncTagToDataset = useCallback(
    (tag: string) => {
      if (!dataset || !datasetId) return;
      const currentTags = dataset.tags ?? [];
      if (currentTags.includes(tag)) return;
      // We don't have updateDataset tags directly — tags are synced via item updates
    },
    [dataset, datasetId],
  );

  // Filtered items
  const filteredItems = useMemo(() => {
    if (!activeTagFilter) return items;
    if (activeTagFilter === '__untagged__') return items.filter(i => i.tags.length === 0);
    return items.filter(i => i.tags.includes(activeTagFilter));
  }, [items, activeTagFilter]);

  // Tag counts
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      for (const tag of item.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  const untaggedCount = useMemo(() => items.filter(i => i.tags.length === 0).length, [items]);

  // Rating counts
  const ratingCounts = useMemo(() => {
    let positive = 0;
    let negative = 0;
    for (const item of items) {
      if (item.rating === 'positive') positive++;
      if (item.rating === 'negative') negative++;
    }
    return { positive, negative };
  }, [items]);

  // Item actions
  const setItemTags = useCallback(
    (itemId: string, tags: string[]) => {
      setLocalItems(prev => (prev ?? []).map(i => (i.id === itemId ? { ...i, tags } : i)));
      const item = items.find(i => i.id === itemId);
      if (item?.experimentId && item?.datasetId) {
        updateExperimentResult.mutate({
          datasetId: item.datasetId,
          experimentId: item.experimentId,
          resultId: item.id,
          tags,
        });
      }
    },
    [items, updateExperimentResult],
  );

  const rateItem = useCallback(
    (itemId: string, rating: 'positive' | 'negative' | undefined) => {
      const item = items.find(i => i.id === itemId);
      if (item?.traceId && rating !== undefined) {
        client
          .createFeedback({
            feedback: {
              traceId: item.traceId,
              source: 'studio',
              feedbackSource: 'studio',
              feedbackType: 'rating',
              value: rating === 'positive' ? 1 : -1,
              experimentId: item.experimentId ?? undefined,
              sourceId: item.id,
            },
          })
          .catch(() => {});
      }
      setLocalItems(prev => (prev ?? []).map(i => (i.id === itemId ? { ...i, rating } : i)));
    },
    [items, client],
  );

  const commentItem = useCallback(
    (itemId: string, comment: string) => {
      const item = items.find(i => i.id === itemId);
      if (item?.traceId) {
        client
          .createFeedback({
            feedback: {
              traceId: item.traceId,
              source: 'studio',
              feedbackSource: 'studio',
              feedbackType: 'comment',
              value: comment,
              comment,
              experimentId: item.experimentId ?? undefined,
              sourceId: item.id,
            },
          })
          .catch(() => {});
      }
      setLocalItems(prev => (prev ?? []).map(i => (i.id === itemId ? { ...i, comment } : i)));
    },
    [items, client],
  );

  const removeItem = useCallback(
    (itemId: string) => {
      const item = items.find(i => i.id === itemId);
      setLocalItems(prev => (prev ?? []).filter(i => i.id !== itemId));
      setSelectedItemIds(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
      if (item?.experimentId && item?.datasetId) {
        updateExperimentResult.mutate({
          datasetId: item.datasetId,
          experimentId: item.experimentId,
          resultId: item.id,
          status: null,
        });
      }
    },
    [items, updateExperimentResult],
  );

  const completeItem = useCallback(
    (itemId: string) => {
      const item = items.find(i => i.id === itemId);
      setLocalItems(prev => (prev ?? []).filter(i => i.id !== itemId));
      setSelectedItemIds(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
      if (item?.experimentId && item?.datasetId) {
        updateExperimentResult.mutate({
          datasetId: item.datasetId,
          experimentId: item.experimentId,
          resultId: item.id,
          status: 'complete',
        });
      }
    },
    [items, updateExperimentResult],
  );

  // Bulk selection
  const toggleSelect = useCallback((itemId: string) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedItemIds.size === filteredItems.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(filteredItems.map(i => i.id)));
    }
  }, [filteredItems, selectedItemIds]);

  const handleBulkTag = useCallback(
    (tag: string) => {
      for (const itemId of selectedItemIds) {
        const item = items.find(i => i.id === itemId);
        if (item && !item.tags.includes(tag)) {
          setItemTags(itemId, [...item.tags, tag]);
        }
      }
    },
    [items, selectedItemIds, setItemTags],
  );

  const handleBulkRemoveTag = useCallback(
    (tag: string) => {
      for (const itemId of selectedItemIds) {
        const item = items.find(i => i.id === itemId);
        if (item && item.tags.includes(tag)) {
          setItemTags(
            itemId,
            item.tags.filter(t => t !== tag),
          );
        }
      }
    },
    [items, selectedItemIds, setItemTags],
  );

  // Analyze
  const openAnalyzeDialog = useCallback((mode: 'untagged' | 'selected') => {
    setAnalyzeMode(mode);
    setAnalyzePrompt('');
    setShowAnalyzeDialog(true);
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!analyzeProvider || !analyzeModel) return;

    setIsAnalyzing(true);
    setShowAnalyzeDialog(false);

    try {
      const targetItems =
        analyzeMode === 'untagged'
          ? items.filter(i => i.tags.length === 0)
          : items.filter(i => selectedItemIds.has(i.id));

      if (targetItems.length === 0) {
        setIsAnalyzing(false);
        return;
      }

      const result = await client.clusterFailures({
        modelId: `${analyzeProvider}/${analyzeModel}`,
        items: targetItems.map(item => ({
          id: item.id,
          input: item.input,
          output: item.output ?? undefined,
          error: typeof item.error === 'string' ? item.error : item.error ? String(item.error) : undefined,
          scores: item.scores,
          existingTags: item.tags.length > 0 ? item.tags : undefined,
        })),
        availableTags: datasetTagVocabulary.length > 0 ? datasetTagVocabulary : undefined,
        prompt: analyzePrompt || undefined,
      });

      if (result.proposedTags && result.proposedTags.length > 0) {
        setProposedAssignments(result.proposedTags.map(p => ({ ...p, accepted: true })));
        setShowProposalDialog(true);
      }
    } catch (err) {
      console.error('Analysis failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [analyzeProvider, analyzeModel, analyzeMode, items, selectedItemIds, datasetTagVocabulary, analyzePrompt, client]);

  const handleAcceptProposals = useCallback(() => {
    for (const proposal of proposedAssignments) {
      if (!proposal.accepted) continue;
      const item = items.find(i => i.id === proposal.itemId);
      if (item) {
        const merged = [...new Set([...item.tags, ...proposal.tags])];
        setItemTags(item.id, merged);
      }
    }
    setShowProposalDialog(false);
    setProposedAssignments([]);
  }, [proposedAssignments, items, setItemTags]);

  if (isLoadingReview) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner className="w-6 h-6" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Analyze config dialog */}
      <Dialog open={showAnalyzeDialog} onOpenChange={setShowAnalyzeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Analyze Items</DialogTitle>
            <DialogDescription>
              Use an LLM to automatically suggest tags for {analyzeMode === 'untagged' ? 'untagged' : 'selected'} items.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs mb-1 block">Provider</Label>
                <LLMProviders value={analyzeProvider} onValueChange={setAnalyzeProvider} />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Model</Label>
                <LLMModels llmId={analyzeProvider} value={analyzeModel} onValueChange={setAnalyzeModel} />
              </div>
            </div>
            <Txt variant="ui-xs" className="text-neutral3">
              {analyzeMode === 'untagged' ? untaggedCount : selectedItemIds.size} item
              {(analyzeMode === 'untagged' ? untaggedCount : selectedItemIds.size) !== 1 ? 's' : ''} will be analyzed
            </Txt>
            <div>
              <Label className="text-xs">Instructions (optional)</Label>
              <Textarea
                value={analyzePrompt}
                onChange={e => setAnalyzePrompt(e.target.value)}
                placeholder="E.g., Focus on safety issues and factual errors..."
                rows={3}
                className="text-xs mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAnalyzeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAnalyze} disabled={!analyzeProvider || !analyzeModel || isAnalyzing}>
              {isAnalyzing ? <Spinner className="w-4 h-4 mr-1" /> : null}
              Analyze
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Proposal confirmation dialog */}
      <Dialog open={showProposalDialog} onOpenChange={setShowProposalDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Proposed Tags</DialogTitle>
            <DialogDescription>
              {proposedAssignments.filter(p => p.accepted).length} of {proposedAssignments.length} proposals selected
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {proposedAssignments.map((proposal, idx) => {
              const item = items.find(i => i.id === proposal.itemId);
              return (
                <div key={proposal.itemId} className={cn('p-3 border rounded-lg', !proposal.accepted && 'opacity-50')}>
                  <div className="flex items-start gap-2">
                    <Checkbox
                      checked={proposal.accepted}
                      onCheckedChange={checked =>
                        setProposedAssignments(prev =>
                          prev.map((p, i) => (i === idx ? { ...p, accepted: Boolean(checked) } : p)),
                        )
                      }
                    />
                    <div className="flex-1 min-w-0">
                      <Txt variant="ui-xs" className="text-neutral4 truncate block">
                        {item
                          ? typeof item.input === 'string'
                            ? item.input.slice(0, 100)
                            : JSON.stringify(item.input).slice(0, 100)
                          : proposal.itemId}
                      </Txt>
                      <div className="flex gap-1 flex-wrap mt-1.5">
                        {proposal.tags.map((tag, ti) => (
                          <ProposalTag
                            key={`${tag}-${ti}`}
                            tag={tag}
                            onRename={newTag =>
                              setProposedAssignments(prev =>
                                prev.map((p, i) =>
                                  i === idx ? { ...p, tags: p.tags.map((t, j) => (j === ti ? newTag : t)) } : p,
                                ),
                              )
                            }
                            onRemove={() =>
                              setProposedAssignments(prev =>
                                prev.map((p, i) => (i === idx ? { ...p, tags: p.tags.filter((_, j) => j !== ti) } : p)),
                              )
                            }
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
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProposalDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAcceptProposals} disabled={proposedAssignments.filter(p => p.accepted).length === 0}>
              Accept {proposedAssignments.filter(p => p.accepted).length} proposals
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Left sidebar: Tags + Ratings */}
      <div className="w-56 shrink-0 border-r border-border1 flex flex-col">
        <div className="p-3 border-b border-border1">
          <Txt variant="ui-sm" className="text-neutral5 font-medium">
            Tags
          </Txt>
          {items.length > 0 && (
            <DropdownMenu>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  className="mt-2 flex items-center gap-1 text-xs text-accent1 hover:underline"
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? (
                    <Spinner className="w-3 h-3" />
                  ) : (
                    <Icon size="sm">
                      <Sparkles />
                    </Icon>
                  )}
                  Analyze
                  <ChevronDown className="w-3 h-3" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="start">
                <DropdownMenu.Item onClick={() => openAnalyzeDialog('untagged')} disabled={untaggedCount === 0}>
                  Analyze untagged ({untaggedCount})
                </DropdownMenu.Item>
                <DropdownMenu.Item onClick={() => openAnalyzeDialog('selected')} disabled={selectedItemIds.size === 0}>
                  Analyze selected ({selectedItemIds.size})
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu>
          )}
        </div>
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-2 space-y-0.5">
            <button
              type="button"
              onClick={() => setActiveTagFilter(null)}
              className={cn(
                'w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors',
                !activeTagFilter ? 'bg-surface3 text-neutral5' : 'text-neutral4 hover:bg-surface2',
              )}
            >
              <span>All</span>
              <Badge variant="default">{items.length}</Badge>
            </button>
            {tagCounts.map(([tag, count]) => (
              <button
                key={tag}
                type="button"
                onClick={() => setActiveTagFilter(tag)}
                className={cn(
                  'w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors',
                  activeTagFilter === tag ? 'bg-surface3 text-neutral5' : 'text-neutral4 hover:bg-surface2',
                )}
              >
                <span className="truncate">{tag}</span>
                <Badge variant="default">{count}</Badge>
              </button>
            ))}
            {untaggedCount > 0 && (
              <button
                type="button"
                onClick={() => setActiveTagFilter('__untagged__')}
                className={cn(
                  'w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors',
                  activeTagFilter === '__untagged__' ? 'bg-surface3 text-neutral5' : 'text-neutral3 hover:bg-surface2',
                )}
              >
                <span className="italic">Untagged</span>
                <Badge variant="default">{untaggedCount}</Badge>
              </button>
            )}
          </div>
        </ScrollArea>

        {/* Ratings */}
        <div className="p-3 border-t border-border1">
          <Txt variant="ui-xs" className="text-neutral3 block mb-1">
            Ratings
          </Txt>
          <div className="flex items-center gap-3 text-xs text-neutral4">
            <span>👍 {ratingCounts.positive}</span>
            <span>👎 {ratingCounts.negative}</span>
          </div>
        </div>

        {/* Completed toggle */}
        <div className="border-t border-border1">
          <button
            type="button"
            onClick={() => setShowCompleted(!showCompleted)}
            className={cn(
              'w-full flex items-center justify-between px-3 py-2 text-xs transition-colors',
              showCompleted ? 'bg-surface3 text-positive1' : 'text-neutral3 hover:bg-surface2',
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

      {/* Right: Queue or Completed */}
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
            {isLoadingCompleted ? (
              <div className="flex-1 flex items-center justify-center">
                <Spinner className="w-6 h-6" />
              </div>
            ) : !completedItems || completedItems.length === 0 ? (
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
                      onNewTag={tag => handleBulkTag(tag)}
                    />
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
                    When experiment results are flagged for review, they will appear here.
                    <br />
                    You can tag, rate, and annotate items across all experiments for this dataset.
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
                        for (const t of tags) {
                          if (!datasetTagVocabulary.includes(t)) {
                            syncTagToDataset(t);
                          }
                        }
                      }}
                      onComment={comment => commentItem(item.id, comment)}
                      onRemove={() => removeItem(item.id)}
                      onComplete={() => completeItem(item.id)}
                      tagVocabulary={datasetTagVocabulary}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </>
        )}
      </div>
    </div>
  );
}
