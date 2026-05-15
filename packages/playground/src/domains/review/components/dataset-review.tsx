import {
  Badge,
  Button,
  Checkbox,
  Columns,
  Column,
  DropdownMenu,
  EntityList,
  Label,
  Spinner,
  Textarea,
  Txt,
  Icon,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui';
import { useMastraClient } from '@mastra/react';
import { Portal as DropdownMenuPortal, SubContent as DropdownMenuSubContent } from '@radix-ui/react-dropdown-menu';
import {
  CheckCircle,
  ChevronDown,
  FilterIcon,
  GaugeIcon,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  XIcon,
} from 'lucide-react';
import { useState, useMemo, useCallback, useEffect } from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import { useDatasetReviewItems, useDatasetCompletedItems } from '../hooks/use-dataset-review-items';
import { ProposalTag } from './proposal-tag';
import type { ReviewItem } from './review-item-card';
import { ReviewItemPanel } from './review-item-panel';
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

const subContentClass = cn(
  'bg-surface5 backdrop-blur-xl z-50 min-w-32 overflow-auto rounded-lg p-2 shadow-md',
  'data-[state=open]:animate-in data-[state=closed]:animate-out',
  'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
  'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
);

function PortalSubContent({ className, children, ...props }: ComponentPropsWithoutRef<typeof DropdownMenuSubContent>) {
  return (
    <DropdownMenuPortal>
      <DropdownMenuSubContent className={cn(subContentClass, className)} {...props}>
        {children}
      </DropdownMenuSubContent>
    </DropdownMenuPortal>
  );
}

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
  const [featuredItemId, setFeaturedItemId] = useState<string | null>(null);
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
      setLocalItems(prev => (prev ?? []).filter(i => i.id !== itemId));
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

  // Navigation
  const toNextItem = useCallback(() => {
    if (!featuredItemId || displayItems.length === 0) return;
    const idx = displayItems.findIndex(i => i.id === featuredItemId);
    if (idx < displayItems.length - 1) setFeaturedItemId(displayItems[idx + 1].id);
  }, [featuredItemId, displayItems]);

  const toPreviousItem = useCallback(() => {
    if (!featuredItemId || displayItems.length === 0) return;
    const idx = displayItems.findIndex(i => i.id === featuredItemId);
    if (idx > 0) setFeaturedItemId(displayItems[idx - 1].id);
  }, [featuredItemId, displayItems]);

  // Grid columns for EntityList
  const gridColumns = featuredItem ? '2rem 1fr 10rem 8rem' : '2rem 1fr 10rem 8rem 6rem 6rem';

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
            <DialogDescription>Use an LLM to automatically suggest tags for the selected items.</DialogDescription>
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
              {selectedItemIds.size} item{selectedItemIds.size !== 1 ? 's' : ''} will be analyzed
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

      {/* Main layout: toolbar + EntityList + Detail Panel */}
      <Columns className={featuredItem ? 'grid-cols-[1fr_1fr]' : ''}>
        <Column>
          <Column.Toolbar>
            {/* Filters (left) */}
            <div className="flex items-center gap-3">
              <DropdownMenu>
                <DropdownMenu.Trigger asChild>
                  <Button variant="outline" size="md">
                    <FilterIcon />
                    Filter
                    {activeFilterCount > 0 && (
                      <span
                        className={cn(
                          'ml-0.5 inline-flex items-center justify-center rounded-full bg-accent1/50 text-neutral5 text-ui-sm w-5 h-5',
                        )}
                      >
                        {activeFilterCount}
                      </span>
                    )}
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content align="start" className={cn('min-w-48')}>
                  {/* Status */}
                  <DropdownMenu.Sub>
                    <DropdownMenu.SubTrigger>
                      Status
                      {showCompleted && <span className={cn('ml-auto text-ui-sm text-accent1')}>1</span>}
                    </DropdownMenu.SubTrigger>
                    <PortalSubContent>
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
                    </PortalSubContent>
                  </DropdownMenu.Sub>

                  {/* Tags */}
                  <DropdownMenu.Sub>
                    <DropdownMenu.SubTrigger>
                      Tags
                      {activeTagFilter && <span className={cn('ml-auto text-ui-sm text-accent1')}>1</span>}
                    </DropdownMenu.SubTrigger>
                    <PortalSubContent>
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
                    </PortalSubContent>
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
                  variant="outline"
                  size="md"
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
                    <Button disabled={isAnalyzing}>
                      {isAnalyzing ? (
                        <Spinner className="w-4 h-4" />
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
          </Column.Toolbar>

          {isLoadingDisplay ? (
            <div className="flex-1 flex items-center justify-center">
              <Spinner className="w-6 h-6" />
            </div>
          ) : displayItems.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center px-8">
                <Txt variant="ui-sm" className="text-neutral3 block">
                  {showCompleted ? 'No completed reviews yet' : 'No items to review'}
                </Txt>
                <Txt variant="ui-xs" className="text-neutral3 mt-2 block">
                  {showCompleted
                    ? 'Items marked as complete will appear here for auditing.'
                    : 'When experiment results are flagged for review, they will appear here.'}
                </Txt>
              </div>
            </div>
          ) : (
            <EntityList columns={gridColumns}>
              <EntityList.Top>
                {!showCompleted && (
                  <EntityList.TopCell>
                    <Checkbox
                      checked={isAllSelected ? true : isSomeSelected ? 'indeterminate' : false}
                      onCheckedChange={() => toggleSelectAll()}
                      aria-label="Select all"
                    />
                  </EntityList.TopCell>
                )}
                {showCompleted && <EntityList.TopCell>&nbsp;</EntityList.TopCell>}
                <EntityList.TopCell>Input</EntityList.TopCell>
                <EntityList.TopCell>Comment</EntityList.TopCell>
                <EntityList.TopCell>Tags</EntityList.TopCell>
                {!featuredItem && <EntityList.TopCell>Rating</EntityList.TopCell>}
                {!featuredItem && <EntityList.TopCell>Scores</EntityList.TopCell>}
              </EntityList.Top>

              <EntityList.Rows>
                {displayItems.map(item => {
                  const scoreEntries = item.scores ? Object.entries(item.scores) : [];
                  return (
                    <EntityList.Row
                      key={item.id}
                      onClick={() => handleRowClick(item.id)}
                      selected={featuredItemId === item.id}
                    >
                      {/* Checkbox / Error indicator */}
                      <EntityList.Cell>
                        {!showCompleted ? (
                          <Checkbox
                            checked={selectedItemIds.has(item.id)}
                            onCheckedChange={() => toggleSelect(item.id)}
                            onClick={e => e.stopPropagation()}
                            aria-label={`Select item ${item.id}`}
                          />
                        ) : item.error ? (
                          <div className="w-2 h-2 rounded-full bg-red-700" title="Error" />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-green-600" title="Success" />
                        )}
                      </EntityList.Cell>

                      {/* Input preview */}
                      <EntityList.NameCell>{truncateInput(item.input, 80)}</EntityList.NameCell>

                      {/* Comment preview */}
                      <EntityList.Cell>
                        {item.comment ? (
                          <Txt variant="ui-xs" className="text-neutral3 truncate">
                            {item.comment}
                          </Txt>
                        ) : (
                          <Txt variant="ui-xs" className="text-neutral2">
                            —
                          </Txt>
                        )}
                      </EntityList.Cell>

                      {/* Tags */}
                      <EntityList.Cell>
                        {item.tags.length > 0 ? (
                          <Txt variant="ui-xs" className="text-neutral4 truncate">
                            {item.tags.join(', ')}
                          </Txt>
                        ) : (
                          <Txt variant="ui-xs" className="text-neutral2">
                            —
                          </Txt>
                        )}
                      </EntityList.Cell>

                      {/* Rating (hidden when detail panel open) */}
                      {!featuredItem && (
                        <EntityList.Cell>
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
                        </EntityList.Cell>
                      )}

                      {/* Scores (hidden when detail panel open) */}
                      {!featuredItem && (
                        <EntityList.Cell>
                          {scoreEntries.length > 0 ? (
                            <div className="flex items-center gap-1">
                              <Icon size="sm" className="text-neutral3">
                                <GaugeIcon />
                              </Icon>
                              <Txt variant="ui-xs" className="text-neutral4 font-mono">
                                {scoreEntries[0][1].toFixed(2)}
                              </Txt>
                              {scoreEntries.length > 1 && <Badge variant="default">+{scoreEntries.length - 1}</Badge>}
                            </div>
                          ) : (
                            <Txt variant="ui-xs" className="text-neutral2">
                              —
                            </Txt>
                          )}
                        </EntityList.Cell>
                      )}
                    </EntityList.Row>
                  );
                })}
              </EntityList.Rows>
            </EntityList>
          )}
        </Column>

        {featuredItem && (
          <ReviewItemPanel
            item={featuredItem}
            isCompleted={showCompleted}
            tagVocabulary={datasetTagVocabulary}
            onRate={rating => rateItem(featuredItem.id, rating)}
            onSetTags={tags => {
              setItemTags(featuredItem.id, tags);
              for (const t of tags) {
                if (!datasetTagVocabulary.includes(t)) {
                  syncTagToDataset(t);
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
        )}
      </Columns>
    </div>
  );
}
