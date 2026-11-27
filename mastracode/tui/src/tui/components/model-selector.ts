/**
 * Model selector menu for switching between available models, filtered as you type (fuzzy).
 */

import { decodeKittyPrintable, fuzzyFilter, getKeybindings, matchesKey } from '@earendil-works/pi-tui';
import type { Component, Focusable, TUI } from '@earendil-works/pi-tui';
import { parseCodexModelSelection } from '@mastra/code-sdk/providers/model-ids';
import type { MouseAware, MousePoint, MouseTarget } from '../mouse/hit-test.js';
import { theme } from '../theme.js';
import type { ListWindow } from './list-window.js';
import type { Filterable, MenuChrome } from './menu-chrome.js';
import { labelColumnWidth, menuRow } from './menu-list.js';
import { PickerList } from './picker-list.js';

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
  /** Optional label shown instead of the model ID */
  displayName?: string;
}

export interface ModelSelectorOptions {
  /** TUI instance for rendering */
  tui: TUI;
  /** List of available models */
  models: ModelItem[];
  /** Currently selected model ID */
  currentModelId?: string;
  /** Optional title for the selector (its search placeholder) */
  title?: string;
  /** @deprecated Ignored: menus show their title as the search placeholder. */
  titleColor?: string;
  /** Callback when a model is selected */
  onSelect: (model: ModelItem) => void;
  /** Callback when selection is cancelled */
  onCancel: () => void;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Build a synthetic "Use: <id>" ModelItem for an arbitrary model id typed by
 * the user. The provider prefix is parsed from the id; key metadata is
 * derived from any sibling model that already lives under the same provider
 * so the API-key prompt still fires for known providers without a key.
 *
 * If no sibling is found (truly novel provider), we default `hasApiKey: false`
 * so the user is still prompted for a key by provider name.
 */
export function makeCustomModelItem(id: string, models: ModelItem[]): ModelItem {
  const parts = id.split('/');
  const provider = parts.length > 1 ? parts[0]! : 'custom';
  const modelName = parts.length > 1 ? parts.slice(1).join('/') : id;
  const sibling = models.find(m => m.provider === provider);
  return {
    id,
    provider,
    modelName,
    hasApiKey: sibling?.hasApiKey ?? false,
    apiKeyEnvVar: sibling?.apiKeyEnvVar,
  };
}

const MASTRACODE_GATEWAY_PREFIX = 'mastracode/';
const FAST_SUFFIX = ':fast';

/**
 * The shared catalog namespaces the MastraCode gateway's providers (the user's
 * custom providers) as `mastracode/<provider>/<model>`, but Mastra Code
 * resolves and saves them as `<provider>/<model>`. Show and
 * select them under that canonical id so typed ids match catalog rows and the
 * saved id resolves. When a canonical id is listed twice, keep the authenticated
 * entry.
 */
export function toCanonicalModelItems(models: ModelItem[]): ModelItem[] {
  const byId = new Map<string, ModelItem>();
  for (const model of models) {
    const canonical = model.provider.startsWith(MASTRACODE_GATEWAY_PREFIX)
      ? {
          ...model,
          id: model.id.slice(MASTRACODE_GATEWAY_PREFIX.length),
          provider: model.provider.slice(MASTRACODE_GATEWAY_PREFIX.length),
        }
      : model;
    const existing = byId.get(canonical.id);
    if (!existing || (!existing.hasApiKey && canonical.hasApiKey)) byId.set(canonical.id, canonical);
  }
  return [...byId.values()];
}

// =============================================================================
// ModelSelectorComponent
// =============================================================================

const MAX_VISIBLE = 12;

export class ModelSelectorComponent implements Component, Focusable, Filterable, MenuChrome, MouseAware {
  focused = false;
  private readonly allModels: ModelItem[];
  private filteredModels: ModelItem[];
  private selectedIndex = 0;
  private query = '';
  /** Whether the custom "Use: ..." item is showing at the top */
  private hasCustomItem = false;
  private readonly list: PickerList<ModelItem | null>;
  private readonly labelColumn: number;
  private readonly currentModelId?: string;
  private readonly onSelectCallback: (model: ModelItem) => void;
  private readonly onCancelCallback: () => void;
  private readonly tui: TUI;
  private readonly title: string;

  constructor(options: ModelSelectorOptions) {
    this.tui = options.tui;
    this.title = options.title ?? 'Select model';
    const models = toCanonicalModelItems(options.models);
    // A Fast selection marks its own row when the picker offers one, else its standard model's row.
    this.currentModelId =
      options.currentModelId && !models.some(model => model.id === options.currentModelId)
        ? parseCodexModelSelection(options.currentModelId).modelId
        : options.currentModelId;
    this.allModels = this.sortModels(models, this.currentModelId);
    this.onSelectCallback = options.onSelect;
    this.onCancelCallback = options.onCancel;
    this.filteredModels = this.allModels;
    this.labelColumn = labelColumnWidth(this.allModels.map(item => item.displayName ?? item.id));
    this.list = new PickerList<ModelItem | null>({
      maxVisible: MAX_VISIBLE,
      truncate: true,
      renderItem: (item, selected) => [this.renderRow(item, selected)],
      onActivate: index => {
        this.selectedIndex = index;
        this.updateList();
        this.handleInput('\r');
      },
      emptyText: () => '  no matching models',
    });
    this.updateList();
  }

  menuWindow(): ListWindow {
    return this.list.menuWindow();
  }

  mouseTarget(point: MousePoint): MouseTarget | undefined {
    return this.list.mouseTarget(point);
  }

  menuTitle(): string {
    return this.title;
  }

  menuFilterTarget(): Filterable {
    return this;
  }

  setFilter(query: string): void {
    this.query = query;
    // Apply fuzzy filter if there's a query, otherwise show all
    // Sorting already puts models with API keys first
    this.filteredModels = query
      ? fuzzyFilter(this.allModels, query, m => `${m.displayName ?? ''} ${m.id} ${m.provider} ${m.modelName}`)
      : this.allModels;

    // Show "Use: query" only for a complete provider/model-shaped ID.
    // Plain search terms should select the best catalog match on Enter.
    const trimmed = query.trim();
    this.hasCustomItem =
      trimmed.length > 0 &&
      (trimmed.includes('/') || this.filteredModels.length === 0) &&
      this.filteredModels[0]?.id !== trimmed;

    this.selectedIndex = 0;
    this.updateList();
    this.tui.requestRender();
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

    return this.keepFastEntriesNextToStandard(sorted, currentModelId);
  }

  /**
   * Puts each Codex Fast entry directly under its standard model. A Fast entry that is the current model stays first,
   * with its standard model right below it. `:fast` on any other provider is part of the model name and stays put.
   */
  private keepFastEntriesNextToStandard(sorted: ModelItem[], currentModelId?: string): ModelItem[] {
    const byId = new Map(sorted.map(model => [model.id, model]));
    const isFastEntry = (model: ModelItem | undefined) =>
      model !== undefined && parseCodexModelSelection(model.id).codexServiceTier === 'fast';
    const standardOf = (model: ModelItem) =>
      isFastEntry(model) ? byId.get(parseCodexModelSelection(model.id).modelId) : undefined;
    const placed = new Set<string>();
    const result: ModelItem[] = [];
    for (const model of sorted) {
      if (placed.has(model.id)) continue;
      const standard = standardOf(model);
      if (standard && model.id !== currentModelId) continue;
      result.push(model);
      placed.add(model.id);
      const fastEntry = byId.get(`${model.id}${FAST_SUFFIX}`);
      const partner = standard ?? (isFastEntry(fastEntry) ? fastEntry : undefined);
      if (partner && !placed.has(partner.id)) {
        result.push(partner);
        placed.add(partner.id);
      }
    }
    return result;
  }

  invalidate(): void {
    this.list.invalidate();
  }

  render(width: number): string[] {
    return this.list.render(width);
  }

  private updateList(): void {
    // `null` stands for the custom "Use: <query>" row shown first when active.
    const rows: (ModelItem | null)[] = this.hasCustomItem ? [null, ...this.filteredModels] : this.filteredModels;
    this.list.setItems(rows, this.selectedIndex);
  }

  private renderRow(item: ModelItem | null, isSelected: boolean): string {
    if (!item) return menuRow(isSelected, `Use: ${this.query.trim()}`);
    const label = item.displayName ?? item.id;
    const status = [
      item.id === this.currentModelId ? theme.fg('success', '✓') : '',
      item.hasApiKey ? '' : theme.fg('error', '✗') + theme.fg('muted', ` ${item.apiKeyEnvVar ?? 'no key'}`),
    ]
      .filter(Boolean)
      .join(' ');
    return menuRow(isSelected, item.hasApiKey ? label : theme.fg('muted', label), status, this.labelColumn);
  }

  handleInput(keyData: string): void {
    const kb = getKeybindings();
    const totalItems = this.filteredModels.length + (this.hasCustomItem ? 1 : 0);

    if (kb.matches(keyData, 'tui.select.up')) {
      if (totalItems === 0) return;
      this.selectedIndex = this.selectedIndex === 0 ? totalItems - 1 : this.selectedIndex - 1;
      this.updateList();
      this.tui.requestRender();
    } else if (kb.matches(keyData, 'tui.select.down')) {
      if (totalItems === 0) return;
      this.selectedIndex = this.selectedIndex === totalItems - 1 ? 0 : this.selectedIndex + 1;
      this.updateList();
      this.tui.requestRender();
    } else if (kb.matches(keyData, 'tui.select.confirm')) {
      if (this.hasCustomItem && this.selectedIndex === 0) {
        const query = this.query.trim();
        if (query) this.onSelectCallback(makeCustomModelItem(query, this.allModels));
      } else {
        const selected = this.filteredModels[this.hasCustomItem ? this.selectedIndex - 1 : this.selectedIndex];
        if (selected) this.onSelectCallback(selected);
      }
    } else if (kb.matches(keyData, 'tui.select.cancel')) {
      this.onCancelCallback();
    } else if (matchesKey(keyData, 'backspace')) {
      // In the prompt slot the search row handles typing; shown on its own, the selector does.
      this.setFilter(this.query.slice(0, -1));
    } else {
      const typed = keyData.length === 1 && keyData >= ' ' ? keyData : decodeKittyPrintable(keyData);
      if (typed) this.setFilter(this.query + typed);
    }
  }
}
