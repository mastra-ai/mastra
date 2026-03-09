/**
 * Model selector component for switching between available models.
 * Uses pi-tui overlay pattern with search and fuzzy filtering.
 */

import { Box, Container, fuzzyFilter, getEditorKeybindings, Input, Spacer, Text } from '@mariozechner/pi-tui';
import type { Focusable, TUI } from '@mariozechner/pi-tui';
import chalk from 'chalk';
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

export class ModelSelectorComponent extends Box implements Focusable {
  private searchInput!: Input;
  private listContainer!: Container;
  private allModels: ModelItem[];
  private filteredModels: ModelItem[];
  private selectedIndex = 0;
  private currentModelId?: string;
  private onSelectCallback: (model: ModelItem) => void;
  private onCancelCallback: () => void;
  private tui: TUI;
  private title: string;
  private titleColor?: string;

  // Focusable implementation
  private _focused = false;
  get focused(): boolean {
    return this._focused;
  }
  set focused(value: boolean) {
    this._focused = value;
    this.searchInput.focused = value;
  }

  constructor(options: ModelSelectorOptions) {
    // Box with padding and background
    super(2, 1, text => theme.bg('overlayBg', text));

    this.tui = options.tui;
    this.title = options.title ?? 'Select Model';
    this.titleColor = options.titleColor;
    this.allModels = this.sortModels(options.models, options.currentModelId);
    this.currentModelId = options.currentModelId;
    this.onSelectCallback = options.onSelect;
    this.onCancelCallback = options.onCancel;
    this.filteredModels = this.allModels;

    // Build UI
    this.buildUI();
  }

  private buildUI(): void {
    // Title — optionally with a mode-colored background
    const titleText = this.titleColor
      ? chalk.bgHex(this.titleColor).white.bold(` ${this.title} `)
      : theme.bold(theme.fg('accent', this.title));
    this.addChild(new Text(titleText, 0, 0));
    this.addChild(new Spacer(1));

    // Hint
    this.addChild(new Text(theme.fg('muted', 'Type to search • ↑↓ navigate • Enter select • Esc cancel'), 0, 0));
    this.addChild(new Spacer(1));

    // Search input (Input has built-in "> " prompt)
    this.searchInput = new Input();
    this.searchInput.onSubmit = () => {
      if (this.hasCustomItem && this.selectedIndex === 0) {
        const query = this.searchInput.getValue().trim();
        if (query) this.handleSelect(this.makeCustomModelItem(query));
      } else {
        const modelIndex = this.hasCustomItem ? this.selectedIndex - 1 : this.selectedIndex;
        const selected = this.filteredModels[modelIndex];
        if (selected) this.handleSelect(selected);
      }
    };
    this.addChild(this.searchInput);
    this.addChild(new Spacer(1));

    // List container
    this.listContainer = new Container();
    this.addChild(this.listContainer);

    // Initial render
    this.updateList();
  }

  private sortModels(models: ModelItem[], currentModelId?: string): ModelItem[] {
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

  /** Whether the custom "Use: ..." item is showing at the top */
  private hasCustomItem = false;

  private filterModels(query: string): void {
    // Apply fuzzy filter if there's a query, otherwise show all
    // Sorting already puts models with API keys first
    this.filteredModels = query
      ? fuzzyFilter(this.allModels, query, m => `${m.id} ${m.provider} ${m.modelName}`)
      : this.allModels;

    // Show "Use: query" custom item when query looks like a model ID
    // and doesn't exactly match the top result
    const trimmed = query.trim();
    this.hasCustomItem = trimmed.length > 0 && this.filteredModels[0]?.id !== trimmed;

    const totalItems = this.filteredModels.length + (this.hasCustomItem ? 1 : 0);
    this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, totalItems - 1));
    this.updateList();
  }

  private makeCustomModelItem(id: string): ModelItem {
    const parts = id.split('/');
    const provider = parts.length > 1 ? parts[0]! : 'custom';
    const modelName = parts.length > 1 ? parts.slice(1).join('/') : id;
    return { id, provider, modelName, hasApiKey: true };
  }

  private updateList(): void {
    this.listContainer.clear();

    const totalItems = this.filteredModels.length + (this.hasCustomItem ? 1 : 0);
    const maxVisible = 12;
    const startIndex = Math.max(0, Math.min(this.selectedIndex - Math.floor(maxVisible / 2), totalItems - maxVisible));
    const endIndex = Math.min(startIndex + maxVisible, totalItems);

    for (let i = startIndex; i < endIndex; i++) {
      // First item is the custom "Use: ..." entry when active
      if (this.hasCustomItem && i === 0) {
        const query = this.searchInput.getValue().trim();
        const isSelected = this.selectedIndex === 0;
        const line = isSelected
          ? theme.fg('accent', '→ ') + theme.bold(theme.fg('accent', `Use: ${query}`))
          : '  ' + theme.fg('muted', `Use: ${query}`);
        this.listContainer.addChild(new Text(line, 0, 0));
        continue;
      }

      // Offset into filteredModels (subtract 1 when custom item is present)
      const modelIndex = this.hasCustomItem ? i - 1 : i;
      const item = this.filteredModels[modelIndex];
      if (!item) continue;

      const isSelected = i === this.selectedIndex;
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

      this.listContainer.addChild(new Text(line, 0, 0));
    }

    // Scroll indicator
    if (startIndex > 0 || endIndex < totalItems) {
      const scrollInfo = theme.fg('muted', `(${this.selectedIndex + 1}/${totalItems})`);
      this.listContainer.addChild(new Text(scrollInfo, 0, 0));
    }

    // Empty state
    if (totalItems === 0) {
      this.listContainer.addChild(new Text(theme.fg('muted', 'No matching models'), 0, 0));
    }
  }

  handleInput(keyData: string): void {
    const kb = getEditorKeybindings();

    const totalItems = this.filteredModels.length + (this.hasCustomItem ? 1 : 0);

    // Up arrow
    if (kb.matches(keyData, 'selectUp')) {
      if (totalItems === 0) return;
      this.selectedIndex = this.selectedIndex === 0 ? totalItems - 1 : this.selectedIndex - 1;
      this.updateList();
      this.tui.requestRender();
    }
    // Down arrow
    else if (kb.matches(keyData, 'selectDown')) {
      if (totalItems === 0) return;
      this.selectedIndex = this.selectedIndex === totalItems - 1 ? 0 : this.selectedIndex + 1;
      this.updateList();
      this.tui.requestRender();
    }
    // Enter
    else if (kb.matches(keyData, 'selectConfirm')) {
      if (this.hasCustomItem && this.selectedIndex === 0) {
        const query = this.searchInput.getValue().trim();
        if (query) this.handleSelect(this.makeCustomModelItem(query));
      } else {
        const modelIndex = this.hasCustomItem ? this.selectedIndex - 1 : this.selectedIndex;
        const selected = this.filteredModels[modelIndex];
        if (selected) this.handleSelect(selected);
      }
    }
    // Escape or Ctrl+C
    else if (kb.matches(keyData, 'selectCancel')) {
      this.onCancelCallback();
    }
    // Pass everything else to search input
    else {
      this.searchInput.handleInput(keyData);
      this.filterModels(this.searchInput.getValue());
      this.tui.requestRender();
    }
  }

  private handleSelect(model: ModelItem): void {
    this.onSelectCallback(model);
  }

  getSearchInput(): Input {
    return this.searchInput;
  }
}
