/**
 * Observational Memory settings component.
 * Uses pi-tui's SettingsList for a clean settings UI with
 * threshold configuration and model selection submenus.
 *
 * Changes apply immediately — Esc closes the panel.
 */

import {
  Box,
  Container,
  fuzzyFilter,
  getEditorKeybindings,
  Input,
  SelectList,
  SettingsList,
  Spacer,
  Text,
} from '@mariozechner/pi-tui';
import type { Focusable, SelectItem, SettingItem, TUI } from '@mariozechner/pi-tui';
import { theme, getSettingsListTheme, getSelectListTheme } from '../theme.js';

// =============================================================================
// Types
// =============================================================================

export interface OMSettingsConfig {
  observerModelId: string;
  reflectorModelId: string;
  observationThreshold: number;
  reflectionThreshold: number;
}

export interface OMSettingsCallbacks {
  onObserverModelChange: (modelId: string) => void;
  onReflectorModelChange: (modelId: string) => void;
  onObservationThresholdChange: (value: number) => void;
  onReflectionThresholdChange: (value: number) => void;
  onClose: () => void;
}

export interface ModelOption {
  id: string;
  label: string;
}

// =============================================================================
// Threshold presets (in tokens)
// =============================================================================

const OBSERVATION_THRESHOLDS = [5_000, 10_000, 15_000, 20_000, 30_000, 50_000, 75_000, 100_000];

const REFLECTION_THRESHOLDS = [10_000, 20_000, 30_000, 40_000, 60_000, 80_000, 100_000, 150_000];

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
  return String(n);
}

function parseTokenInput(input: string): number | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  // Match patterns like "30k", "30", "30000", "1.5k"
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*k?$/);
  if (!match) return null;

  const num = parseFloat(match[1]!);
  if (isNaN(num) || num <= 0) return null;

  // "30k" → 30,000
  if (trimmed.endsWith('k')) {
    return num * 1000;
  }
  // Small numbers (< 500) assumed to be in thousands: "30" → 30,000
  if (num < 500) {
    return num * 1000;
  }
  // Large numbers used as-is: "30000" → 30,000
  return num;
}

// =============================================================================
// Threshold Input Submenu
// =============================================================================

class ThresholdSubmenu extends Container {
  private input: Input;
  private selectList: SelectList;
  private onDone: (value: number) => void;
  private onBack: () => void;
  private inInputMode = true;

  constructor(
    title: string,
    currentValue: number,
    presets: number[],
    onDone: (value: number) => void,
    onBack: () => void,
  ) {
    super();
    this.onDone = onDone;
    this.onBack = onBack;

    this.addChild(new Text(theme.bold(theme.fg('accent', title)), 0, 0));
    this.addChild(new Spacer(1));

    // Input for custom value — type a number like 30 for 30k
    this.addChild(new Text(theme.fg('muted', '  _k tokens (type a number, e.g. 30 for 30k):'), 0, 0));
    this.input = new Input();
    this.addChild(this.input);
    this.addChild(new Spacer(1));

    // Preset list
    this.addChild(new Text(theme.fg('muted', '  Or pick a preset:'), 0, 0));

    const items: SelectItem[] = presets.map(p => ({
      value: String(p),
      label: `  ${formatTokens(p)} tokens`,
    }));

    this.selectList = new SelectList(items, Math.min(items.length, 8), getSelectListTheme());

    // Pre-select current value
    const currentIndex = presets.indexOf(currentValue);
    if (currentIndex !== -1) {
      this.selectList.setSelectedIndex(currentIndex);
    }

    this.selectList.onSelect = (item: SelectItem) => {
      this.onDone(parseInt(item.value, 10));
    };
    this.selectList.onCancel = onBack;

    this.addChild(this.selectList);
    this.addChild(new Spacer(1));
    this.addChild(new Text(theme.fg('dim', '  Enter to confirm · ↓ for presets · Esc to go back'), 0, 0));
  }

  handleInput(data: string): void {
    if (this.inInputMode) {
      // Enter — submit the typed value
      if (data === '\r' || data === '\n') {
        const parsed = parseTokenInput(this.input.getValue());
        if (parsed) {
          this.onDone(parsed);
        }
        return;
      }

      // Escape
      if (data === '\x1b' || data === '\x1b\x1b') {
        this.onBack();
        return;
      }

      // Down arrow — switch to preset list
      if (data === '\x1b[B') {
        this.inInputMode = false;
        return;
      }

      // Delegate to input (numbers, backspace, etc.)
      this.input.handleInput(data);
    } else {
      // In preset list mode
      // Escape — go back (handled by selectList.onCancel)
      this.selectList.handleInput(data);
    }
  }
}

// =============================================================================
// Model Select Submenu
// =============================================================================

class ModelSelectSubmenu extends Container {
  private searchInput: Input;
  private listContainer: Container;
  private allModels: ModelOption[];
  private filteredModels: ModelOption[];
  private selectedIndex = 0;
  private currentModelId: string;
  private onSelect: (modelId: string) => void;
  private onCancel: () => void;
  private tui: TUI;

  constructor(
    title: string,
    models: ModelOption[],
    currentModelId: string,
    onSelect: (modelId: string) => void,
    onCancel: () => void,
    tui: TUI,
  ) {
    super();
    this.allModels = models;
    this.filteredModels = models;
    this.currentModelId = currentModelId;
    this.onSelect = onSelect;
    this.onCancel = onCancel;
    this.tui = tui;

    this.addChild(new Text(theme.bold(theme.fg('accent', title)), 0, 0));
    this.addChild(new Spacer(1));
    this.addChild(new Text(theme.fg('muted', 'Type to search · ↑↓ navigate · Enter select · Esc back'), 0, 0));
    this.addChild(new Spacer(1));

    this.searchInput = new Input();
    this.addChild(this.searchInput);
    this.addChild(new Spacer(1));

    this.listContainer = new Container();
    this.addChild(this.listContainer);

    // Pre-select current model
    const currentIndex = models.findIndex(m => m.id === currentModelId);
    if (currentIndex !== -1) {
      this.selectedIndex = currentIndex;
    }

    this.updateList();
  }

  private filterModels(query: string): void {
    this.filteredModels = query ? fuzzyFilter(this.allModels, query, m => `${m.id} ${m.label}`) : this.allModels;

    this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, this.filteredModels.length - 1));
    this.updateList();
  }

  private updateList(): void {
    this.listContainer.clear();

    const maxVisible = 10;
    const total = this.filteredModels.length;
    const startIndex = Math.max(0, Math.min(this.selectedIndex - Math.floor(maxVisible / 2), total - maxVisible));
    const endIndex = Math.min(startIndex + maxVisible, total);

    for (let i = startIndex; i < endIndex; i++) {
      const item = this.filteredModels[i]!;
      const isSelected = i === this.selectedIndex;
      const isCurrent = item.id === this.currentModelId;
      const checkmark = isCurrent ? theme.fg('success', ' ✓') : '';

      const line = isSelected ? theme.fg('accent', `→ ${item.label}`) + checkmark : `  ${item.label}` + checkmark;

      this.listContainer.addChild(new Text(line, 0, 0));
    }

    if (startIndex > 0 || endIndex < total) {
      this.listContainer.addChild(new Text(theme.fg('muted', `(${this.selectedIndex + 1}/${total})`), 0, 0));
    }

    if (total === 0) {
      this.listContainer.addChild(new Text(theme.fg('muted', 'No matching models'), 0, 0));
    }
  }

  handleInput(data: string): void {
    const kb = getEditorKeybindings();
    const total = this.filteredModels.length;

    if (kb.matches(data, 'selectUp')) {
      if (total === 0) return;
      this.selectedIndex = this.selectedIndex === 0 ? total - 1 : this.selectedIndex - 1;
      this.updateList();
      this.tui.requestRender();
    } else if (kb.matches(data, 'selectDown')) {
      if (total === 0) return;
      this.selectedIndex = this.selectedIndex === total - 1 ? 0 : this.selectedIndex + 1;
      this.updateList();
      this.tui.requestRender();
    } else if (kb.matches(data, 'selectConfirm')) {
      const selected = this.filteredModels[this.selectedIndex];
      if (selected) this.onSelect(selected.id);
    } else if (kb.matches(data, 'selectCancel')) {
      this.onCancel();
    } else {
      this.searchInput.handleInput(data);
      this.filterModels(this.searchInput.getValue());
      this.tui.requestRender();
    }
  }
}

// =============================================================================
// OM Settings Component
// =============================================================================

export class OMSettingsComponent extends Box implements Focusable {
  private settingsList: SettingsList;

  // Focusable implementation
  private _focused = false;
  get focused(): boolean {
    return this._focused;
  }
  set focused(value: boolean) {
    this._focused = value;
  }

  constructor(config: OMSettingsConfig, callbacks: OMSettingsCallbacks, models: ModelOption[], tui: TUI) {
    super(2, 1, (text: string) => theme.bg('overlayBg', text));

    // Title
    this.addChild(new Text(theme.bold(theme.fg('accent', 'Observational Memory Settings')), 0, 0));
    this.addChild(new Spacer(1));

    // Build settings items
    const items: SettingItem[] = [
      {
        id: 'observer-model',
        label: 'Observer model',
        description: 'Model used for observing and summarizing message history',
        currentValue: getShortModelName(config.observerModelId),
        submenu: (_currentValue, done) =>
          new ModelSelectSubmenu(
            'Observer Model',
            models,
            config.observerModelId,
            modelId => {
              config.observerModelId = modelId;
              callbacks.onObserverModelChange(modelId);
              done(getShortModelName(modelId));
            },
            () => done(),
            tui,
          ),
      },
      {
        id: 'reflector-model',
        label: 'Reflector model',
        description: 'Model used for compressing observations when they grow too large',
        currentValue: getShortModelName(config.reflectorModelId),
        submenu: (_currentValue, done) =>
          new ModelSelectSubmenu(
            'Reflector Model',
            models,
            config.reflectorModelId,
            modelId => {
              config.reflectorModelId = modelId;
              callbacks.onReflectorModelChange(modelId);
              done(getShortModelName(modelId));
            },
            () => done(),
            tui,
          ),
      },
      {
        id: 'obs-threshold',
        label: 'Observation threshold',
        description:
          'Token count before triggering observation. ' +
          'Lower = more frequent, higher = more context before observing',
        currentValue: formatTokens(config.observationThreshold),
        submenu: (_currentValue, done) =>
          new ThresholdSubmenu(
            'Observation Threshold',
            config.observationThreshold,
            OBSERVATION_THRESHOLDS,
            value => {
              config.observationThreshold = value;
              callbacks.onObservationThresholdChange(value);
              done(formatTokens(value));
            },
            () => done(),
          ),
      },
      {
        id: 'ref-threshold',
        label: 'Reflection threshold',
        description:
          'Token count of observations before triggering compression. ' +
          'Lower = more frequent, higher = more observations before compressing',
        currentValue: formatTokens(config.reflectionThreshold),
        submenu: (_currentValue, done) =>
          new ThresholdSubmenu(
            'Reflection Threshold',
            config.reflectionThreshold,
            REFLECTION_THRESHOLDS,
            value => {
              config.reflectionThreshold = value;
              callbacks.onReflectionThresholdChange(value);
              done(formatTokens(value));
            },
            () => done(),
          ),
      },
    ];

    this.settingsList = new SettingsList(
      items,
      10,
      getSettingsListTheme(),
      (_id, _newValue) => {
        // All changes handled via submenu callbacks
      },
      callbacks.onClose,
    );

    this.addChild(this.settingsList);
  }

  handleInput(data: string): void {
    this.settingsList.handleInput(data);
  }
}

// =============================================================================
// Helpers
// =============================================================================

function getShortModelName(modelId: string): string {
  if (!modelId) return '(none)';
  const parts = modelId.split('/');
  return parts.length > 1 ? parts.slice(1).join('/') : modelId;
}
