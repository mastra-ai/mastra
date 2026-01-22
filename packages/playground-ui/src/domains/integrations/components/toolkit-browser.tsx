import React, { useState } from 'react';
import { Loader2, Lock, Key } from 'lucide-react';
import { Checkbox } from '@/ds/components/Checkbox';
import { Txt } from '@/ds/components/Txt/Txt';
import { cn } from '@/lib/utils';
import { Searchbar, SearchbarWrapper } from '@/ds/components/Searchbar';
import { EmptyState } from '@/ds/components/EmptyState';
import { ToolCoinIcon } from '@/ds/icons/ToolCoinIcon';
import { Button } from '@/ds/components/Button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';

import type { ProviderToolkit } from '../types';

export interface ToolkitBrowserProps {
  /** Array of toolkits to display */
  toolkits?: ProviderToolkit[];
  /** Whether the toolkits are currently loading */
  isLoading?: boolean;
  /** Optional message to show while loading */
  loadingMessage?: string;
  /** Set of toolkit slugs that are currently selected */
  selectedToolkits?: Set<string>;
  /** Callback when toolkit selection changes */
  onSelectionChange?: (selectedSlugs: Set<string>) => void;
  /** Optional CSS class name */
  className?: string;
  /** Whether there are more toolkits to load */
  hasMore?: boolean;
  /** Callback to load more toolkits */
  onLoadMore?: () => void;
  /** Whether more toolkits are currently being loaded */
  isLoadingMore?: boolean;
}

/**
 * Displays a browsable grid of toolkits with search, filtering, and selection.
 * Used in the Add Tools dialog to browse and select toolkits from a provider.
 *
 * @example
 * ```tsx
 * const [selectedToolkits, setSelectedToolkits] = useState(new Set<string>());
 * const { data: toolkits, isLoading } = useProviderToolkits('composio');
 *
 * <ToolkitBrowser
 *   toolkits={toolkits?.toolkits}
 *   isLoading={isLoading}
 *   selectedToolkits={selectedToolkits}
 *   onSelectionChange={setSelectedToolkits}
 * />
 * ```
 */
export function ToolkitBrowser({
  toolkits = [],
  isLoading = false,
  loadingMessage,
  selectedToolkits = new Set(),
  onSelectionChange,
  className,
  hasMore = false,
  onLoadMore,
  isLoadingMore = false,
}: ToolkitBrowserProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  // Filter toolkits by search and category
  const filteredToolkits = toolkits.filter((toolkit) => {
    const matchesSearch =
      search === '' ||
      toolkit.name.toLowerCase().includes(search.toLowerCase()) ||
      toolkit.description?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === null || toolkit.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Get unique categories for filter dropdown
  const categories = Array.from(new Set(toolkits.map((t) => t.category).filter(Boolean))).sort();

  const handleToggleToolkit = (toolkitSlug: string | null | undefined) => {
    if (!onSelectionChange || !toolkitSlug) return;

    const newSelection = new Set(selectedToolkits);
    if (newSelection.has(toolkitSlug)) {
      newSelection.delete(toolkitSlug);
    } else {
      newSelection.add(toolkitSlug);
    }
    onSelectionChange(newSelection);
  };

  const handleSelectAll = () => {
    if (!onSelectionChange) return;
    // Filter out any null/undefined slugs
    onSelectionChange(new Set(filteredToolkits.map((t) => t.slug).filter((slug): slug is string => Boolean(slug))));
  };

  const handleClearSelection = () => {
    if (!onSelectionChange) return;
    onSelectionChange(new Set());
  };

  if (isLoading) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-12 gap-4', className)}>
        <Loader2 className="h-8 w-8 animate-spin text-icon3" />
        {loadingMessage && (
          <Txt variant="ui-sm" className="text-icon3 text-center max-w-md">
            {loadingMessage}
          </Txt>
        )}
      </div>
    );
  }

  if (toolkits.length === 0) {
    return (
      <div className={cn('py-8', className)}>
        <EmptyState
          iconSlot={<ToolCoinIcon />}
          titleSlot="No toolkits available"
          descriptionSlot="This provider doesn't have any toolkits available at this time."
          actionSlot={null}
        />
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Search and filters */}
      <SearchbarWrapper>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Searchbar onSearch={setSearch} label="Search toolkits" placeholder="Search by name or description" />
          </div>
          {categories.length > 0 && (
            <select
              className="bg-surface2 text-ui-md border-border1 h-8 rounded-lg border px-3 outline-none focus:border-accent1"
              value={categoryFilter || ''}
              onChange={(e) => setCategoryFilter(e.target.value || null)}
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          )}
        </div>
      </SearchbarWrapper>

      {/* Selection controls */}
      <div className="border-border1 flex items-center justify-between border-b px-4 py-2">
        <Txt variant="ui-sm" className="text-icon3">
          {selectedToolkits.size} of {filteredToolkits.length} selected
        </Txt>
        <div className="flex gap-2">
          <Button variant="ghost" size="md" onClick={handleSelectAll} disabled={!onSelectionChange}>
            Select all
          </Button>
          <Button
            variant="ghost"
            size="md"
            onClick={handleClearSelection}
            disabled={!onSelectionChange || selectedToolkits.size === 0}
          >
            Clear
          </Button>
        </div>
      </div>

      {/* Toolkit grid */}
      {filteredToolkits.length === 0 ? (
        <div className="py-12">
          <EmptyState
            iconSlot={<ToolCoinIcon />}
            titleSlot="No toolkits found"
            descriptionSlot={`No toolkits match "${search}". Try a different search term.`}
            actionSlot={null}
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredToolkits.map((toolkit) => (
              <ToolkitCard
                key={toolkit.slug}
                toolkit={toolkit}
                isSelected={selectedToolkits.has(toolkit.slug)}
                onToggle={onSelectionChange ? () => handleToggleToolkit(toolkit.slug) : undefined}
              />
            ))}
          </div>

          {/* Load more button */}
          {hasMore && onLoadMore && (
            <div className="border-border1 flex items-center justify-center border-t p-4">
              <Button onClick={onLoadMore} disabled={isLoadingMore} variant="outline">
                {isLoadingMore ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Load more'
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface ToolkitCardProps {
  toolkit: ProviderToolkit;
  isSelected: boolean;
  onToggle?: () => void;
}

function ToolkitCard({ toolkit, isSelected, onToggle }: ToolkitCardProps) {
  const handleCardClick = (e: React.MouseEvent) => {
    // Only toggle if clicking on the card itself, not on the checkbox
    const target = e.target as HTMLElement;
    if (target.closest('button[role="checkbox"]')) {
      return;
    }
    onToggle?.();
  };

  const handleCheckboxChange = () => {
    onToggle?.();
  };

  // Check auth requirements from metadata
  const authType = toolkit.metadata?.authType as 'oauth' | 'secret' | undefined;
  const authProvider = toolkit.metadata?.authProvider as string | undefined;
  const secretKey = toolkit.metadata?.secretKey as string | undefined;

  return (
    <div
      className={cn(
        'border-border1 bg-surface3 flex flex-col gap-3 rounded-lg border p-4 transition-colors',
        onToggle && 'cursor-pointer hover:border-border2 hover:bg-surface4',
        isSelected && 'border-accent1 bg-surface4',
      )}
      onClick={handleCardClick}
      role={onToggle ? 'button' : undefined}
      tabIndex={onToggle ? 0 : undefined}
      onKeyDown={
        onToggle
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onToggle();
              }
            }
          : undefined
      }
    >
      {/* Header with checkbox */}
      <div className="flex items-start gap-3">
        {onToggle && (
          <Checkbox
            checked={isSelected}
            onCheckedChange={handleCheckboxChange}
            onClick={(e) => e.stopPropagation()}
            className="mt-0.5"
          />
        )}
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Txt variant="ui-md" className="text-icon6 font-medium">
              {toolkit.name}
            </Txt>
            {authType === 'oauth' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 rounded bg-accent1/10 px-1.5 py-0.5">
                    <Lock className="h-3 w-3 text-accent1" />
                    <Txt variant="ui-xs" className="text-accent1">
                      OAuth
                    </Txt>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  Requires {authProvider || 'OAuth'} authorization
                </TooltipContent>
              </Tooltip>
            )}
            {authType === 'secret' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 rounded bg-warning1/10 px-1.5 py-0.5">
                    <Key className="h-3 w-3 text-warning1" />
                    <Txt variant="ui-xs" className="text-warning1">
                      API Key
                    </Txt>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  Requires {secretKey || 'API key'} configured in Arcade
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          {toolkit.category && (
            <Txt variant="ui-xs" className="text-icon3">
              {toolkit.category}
            </Txt>
          )}
        </div>
      </div>

      {/* Description */}
      {toolkit.description && (
        <Txt variant="ui-sm" className="text-icon3 line-clamp-2">
          {toolkit.description}
        </Txt>
      )}

      {/* Tool count */}
      {toolkit.toolCount !== undefined && (
        <div className="flex items-center gap-1.5">
          <ToolCoinIcon className="h-4 w-4 text-icon3" />
          <Txt variant="ui-xs" className="text-icon3">
            {toolkit.toolCount} {toolkit.toolCount === 1 ? 'tool' : 'tools'}
          </Txt>
        </div>
      )}
    </div>
  );
}
