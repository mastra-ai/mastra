import type { DatasetExperiment, ExperimentTargetType } from '@mastra/client-js';
import { ActionRow } from '@mastra/playground-ui/components/ActionRow';
import { Button } from '@mastra/playground-ui/components/Button';
import { Checkbox } from '@mastra/playground-ui/components/Checkbox';
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
import { SelectFieldBlock } from '@mastra/playground-ui/components/FormFieldBlocks';
import { Label } from '@mastra/playground-ui/components/Label';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Textarea } from '@mastra/playground-ui/components/Textarea';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useDatasetMutations, useDataset } from '@mastra/playground-ui/domains/datasets';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useMastraClient } from '@mastra/react';
import { CheckCircle, EllipsisIcon, GaugeIcon, Sparkles, Trash2, XIcon, Check, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useReviewItems, useCompletedItems } from '../hooks/use-dataset-review-items';
import { ProposalTag } from './proposal-tag';
import { useScoresByExperimentId } from '@/domains/datasets/hooks/use-dataset-experiments';
import { ExperimentResultDetail } from '@/domains/experiments/components/experiment-result-detail';
import { ExperimentResultsList } from '@/domains/experiments/components/experiment-results-list';
import { LLMProviders, LLMModels } from '@/domains/llm';
import { BulkTagPicker } from '@/domains/shared/components/bulk-tag-picker';

const REVIEW_LIST_COLUMNS = [
  { name: 'itemId', label: 'Item ID', size: 'auto' },
  { name: 'input', label: 'Input', size: 'minmax(0,1fr)' },
  { name: 'tags', label: 'Tags', size: 'auto' },
  { name: 'scores', label: 'Scores', size: '6rem' },
];

const UNTAGGED = '__untagged__';
const ALL_TAGS = 'all';

const STATUS_OPTIONS = [
  { value: 'review', label: 'Review queue' },
  { value: 'completed', label: 'Completed' },
];

export type ReviewListStatus = 'review' | 'completed';
/** Sentinel tag value matching items without any tag. */
export const UNTAGGED_TAG = UNTAGGED;

export interface ReviewListFilters {
  status: ReviewListStatus;
  onStatusChange: (status: ReviewListStatus) => void;
  /** `null` → every tag. */
  tag: string | null;
  onTagChange: (tag: string | null) => void;
  /** Tags present on the review items (most used first), plus `UNTAGGED_TAG` when relevant. */
  tagOptions: Array<{ value: string; label: string }>;
}

export interface DatasetReviewProps {
  /** Trace drawer's full-thread view: lists through the trace-query API; `false` falls back to `listTracesLight`. */
  withQueryTrace: boolean;
  /** Shows the Feedback tabs on the result and trace drawers. */
  withFeedback: boolean;
  /** When set, the dataset's tags seed the tag vocabulary. Without it, tags come from the items only. */
  datasetId?: string;
  /** When set, scopes the review (and completed) lists to items produced by this experiment; otherwise project-wide. */
  experimentId?: string;
  /** Overrides target-based discovery for both lists, including when empty. */
  experiments?: DatasetExperiment[];
  isLoadingExperiments?: boolean;
  /** When set, scopes the lists to experiments run against this target type (server-side). */
  targetType?: ExperimentTargetType | '';
  /** When set, scopes the lists to experiments run against this target ID (server-side). */
  targetId?: string;
  /**
   * Optional request from the parent to auto-feature this item. Whenever this prop changes
   * to a non-null value, the matching review row is selected. Internal interactions still
   * own the featured state afterwards; pass a fresh value on each request (e.g. clear it
   * to `null` when navigating away so a re-open of the same id retriggers selection).
   */
  featuredItemId?: string | null;
  /** Rendered before the status/tag filters in the toolbar (e.g. an experiment picker). */
  toolbarStart?: ReactNode;
  /**
   * Takes over the status/tag filters: when set, the built-in selects and reset button are not
   * rendered and the caller draws them from the given state (e.g. inside a shared filter bar).
   */
  renderFilters?: (filters: ReviewListFilters) => ReactNode;
  /** Rendered at the end of the toolbar, after the bulk actions. */
  toolbarEnd?: ReactNode;
  breadcrumbs?: ReactNode;
  /** When set, shows a "Create Scorer" action fed with the visible review items (input/output). */
  onCreateScorer?: (items: Array<{ input: unknown; output: unknown }>) => void;
}

export function DatasetReview({
  datasetId,
  experimentId,
  experiments,
  isLoadingExperiments,
  targetType,
  targetId,
  featuredItemId: featuredItemIdRequest,
  toolbarStart,
  renderFilters,
  toolbarEnd,
  onCreateScorer,
  breadcrumbs,
  withQueryTrace,
  withFeedback,
}: DatasetReviewProps) {
  const client = useMastraClient();
  const { paths } = useLinkComponent();
  const { data: dataset } = useDataset(datasetId ?? '');
  const { data: reviewItems, isLoading: isLoadingReview } = useReviewItems({
    experimentId,
    targetType,
    targetId,
    experiments,
    isLoadingExperiments,
  });
  const { data: completedItems, isLoading: isLoadingCompleted } = useCompletedItems({
    experimentId,
    targetType,
    targetId,
    experiments,
    isLoadingExperiments,
  });
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

  const items = useMemo(() => reviewItems ?? [], [reviewItems]);

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
    if (activeTagFilter === UNTAGGED) return items.filter(i => i.tags.length === 0);
    return items.filter(i => i.tags.includes(activeTagFilter));
  }, [items, activeTagFilter]);

  // Tag filter options: most used first, plus "Untagged" when some items have no tag.
  const tagOptions = useMemo(() => {
    const counts = new Map<string, number>();
    let untagged = 0;
    for (const item of items) {
      if (item.tags.length === 0) untagged++;
      for (const tag of item.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([tag]) => ({ value: tag, label: tag }));
    return [
      { value: ALL_TAGS, label: 'All tags' },
      ...(untagged > 0 ? [{ value: UNTAGGED, label: 'Untagged' }] : []),
      ...sorted,
    ];
  }, [items]);

  const hasActiveFilters = Boolean(activeTagFilter) || showCompleted;

  const resetFilters = useCallback(() => {
    setActiveTagFilter(null);
    setShowCompleted(false);
    setFeaturedItemId(null);
  }, []);

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
    if (activeTagFilter === UNTAGGED) return base.filter(i => i.tags.length === 0);
    return base.filter(i => i.tags.includes(activeTagFilter));
  }, [showCompleted, completedItems, filteredItems, activeTagFilter]);
  const isLoadingDisplay = showCompleted ? isLoadingCompleted : false;
  const visibleIds = useMemo(() => new Set(displayItems.map(i => i.id)), [displayItems]);
  const selectedVisibleCount = useMemo(
    () => [...selectedItemIds].filter(id => visibleIds.has(id)).length,
    [selectedItemIds, visibleIds],
  );
  const isAllSelected = displayItems.length > 0 && selectedVisibleCount === displayItems.length;

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
  const { data: featuredScoresByItemId } = useScoresByExperimentId(featuredItem?.experimentId ?? '');

  // Navigation — undefined at the edges so the prev/next buttons disable.
  const featuredIndex = featuredItemId ? displayItems.findIndex(i => i.id === featuredItemId) : -1;
  const toPreviousItem = featuredIndex > 0 ? () => setFeaturedItemId(displayItems[featuredIndex - 1].id) : undefined;
  const toNextItem =
    featuredIndex >= 0 && featuredIndex < displayItems.length - 1
      ? () => setFeaturedItemId(displayItems[featuredIndex + 1].id)
      : undefined;

  const hasSelection = !showCompleted && selectedItemIds.size > 0;
  const showCreateScorer = !!onCreateScorer && !showCompleted && filteredItems.length > 0;

  const status: ReviewListStatus = showCompleted ? 'completed' : 'review';
  const onStatusChange = (next: ReviewListStatus) => {
    setShowCompleted(next === 'completed');
    setFeaturedItemId(null);
  };

  const toolbar = (
    <ActionRow>
      <ActionRow.Start>
        {renderFilters ? (
          <>
            {toolbarStart}
            {renderFilters({
              status,
              onStatusChange,
              tag: activeTagFilter,
              onTagChange: setActiveTagFilter,
              tagOptions: tagOptions.filter(option => option.value !== ALL_TAGS),
            })}
          </>
        ) : (
          <>
            {toolbarStart}
            <SelectFieldBlock
              label="Status"
              labelIsHidden
              name="filter-status"
              options={STATUS_OPTIONS}
              value={status}
              onValueChange={value => onStatusChange(value === 'completed' ? 'completed' : 'review')}
              className="whitespace-nowrap"
            />
            {tagOptions.length > 1 && (
              <SelectFieldBlock
                label="Tags"
                labelIsHidden
                name="filter-tags"
                options={tagOptions}
                value={activeTagFilter ?? ALL_TAGS}
                onValueChange={value => setActiveTagFilter(value === ALL_TAGS ? null : value)}
                className="whitespace-nowrap"
              />
            )}
            {hasActiveFilters && (
              <Button onClick={resetFilters} size="sm" variant="default" icon={<XIcon />}>
                Reset
              </Button>
            )}
          </>
        )}
      </ActionRow.Start>

      {(hasSelection || toolbarEnd || showCreateScorer) && (
        <ActionRow.End>
          {toolbarEnd}
          {showCreateScorer && (
            <Button
              size="md"
              onClick={() => onCreateScorer?.(filteredItems.map(item => ({ input: item.input, output: item.output })))}
            >
              <Icon size="xs">
                <GaugeIcon />
              </Icon>
              Create Scorer
            </Button>
          )}
          {hasSelection && (
            <>
              <BulkTagPicker
                size="md"
                selectedCount={selectedItemIds.size}
                vocabulary={datasetTagVocabulary}
                onApplyTag={handleBulkTag}
                onRemoveTag={handleBulkRemoveTag}
                onNewTag={tag => handleBulkTag(tag)}
              />
              <Button variant="primary" onClick={handleBulkComplete} icon={<CheckCircle />}>
                Mark as reviewed
              </Button>
              <DropdownMenu>
                <DropdownMenu.Trigger asChild>
                  <Button disabled={isAnalyzing} aria-label="More actions">
                    {isAnalyzing ? <Spinner className="h-4 w-4" /> : <EllipsisIcon />}
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content align="end">
                  <DropdownMenu.Item onSelect={openAnalyzeDialog}>
                    <Icon size="xs">
                      <Sparkles />
                    </Icon>
                    Analyze
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator />
                  <DropdownMenu.Item onSelect={handleBulkRemove}>
                    <Icon size="xs">
                      <Trash2 />
                    </Icon>
                    Remove from queue
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu>
            </>
          )}
        </ActionRow.End>
      )}
    </ActionRow>
  );

  if (isLoadingReview) {
    return (
      <PageLayout breadcrumbs={breadcrumbs} actionRow={toolbar}>
        <h1 className="sr-only">Review Queue</h1>
        <Spinner fill />
      </PageLayout>
    );
  }

  const detailPanel = (
    <ExperimentResultDetail
      withQueryTrace={withQueryTrace}
      withFeedback={withFeedback}
      result={featuredItem ?? undefined}
      title={`Review item ${featuredItem?.id ?? ''}`}
      scores={featuredItem ? featuredScoresByItemId?.[featuredItem.itemId] : undefined}
      experimentLink={
        featuredItem?.experimentId
          ? paths.experimentItemLink(featuredItem.experimentId, featuredItem.itemId)
          : undefined
      }
      tagVocabulary={datasetTagVocabulary}
      onTagsChange={
        showCompleted || !featuredItem
          ? undefined
          : tags => {
              setItemTags(featuredItem.id, tags);
              for (const tag of tags) {
                if (!datasetTagVocabulary.includes(tag)) {
                  syncTagToDataset(tag);
                }
              }
            }
      }
      onComplete={showCompleted || !featuredItem ? undefined : () => completeItem(featuredItem.id)}
      onPrevious={toPreviousItem}
      onNext={toNextItem}
      onClose={() => setFeaturedItemId(null)}
    />
  );

  return (
    <PageLayout breadcrumbs={breadcrumbs} actionRow={toolbar}>
      <h1 className="sr-only">Review Queue</h1>
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
                <Label className="mb-1 block">Provider</Label>
                <LLMProviders value={analyzeProvider} onValueChange={setAnalyzeProvider} />
              </div>
              <div>
                <Label className="mb-1 block">Model</Label>
                <LLMModels llmId={analyzeProvider} value={analyzeModel} onValueChange={setAnalyzeModel} />
              </div>
            </div>
            <Txt variant="meta" tone="muted">
              {selectedItemIds.size} item{selectedItemIds.size !== 1 ? 's' : ''} will be analyzed
            </Txt>
            <div>
              <Label>Instructions (optional)</Label>
              <Textarea
                value={analyzePrompt}
                onChange={e => setAnalyzePrompt(e.target.value)}
                placeholder="E.g., Focus on safety issues and factual errors..."
                rows={3}
                className="mt-1 text-caption"
              />
            </div>
          </div>
          <DialogFooter>
            <Button icon={<X />} onClick={() => setShowAnalyzeDialog(false)}>
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
                <div key={proposal.itemId} className={cn('rounded-lg border p-3', !proposal.accepted && 'opacity-50')}>
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
                      <Txt variant="meta" tone="muted" className="block truncate">
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
                        <Txt variant="meta" tone="muted" className="mt-1 block italic">
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
            <Button icon={<X />} onClick={() => setShowProposalDialog(false)}>
              Cancel
            </Button>
            <Button
              icon={<Check />}
              onClick={handleAcceptProposals}
              disabled={proposedAssignments.filter(p => p.accepted).length === 0}
            >
              Accept {proposedAssignments.filter(p => p.accepted).length} proposals
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Main layout: list; the detail opens as a drawer. */}
      <div className="grid h-full min-h-0 w-full grid-cols-1 gap-4 overflow-hidden">
        <div className="min-h-0 w-full overflow-hidden">
          {isLoadingDisplay ? (
            <Spinner fill />
          ) : displayItems.length === 0 ? (
            <EmptyState
              titleSlot={showCompleted ? 'No completed reviews yet' : 'No items to review'}
              descriptionSlot={
                showCompleted
                  ? 'Items marked as complete will appear here for auditing.'
                  : 'When experiment results are flagged for review, they will appear here.'
              }
              variant="fill"
            />
          ) : (
            <ExperimentResultsList
              results={displayItems}
              isLoading={false}
              featuredResultId={featuredItemId}
              onResultClick={handleRowClick}
              columns={REVIEW_LIST_COLUMNS}
              selectedIds={showCompleted ? undefined : selectedItemIds}
              onToggleSelect={showCompleted ? undefined : toggleSelect}
              onToggleSelectAll={showCompleted ? undefined : toggleSelectAll}
            />
          )}
        </div>

        {detailPanel}
      </div>
    </PageLayout>
  );
}
