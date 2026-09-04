import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Checkbox } from '@mastra/playground-ui/components/Checkbox';
import { DataList, useDataListKeyboard } from '@mastra/playground-ui/components/DataList';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Label } from '@mastra/playground-ui/components/Label';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Textarea } from '@mastra/playground-ui/components/Textarea';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useMastraClient } from '@mastra/react';
import {
  CheckCircle,
  ChevronDown,
  ClipboardCheck,
  FilterIcon,
  GaugeIcon,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  XIcon,
} from 'lucide-react';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useReviewItems, useCompletedItems } from '../hooks/use-dataset-review-items';
import { ProposalTag } from './proposal-tag';
import type { ReviewItem } from './review-item-card';
import { ReviewItemPanel } from './review-item-panel';
import { RouteItemOverlay } from '@/components/route-item-overlay';
import { useDatasetMutations } from '@/domains/datasets/hooks/use-dataset-mutations';
import { useDataset } from '@/domains/datasets/hooks/use-datasets';
import { LLMProviders, LLMModels } from '@/domains/llm';
import { BulkTagPicker } from '@/domains/shared/components/bulk-tag-picker';

function truncateInput(value: unknown, max: number): string {
  if (typeof value === 'string') return value.length > max ? value.slice(0, max) + '...' : value;
  try {
    const str = JSON.stringify(value);
    return str.length > max ? str.slice(0, max) + '...' : str;
  } catch {
    return String(value);
  }
}

export interface DatasetReviewProps {
  /** When set, the dataset's tags seed the tag vocabulary. Without it, tags come from the items only. */
  datasetId?: string;
  /** When set, scopes the review (and completed) lists to items produced by this experiment; otherwise project-wide. */
  experimentId?: string;
  /**
   * Optional request from the parent to auto-feature this item. Whenever this prop changes
   * to a non-null value, the matching review row is selected. Internal interactions still
   * own the featured state afterwards; pass a fresh value on each request (e.g. clear it
   * to `null` when navigating away so a re-open of the same id retriggers selection).
   */
  featuredItemId?: string | null;
  detailPanelVariant?: 'inline' | 'overlay';
}

export function DatasetReview({
  datasetId,
  experimentId,
  featuredItemId: featuredItemIdRequest,
  detailPanelVariant = 'inline',
}: DatasetReviewProps) {
  const client = useMastraClient();
  const { data: dataset } = useDataset(datasetId ?? '');
  // Keep `undefined` while loading: the hydration effect below treats a defined
  // value as "server data arrived", so coercing to [] here would lock in an empty queue.
  const { data: reviewItems, isLoading: isLoadingReview } = useReviewItems({ experimentId });
  const { data: completedItems, isLoading: isLoadingCompleted } = useCompletedItems({ experimentId });
  const { updateExperimentResult } = useDatasetMutations();

  // Local state
  const [featuredItemId, setFeaturedItemId] = useState<string | null>(featuredItemIdRequest ?? null);

  // Respond to external "feature this item" requests from the parent (e.g. clicking
  // a "Review" button on an experiment result). The parent passes the same id again
  // by clearing to null in between so a repeat request still re-fires this effect.
  useEffect(() => {
    if (featuredItemIdRequest !== undefined) setFeaturedItemId(featuredItemIdRequest);
  }, [featuredItemIdRequest]);

  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [showCompleted, setShowCompleted] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Analyze dialog
  const [showAnalyzeDialog, setShowAnalyzeDialog] = useState(false);
  const [analyzePrompt, setAnalyzePrompt] = useState('');
  const [analyzeProvider, setAnalyzeProvider] = useState('');
  const [analyzeModel, setAnalyzeModel] = useState('');

  // Proposal dialog
  const [proposedAssignments, setProposedAssignments] = useState<
    Array<{ itemId: string; tags: string[]; reason: string; accepted: boolean }>
  >([]);
  const [showProposalDialog, setShowProposalDialog] = useState(false);

  // Ratings are only sent as feedback, never stored on the result, so they live here.
  // Everything else comes straight from the query; mutations invalidate it.
  const [ratings, setRatings] = useState<Record<string, ReviewItem['rating']>>({});
  const items = useMemo(
    () => (reviewItems ?? []).map(i => (i.id in ratings ? { ...i, rating: ratings[i.id] } : i)),
    [reviewItems, ratings],
  );

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

  // Active filter count for the Filter button badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (activeTagFilter) count++;
    if (showCompleted) count++;
    return count;
  }, [activeTagFilter, showCompleted]);

  // Item actions
  const setItemTags = useCallback(
    (itemId: string, tags: string[]) => {
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
              reviewStatus: 'reviewed',
              experimentId: item.experimentId ?? undefined,
              sourceId: item.id,
            },
          })
          .catch(() => {});
      }
      setRatings(prev => ({ ...prev, [itemId]: rating }));
    },
    [items, client],
  );

  const commentItem = useCallback(
    (itemId: string, comment: string) => {
      const item = items.find(i => i.id === itemId);
      if (item?.experimentId && item?.datasetId) {
        updateExperimentResult.mutate({
          datasetId: item.datasetId,
          experimentId: item.experimentId,
          resultId: item.id,
          comment,
        });
      }
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
              reviewStatus: 'reviewed',
              experimentId: item.experimentId ?? undefined,
              sourceId: item.id,
            },
          })
          .catch(() => {});
      }
    },
    [items, client, updateExperimentResult],
  );

  const removeItem = useCallback(
    (itemId: string) => {
      const item = items.find(i => i.id === itemId);
      setSelectedItemIds(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
      if (featuredItemId === itemId) setFeaturedItemId(null);
      if (item?.experimentId && item?.datasetId) {
        updateExperimentResult.mutate({
          datasetId: item.datasetId,
          experimentId: item.experimentId,
          resultId: item.id,
          status: null,
        });
      }
    },
    [items, updateExperimentResult, featuredItemId],
  );

  const completeItem = useCallback(
    (itemId: string) => {
      const item = items.find(i => i.id === itemId);
      setSelectedItemIds(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
      if (featuredItemId === itemId) setFeaturedItemId(null);
      if (item?.experimentId && item?.datasetId) {
        updateExperimentResult.mutate({
          datasetId: item.datasetId,
          experimentId: item.experimentId,
          resultId: item.id,
          status: 'complete',
        });
      }
    },
    [items, updateExperimentResult, featuredItemId],
  );

  // Display items with tag filtering applied to both views
  const displayItems = useMemo(() => {
    const base = showCompleted ? (completedItems ?? []) : filteredItems;
    if (!showCompleted || !activeTagFilter) return base;
    if (activeTagFilter === '__untagged__') return base.filter(i => i.tags.length === 0);
    return base.filter(i => i.tags.includes(activeTagFilter));
  }, [showCompleted, completedItems, filteredItems, activeTagFilter]);
  const isLoadingDisplay = showCompleted ? isLoadingCompleted : false;
  const visibleIds = useMemo(() => new Set(displayItems.map(i => i.id)), [displayItems]);
  const selectedVisibleCount = useMemo(
    () => [...selectedItemIds].filter(id => visibleIds.has(id)).length,
    [selectedItemIds, visibleIds],
  );
  const isAllSelected = displayItems.length > 0 && selectedVisibleCount === displayItems.length;
  const isSomeSelected = selectedVisibleCount > 0 && !isAllSelected;

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
    if (isAllSelected) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(displayItems.map(i => i.id)));
    }
  }, [isAllSelected, displayItems]);

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

  const handleBulkComplete = useCallback(() => {
    for (const itemId of selectedItemIds) {
      completeItem(itemId);
    }
    setSelectedItemIds(new Set());
  }, [selectedItemIds, completeItem]);

  const handleBulkRemove = useCallback(() => {
    for (const itemId of selectedItemIds) {
      removeItem(itemId);
    }
    setSelectedItemIds(new Set());
  }, [selectedItemIds, removeItem]);

  // Analyze
  const openAnalyzeDialog = useCallback(() => {
    setAnalyzePrompt('');
    setShowAnalyzeDialog(true);
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!analyzeProvider || !analyzeModel) return;

    setIsAnalyzing(true);
    setShowAnalyzeDialog(false);

    try {
      const targetItems = items.filter(i => selectedItemIds.has(i.id));

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
  }, [analyzeProvider, analyzeModel, items, selectedItemIds, client, datasetTagVocabulary, analyzePrompt]);

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
  }, [proposedAssignments, items, setItemTags]);

  // Row click handler
  const handleRowClick = useCallback((itemId: string) => {
    setFeaturedItemId(prev => (prev === itemId ? null : itemId));
  }, []);

  // Featured item
  const featuredItem = useMemo(() => {
    if (!featuredItemId) return null;
    return displayItems.find(i => i.id === featuredItemId) ?? null;
  }, [featuredItemId, displayItems]);

  // Navigation — undefined at the edges so the prev/next buttons disable.
  const featuredIndex = featuredItemId ? displayItems.findIndex(i => i.id === featuredItemId) : -1;
  const toPreviousItem = featuredIndex > 0 ? () => setFeaturedItemId(displayItems[featuredIndex - 1].id) : undefined;
  const toNextItem =
    featuredIndex >= 0 && featuredIndex < displayItems.length - 1
      ? () => setFeaturedItemId(displayItems[featuredIndex + 1].id)
      : undefined;

  const gridColumns = 'auto minmax(0,20rem) minmax(0,1fr) minmax(0,8rem) 6rem 6rem';

  const { containerRef, getRowProps } = useDataListKeyboard({ count: displayItems.length });

  if (isLoadingReview) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  const detailPanel = featuredItem ? (
    <ReviewItemPanel
      className="h-full"
      item={featuredItem}
      isCompleted={showCompleted}
      tagVocabulary={datasetTagVocabulary}
      onRate={rating => rateItem(featuredItem.id, rating)}
      onSetTags={tags => {
        setItemTags(featuredItem.id, tags);
        for (const tag of tags) {
          if (!datasetTagVocabulary.includes(tag)) {
            syncTagToDataset(tag);
          }
        }
      }}
      onComment={comment => commentItem(featuredItem.id, comment)}
      onRemove={() => removeItem(featuredItem.id)}
      onComplete={showCompleted ? undefined : () => completeItem(featuredItem.id)}
      onPrevious={toPreviousItem}
      onNext={toNextItem}
      onClose={() => setFeaturedItemId(null)}
    />
  ) : null;

  return (
    <div
      className={cn(
        'flex h-full min-h-0 flex-1',
        detailPanelVariant === 'overlay' ? 'overflow-visible' : 'overflow-hidden',
      )}
    >
      {/* Analyze config dialog */}
      <Dialog open={showAnalyzeDialog} onOpenChange={setShowAnalyzeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Analyze Items</DialogTitle>
            <DialogDescription>Use an LLM to automatically suggest tags for the selected items.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="mb-1 block text-xs">Provider</Label>
                <LLMProviders value={analyzeProvider} onValueChange={setAnalyzeProvider} />
              </div>
              <div>
                <Label className="mb-1 block text-xs">Model</Label>
                <LLMModels llmId={analyzeProvider} value={analyzeModel} onValueChange={setAnalyzeModel} />
              </div>
            </div>
            <Txt variant="ui-xs" className="text-neutral3">
              {selectedItemIds.size} item{selectedItemIds.size !== 1 ? 's' : ''} will be analyzed
            </Txt>
            <div>
              <Label className="text-xs">Instructions (optional)</Label>
              <Textarea
                value={analyzePrompt}
                onChange={e => setAnalyzePrompt(e.target.value)}
                placeholder="E.g., Focus on safety issues and factual errors..."
                rows={3}
                className="mt-1 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAnalyzeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAnalyze} disabled={!analyzeProvider || !analyzeModel || isAnalyzing}>
              {isAnalyzing ? <Spinner className="mr-1 h-4 w-4" /> : null}
              Analyze
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Proposal confirmation dialog */}
      <Dialog open={showProposalDialog} onOpenChange={setShowProposalDialog}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
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
                    <div className="min-w-0 flex-1">
                      <Txt variant="ui-xs" className="text-neutral4 block truncate">
                        {item
                          ? typeof item.input === 'string'
                            ? item.input.slice(0, 100)
                            : JSON.stringify(item.input).slice(0, 100)
                          : proposal.itemId}
                      </Txt>
                      <div className="mt-1.5 flex flex-wrap gap-1">
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

      {/* Main layout: toolbar + List + Detail Panel */}
      <div
        className={cn(
          'grid h-full min-h-0 w-full grid-cols-1 gap-4',
          detailPanelVariant === 'overlay' ? 'overflow-visible' : 'overflow-hidden',
          featuredItem && detailPanelVariant === 'inline' && 'grid-cols-[1fr_1fr]',
        )}
      >
        <div className="grid min-h-0 w-full grid-rows-[auto_1fr] gap-3 overflow-hidden pt-3">
          {(items.length > 0 || activeFilterCount > 0) && (
            <div className="flex w-full flex-wrap items-center justify-start gap-3">
              {/* Filters (left) */}
              <div className="flex items-center gap-3">
                <DropdownMenu>
                  <DropdownMenu.Trigger asChild>
                    <Button size="sm">
                      <FilterIcon />
                      Filter
                      {activeFilterCount > 0 && <Badge size="xs">{activeFilterCount}</Badge>}
                    </Button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content align="start" className={cn('min-w-48')}>
                    {/* Status */}
                    <DropdownMenu.Sub>
                      <DropdownMenu.SubTrigger>
                        Status
                        {showCompleted && <span className={cn('ml-auto text-ui-sm text-accent1')}>1</span>}
                      </DropdownMenu.SubTrigger>
                      <DropdownMenu.SubContent>
                        <DropdownMenu.CheckboxItem
                          checked={!showCompleted}
                          onCheckedChange={() => {
                            setShowCompleted(false);
                            setFeaturedItemId(null);
                          }}
                          onSelect={e => e.preventDefault()}
                        >
                          Review Queue
                        </DropdownMenu.CheckboxItem>
                        <DropdownMenu.CheckboxItem
                          checked={showCompleted}
                          onCheckedChange={() => {
                            setShowCompleted(true);
                            setFeaturedItemId(null);
                          }}
                          onSelect={e => e.preventDefault()}
                        >
                          Completed
                        </DropdownMenu.CheckboxItem>
                      </DropdownMenu.SubContent>
                    </DropdownMenu.Sub>

                    {/* Tags */}
                    <DropdownMenu.Sub>
                      <DropdownMenu.SubTrigger>
                        Tags
                        {activeTagFilter && <span className={cn('ml-auto text-ui-sm text-accent1')}>1</span>}
                      </DropdownMenu.SubTrigger>
                      <DropdownMenu.SubContent>
                        <DropdownMenu.CheckboxItem
                          checked={!activeTagFilter}
                          onCheckedChange={() => setActiveTagFilter(null)}
                          onSelect={e => e.preventDefault()}
                        >
                          All
                        </DropdownMenu.CheckboxItem>
                        {untaggedCount > 0 && (
                          <DropdownMenu.CheckboxItem
                            checked={activeTagFilter === '__untagged__'}
                            onCheckedChange={() =>
                              setActiveTagFilter(activeTagFilter === '__untagged__' ? null : '__untagged__')
                            }
                            onSelect={e => e.preventDefault()}
                          >
                            Untagged
                          </DropdownMenu.CheckboxItem>
                        )}
                        {tagCounts.length > 0 && <DropdownMenu.Separator />}
                        {tagCounts.map(([tag]) => (
                          <DropdownMenu.CheckboxItem
                            key={tag}
                            checked={activeTagFilter === tag}
                            onCheckedChange={() => setActiveTagFilter(activeTagFilter === tag ? null : tag)}
                            onSelect={e => e.preventDefault()}
                          >
                            {tag}
                          </DropdownMenu.CheckboxItem>
                        ))}
                      </DropdownMenu.SubContent>
                    </DropdownMenu.Sub>

                    {/* Clear all */}
                    {activeFilterCount > 0 && (
                      <>
                        <DropdownMenu.Separator />
                        <DropdownMenu.Item
                          onSelect={() => {
                            setActiveTagFilter(null);
                            setShowCompleted(false);
                            setFeaturedItemId(null);
                          }}
                        >
                          <XIcon />
                          Clear all filters
                        </DropdownMenu.Item>
                      </>
                    )}
                  </DropdownMenu.Content>
                </DropdownMenu>

                {activeFilterCount > 0 && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setActiveTagFilter(null);
                      setShowCompleted(false);
                      setFeaturedItemId(null);
                    }}
                  >
                    <XIcon />
                    Reset
                  </Button>
                )}
              </div>

              {/* Actions (right) */}
              {!showCompleted && selectedItemIds.size > 0 && (
                <div className="flex items-center gap-2">
                  <BulkTagPicker
                    selectedCount={selectedItemIds.size}
                    vocabulary={datasetTagVocabulary}
                    onApplyTag={handleBulkTag}
                    onRemoveTag={handleBulkRemoveTag}
                    onNewTag={tag => handleBulkTag(tag)}
                  />

                  <DropdownMenu>
                    <DropdownMenu.Trigger asChild>
                      <Button size="sm" disabled={isAnalyzing}>
                        {isAnalyzing ? (
                          <Spinner className="h-4 w-4" />
                        ) : (
                          <Icon size="sm">
                            <ChevronDown />
                          </Icon>
                        )}
                        Actions
                      </Button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content align="end">
                      <DropdownMenu.Item onSelect={handleBulkComplete}>
                        <Icon size="sm">
                          <CheckCircle />
                        </Icon>
                        Complete
                      </DropdownMenu.Item>
                      <DropdownMenu.Item onSelect={handleBulkRemove}>
                        <Icon size="sm">
                          <Trash2 />
                        </Icon>
                        Remove
                      </DropdownMenu.Item>
                      <DropdownMenu.Separator />
                      <DropdownMenu.Item onSelect={openAnalyzeDialog}>
                        <Icon size="sm">
                          <Sparkles />
                        </Icon>
                        Analyze
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu>
                </div>
              )}
            </div>
          )}

          {isLoadingDisplay ? (
            <div className="flex flex-1 items-center justify-center">
              <Spinner className="h-6 w-6" />
            </div>
          ) : displayItems.length === 0 ? (
            <div className="flex h-full items-center justify-center py-12">
              <EmptyState
                iconSlot={<ClipboardCheck className="text-neutral3 h-8 w-8" />}
                titleSlot={showCompleted ? 'No completed reviews yet' : 'No items to review'}
                descriptionSlot={
                  showCompleted
                    ? 'Items marked as complete will appear here for auditing.'
                    : 'When experiment results are flagged for review, they will appear here.'
                }
              />
            </div>
          ) : (
            <DataList columns={gridColumns} fit="container" className="min-w-0" scrollRef={containerRef}>
              <DataList.Top hasLeadingCell>
                {!showCompleted ? (
                  <DataList.TopSelectCell
                    checked={isAllSelected ? true : isSomeSelected ? 'indeterminate' : false}
                    onToggle={() => toggleSelectAll()}
                    aria-label="Select all"
                  />
                ) : (
                  <DataList.TopCell>&nbsp;</DataList.TopCell>
                )}
                <DataList.TopCells colStart={2}>
                  <DataList.TopCell>Input</DataList.TopCell>
                  <DataList.TopCell>Comment</DataList.TopCell>
                  <DataList.TopCell>Tags</DataList.TopCell>
                  <DataList.TopCell>Rating</DataList.TopCell>
                  <DataList.TopCell>Scores</DataList.TopCell>
                </DataList.TopCells>
              </DataList.Top>

              {displayItems.map((item, index) => {
                const scoreEntries = item.scores ? Object.entries(item.scores) : [];
                const isFeatured = featuredItemId === item.id;

                const rowCells = (
                  <>
                    {/* Input preview */}
                    <DataList.Cell className="text-neutral4 min-w-0">
                      <span className="block truncate">{truncateInput(item.input, 200)}</span>
                    </DataList.Cell>

                    {/* Comment preview */}
                    <DataList.Cell className="min-w-0">
                      {item.comment ? (
                        <Txt variant="ui-xs" className="text-neutral3 truncate">
                          {item.comment}
                        </Txt>
                      ) : (
                        <Txt variant="ui-xs" className="text-neutral2">
                          —
                        </Txt>
                      )}
                    </DataList.Cell>

                    {/* Tags */}
                    <DataList.Cell className="min-w-0">
                      {item.tags.length > 0 ? (
                        <Txt variant="ui-xs" className="text-neutral4 truncate">
                          {item.tags.join(', ')}
                        </Txt>
                      ) : (
                        <Txt variant="ui-xs" className="text-neutral2">
                          —
                        </Txt>
                      )}
                    </DataList.Cell>

                    {/* Rating */}
                    <DataList.Cell>
                      {item.rating === 'positive' && (
                        <Icon size="sm" className="text-positive1">
                          <ThumbsUp />
                        </Icon>
                      )}
                      {item.rating === 'negative' && (
                        <Icon size="sm" className="text-negative1">
                          <ThumbsDown />
                        </Icon>
                      )}
                      {!item.rating && (
                        <Txt variant="ui-xs" className="text-neutral2">
                          —
                        </Txt>
                      )}
                    </DataList.Cell>

                    {/* Scores */}
                    <DataList.Cell>
                      {scoreEntries.length > 0 ? (
                        <div className="flex items-center gap-1">
                          <Icon size="sm" className="text-neutral3">
                            <GaugeIcon />
                          </Icon>
                          <Txt variant="ui-xs" className="text-neutral4 font-mono">
                            {scoreEntries[0][1].toFixed(2)}
                          </Txt>
                          {scoreEntries.length > 1 && <Badge>+{scoreEntries.length - 1}</Badge>}
                        </div>
                      ) : (
                        <Txt variant="ui-xs" className="text-neutral2">
                          —
                        </Txt>
                      )}
                    </DataList.Cell>
                  </>
                );

                return (
                  <DataList.RowWrapper key={item.id}>
                    {!showCompleted ? (
                      <DataList.SelectCell
                        checked={selectedItemIds.has(item.id)}
                        onToggle={() => toggleSelect(item.id)}
                        aria-label={`Select item ${item.id}`}
                      />
                    ) : (
                      <DataList.Cell className="justify-items-center px-4">
                        <div
                          role="img"
                          aria-label={item.error ? 'Error' : 'Success'}
                          title={item.error ? 'Error' : 'Success'}
                          className={cn('w-2 h-2 rounded-full', item.error ? 'bg-red-700' : 'bg-green-600')}
                        />
                      </DataList.Cell>
                    )}
                    <DataList.RowButton
                      colStart={2}
                      featured={isFeatured}
                      onClick={() => handleRowClick(item.id)}
                      {...getRowProps(index)}
                    >
                      {rowCells}
                    </DataList.RowButton>
                  </DataList.RowWrapper>
                );
              })}
            </DataList>
          )}
        </div>

        {detailPanel &&
          (detailPanelVariant === 'overlay' ? (
            <RouteItemOverlay label={`Review item ${featuredItem?.id ?? ''}`}>{detailPanel}</RouteItemOverlay>
          ) : (
            detailPanel
          ))}
      </div>
    </div>
  );
}
