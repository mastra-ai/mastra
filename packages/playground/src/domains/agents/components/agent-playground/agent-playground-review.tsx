import {
  Badge,
  Button,
  Checkbox,
  Column,
  Columns,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DropdownMenu,
  EntityList,
  Label,
  Spinner,
  Textarea,
  Txt,
  Icon,
  toast,
  cn,
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
import type { ComponentPropsWithoutRef } from 'react';
import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { usePlaygroundModel } from '../../context/playground-model-context';
import { useReviewQueue } from '../../context/review-queue-context';

import { useCompletedItems } from '../../hooks/use-completed-items';
import { useReviewItems } from '../../hooks/use-review-items';
import { useDatasetMutations } from '@/domains/datasets/hooks/use-dataset-mutations';
import { useDatasets } from '@/domains/datasets/hooks/use-datasets';
import { LLMProviders, LLMModels, cleanProviderId } from '@/domains/llm';
import { BulkTagPicker, ProposalTag } from '@/domains/review/components';
import { ReviewItemPanel } from '@/domains/review/components/review-item-panel';

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

interface AgentPlaygroundReviewProps {
  agentId: string;
  onCreateScorer?: (items: Array<{ input: unknown; output: unknown }>) => void;
}

export function AgentPlaygroundReview({ agentId, onCreateScorer }: AgentPlaygroundReviewProps) {
  const { items, setItemTags, rateItem, commentItem, removeItem, completeItem, loadPersistedItems } = useReviewQueue();
  const { data: persistedItems } = useReviewItems(agentId);
  const { data: completedItems, refetch: refetchCompleted, isLoading: isLoadingCompleted } = useCompletedItems(agentId);
  const client = useMastraClient();
  const { provider, model } = usePlaygroundModel();
  const { data: allDatasets } = useDatasets();
  const { updateDataset } = useDatasetMutations();

  // Load persisted review items on mount / when data changes
  useEffect(() => {
    if (persistedItems) {
      loadPersistedItems(persistedItems);
    }
  }, [persistedItems, loadPersistedItems]);

  const [featuredItemId, setFeaturedItemId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [showCompleted, setShowCompleted] = useState(false);

  // Analyze config dialog
  const analyzeContentRef = useRef<HTMLDivElement>(null);
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

      const proposals = (result.proposedTags ?? [])
        .filter((p: any) => p.tags.length > 0)
        .map((p: any) => ({
          itemId: p.itemId,
          tags: p.tags as string[],
          reason: (p.reason as string) || '',
          accepted: true,
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
  const toggleSelect = useCallback((id: string) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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

  const handleBulkComplete = useCallback(async () => {
    for (const id of selectedItemIds) {
      await completeItem(id);
    }
    setSelectedItemIds(new Set());
    void refetchCompleted();
  }, [selectedItemIds, completeItem, refetchCompleted]);

  const handleBulkRemove = useCallback(() => {
    for (const id of selectedItemIds) {
      removeItem(id);
    }
    setSelectedItemIds(new Set());
  }, [selectedItemIds, removeItem]);

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

  // Dynamic grid columns
  const gridColumns = featuredItem ? '2rem 1fr 10rem 8rem' : '2rem 1fr 10rem 8rem 6rem 6rem';

  return (
    <>
      {/* Analyze configuration dialog */}
      <Dialog open={showAnalyzeDialog} onOpenChange={setShowAnalyzeDialog}>
        <DialogContent ref={analyzeContentRef} className="max-w-lg">
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
                      container={analyzeContentRef}
                    />
                  </div>
                  <div className="flex-1">
                    <LLMModels
                      llmId={analyzeProvider}
                      value={analyzeModel}
                      onValueChange={setAnalyzeModel}
                      size="sm"
                      container={analyzeContentRef}
                    />
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
                          onRename={newTag =>
                            setProposedAssignments(prev =>
                              prev.map((p, i) =>
                                i === idx ? { ...p, tags: p.tags.map((t, j) => (j === tagIdx ? newTag : t)) } : p,
                              ),
                            )
                          }
                          onRemove={() =>
                            setProposedAssignments(prev =>
                              prev.map((p, i) =>
                                i === idx ? { ...p, tags: p.tags.filter((_, j) => j !== tagIdx) } : p,
                              ),
                            )
                          }
                        />
                      ))}
                    </div>
                    {proposal.reason && (
                      <Txt variant="ui-xs" className="text-neutral3 mt-1 italic">
                        {proposal.reason}
                      </Txt>
                    )}
                  </div>
                </div>
              );
            })}
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowProposalDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={handleAcceptProposals}
              disabled={proposedAssignments.filter(p => p.accepted).length === 0}
            >
              Accept {proposedAssignments.filter(p => p.accepted).length} proposals
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Main layout: toolbar + EntityList + Detail Panel */}
      <Columns className={cn('p-4', featuredItem ? 'grid-cols-[1fr_1fr]' : '')}>
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
                        All tags
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
            <div className="flex items-center gap-2">
              {!showCompleted && selectedItemIds.size > 0 && (
                <>
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
                      <DropdownMenu.Item
                        disabled={selectedItemIds.size === 0}
                        onSelect={() => openAnalyzeDialog('selected')}
                      >
                        <Icon size="sm">
                          <Sparkles />
                        </Icon>
                        Analyze selected
                      </DropdownMenu.Item>
                      <DropdownMenu.Item disabled={untaggedCount === 0} onSelect={() => openAnalyzeDialog('untagged')}>
                        <Icon size="sm">
                          <Sparkles />
                        </Icon>
                        Analyze untagged
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu>
                </>
              )}

              {onCreateScorer && filteredItems.length > 0 && !showCompleted && (
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => {
                    onCreateScorer(
                      filteredItems.map(item => ({
                        input: item.input,
                        output: item.output,
                      })),
                    );
                  }}
                >
                  <Icon size="sm">
                    <GaugeIcon />
                  </Icon>
                  Create Scorer
                </Button>
              )}
            </div>
          </Column.Toolbar>

          {isLoadingDisplay ? (
            <div className="flex-1 flex items-center justify-center">
              <Spinner className="h-4 w-4" />
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
                    : 'When you identify failures in experiment results, send them here to annotate, cluster, and create scorers from failure patterns.'}
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
                            <span className="flex items-center gap-1">
                              <Icon size="sm" className="text-neutral3">
                                <GaugeIcon />
                              </Icon>
                              <Txt variant="ui-xs" className="text-neutral4">
                                {scoreEntries[0][1].toFixed(2)}
                              </Txt>
                              {scoreEntries.length > 1 && <Badge variant="default">+{scoreEntries.length - 1}</Badge>}
                            </span>
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

        {/* Detail panel */}
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
            onComplete={async () => {
              await completeItem(featuredItem.id);
              void refetchCompleted();
            }}
            onPrevious={toPreviousItem}
            onNext={toNextItem}
            onClose={() => setFeaturedItemId(null)}
          />
        )}
      </Columns>
    </>
  );
}
