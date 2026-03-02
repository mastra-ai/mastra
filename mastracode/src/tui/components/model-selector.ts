/**
 * Model selector component for switching between available models.
 * Uses SearchableListOverlay for search and fuzzy filtering.
 */

import { Input, Text } from '@mariozechner/pi-tui';
import type { TUI } from '@mariozechner/pi-tui';
import chalk from 'chalk';
import { SearchableListOverlay } from './searchable-list-overlay.js';
import { theme } from '../theme.js';

// =============================================================================
// Types
// =============================================================================

export interface ModelItem {
  /** Full model ID (e.g., "anthropic/claude-sonnet-4") */
  id: string;
  /** Provider name (e.g., "anthropic") */
  provider: string;
  /** Model name without provider (e.g., "claude-sonnet-4") */
  modelName: string;
  /** Whether the API key for this provider is available */
  hasApiKey: boolean;
  /** Environment variable name for the API key (e.g., "ANTHROPIC_API_KEY") */
  apiKeyEnvVar?: string;
  /** Number of times this model has been selected (for ranking) */
  useCount?: number;
}

export interface ModelSelectorOptions {
  /** TUI instance for rendering */
  tui: TUI;
  /** List of available models */
  models: ModelItem[];
  /** Currently selected model ID */
  currentModelId?: string;
  /** Optional title for the selector */
  title?: string;
  /** Optional hex color for the title background (e.g. mode color) */
  titleColor?: string;
  /** Callback when a model is selected */
  onSelect: (model: ModelItem) => void;
  /** Callback when selection is cancelled */
  onCancel: () => void;
}

// =============================================================================
// ModelSelectorComponent
// =============================================================================

export class ModelSelectorComponent extends SearchableListOverlay<ModelItem> {
  private currentModelId?: string;
  private onSelectCallback: (model: ModelItem) => void;
  private onCancelCallback: () => void;
  private titleColorHex?: string;

  /** Whether the custom "Use: ..." item is showing at the top */
  private hasCustomItem = false;

  constructor(options: ModelSelectorOptions) {
    const sorted = ModelSelectorComponent.sortModels(options.models, options.currentModelId);

    super(
      {
        tui: options.tui,
        title: options.title ?? 'Select Model',
      },
      sorted,
    );

    this.currentModelId = options.currentModelId;
    this.onSelectCallback = options.onSelect;
    this.onCancelCallback = options.onCancel;
    this.titleColorHex = options.titleColor;
  }

  // ---------------------------------------------------------------------------
  // SearchableListOverlay implementation
  // ---------------------------------------------------------------------------

  protected renderTitle(title: string): string {
    if (this.titleColorHex) {
      return chalk.bgHex(this.titleColorHex).white.bold(` ${title} `);
    }
    return theme.bold(theme.fg('accent', title));
  }

  protected getSearchableText(item: ModelItem): string {
    return `${item.id} ${item.provider} ${item.modelName}`;
  }

  protected renderItem(item: ModelItem, index: number, isSelected: boolean): Text[] {
    const isCurrent = item.id === this.currentModelId;
    const checkmark = isCurrent ? theme.fg('success', ' ✓') : '';
    const noKeyIndicator = !item.hasApiKey
      ? theme.fg('error', ' ✗') + theme.fg('muted', item.apiKeyEnvVar ? ` (${item.apiKeyEnvVar})` : ' (no key)')
      : '';

    let line = '';
    if (isSelected) {
      line = theme.fg('accent', '→ ' + item.id) + checkmark + noKeyIndicator;
    } else {
      const modelText = item.hasApiKey ? item.id : theme.fg('muted', item.id);
      line = '  ' + modelText + checkmark + noKeyIndicator;
    }

    return [new Text(line, 0, 0)];
  }

  protected onSelect(model: ModelItem): void {
    this.onSelectCallback(model);
  }

  protected onCancel(): void {
    this.onCancelCallback();
  }

  protected getEmptyMessage(): string {
    return 'No matching models';
  }

  // ---------------------------------------------------------------------------
  // Custom model entry (synthetic first item)
  // ---------------------------------------------------------------------------

  protected override filterItems(query: string): void {
    super.filterItems(query);

    // Show "Use: query" custom item when query looks like a model ID
    // and doesn't exactly match the top result
    const trimmed = query.trim();
    this.hasCustomItem = trimmed.length > 0 && this.filteredItems[0]?.id !== trimmed;

    const total = this.getTotalItemCount();
    this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, total - 1));
    this.updateList();
  }

  protected override getTotalItemCount(): number {
    return this.filteredItems.length + (this.hasCustomItem ? 1 : 0);
  }

  protected override confirmSelection(): void {
    if (this.hasCustomItem && this.selectedIndex === 0) {
      const query = this.getSearchValue().trim();
      if (query) this.onSelectCallback(this.makeCustomModelItem(query));
    } else {
      const modelIndex = this.hasCustomItem ? this.selectedIndex - 1 : this.selectedIndex;
      const selected = this.filteredItems[modelIndex];
      if (selected) this.onSelectCallback(selected);
    }
  }

  protected override renderListRow(index: number, isSelected: boolean): Text[] {
    // First item is the custom "Use: ..." entry when active
    if (this.hasCustomItem && index === 0) {
      const query = this.getSearchValue().trim();
      const line = isSelected
        ? theme.fg('accent', '→ ') + theme.bold(theme.fg('accent', `Use: ${query}`))
        : '  ' + theme.fg('muted', `Use: ${query}`);
      return [new Text(line, 0, 0)];
    }

    // Offset into filteredItems (subtract 1 when custom item is present)
    const modelIndex = this.hasCustomItem ? index - 1 : index;
    const item = this.filteredItems[modelIndex];
    if (!item) return [];
    return this.renderItem(item, modelIndex, isSelected);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private makeCustomModelItem(id: string): ModelItem {
    const parts = id.split('/');
    const provider = parts.length > 1 ? parts[0]! : 'custom';
    const modelName = parts.length > 1 ? parts.slice(1).join('/') : id;
    return { id, provider, modelName, hasApiKey: true };
  }

  private static sortModels(models: ModelItem[], currentModelId?: string): ModelItem[] {
    const sorted = [...models];

    // Sort: current first, then API key available, then by use count (desc), then alphabetical
    sorted.sort((a, b) => {
      // Current model always first
      const aIsCurrent = a.id === currentModelId;
      const bIsCurrent = b.id === currentModelId;
      if (aIsCurrent && !bIsCurrent) return -1;
      if (!aIsCurrent && bIsCurrent) return 1;

      // Models with API keys come before those without
      if (a.hasApiKey && !b.hasApiKey) return -1;
      if (!a.hasApiKey && b.hasApiKey) return 1;

      // Then by use count (higher = first)
      const aCount = a.useCount ?? 0;
      const bCount = b.useCount ?? 0;
      if (aCount !== bCount) return bCount - aCount;

      // Then by provider
      const providerCompare = a.provider.localeCompare(b.provider);
      if (providerCompare !== 0) return providerCompare;

      // Then by model name
      return a.modelName.localeCompare(b.modelName);
    });

    return sorted;
  }

  getSearchInput(): Input {
    return this.searchInput;
  }
}
