/**
 * Observational Memory settings menu (/om): threshold configuration and
 * model selection submenus.
 *
 * Changes apply immediately — Esc closes the menu.
 */

import { Container, getKeybindings, Spacer, Text } from '@earendil-works/pi-tui';
import type { Focusable, SelectItem, SettingItem, TUI, Input } from '@earendil-works/pi-tui';
import type { OMModel } from '@mastra/core/agent-controller';
import { theme } from '../theme.js';
import type { Filterable, MenuChrome } from './menu-chrome.js';
import { lowerFirst } from './menu-chrome.js';
import { MenuList } from './menu-list.js';
import { ModelSelectorComponent } from './model-selector.js';
import type { ModelItem } from './model-selector.js';
import { SettingsMenu } from './settings-menu.js';
import { TextInput } from './text-input.js';

// =============================================================================
// Types
// =============================================================================

export interface OMSettingsConfig {
  observerModel: OMModel;
  observerModelId: string;
  observerAutoModelId: string;
  reflectorModel: OMModel;
  reflectorModelId: string;
  reflectorAutoModelId: string;
  /** Set while the active mode pack has its own memory model, which overrides both roles. */
  packMemoryModelId?: string;
  observationThreshold: number;
  reflectionThreshold: number;
  cavemanObservations: boolean;
  observeAttachments: 'auto' | boolean;
}

export interface OMSettingsCallbacks {
  onObserverModelChange: (model: ModelItem) => void | Promise<void>;
  onObserverAuto: () => void | Promise<void>;
  onReflectorModelChange: (model: ModelItem) => void | Promise<void>;
  onReflectorAuto: () => void | Promise<void>;
  onObservationThresholdChange: (value: number) => void;
  onReflectionThresholdChange: (value: number) => void;
  onCavemanObservationsChange: (enabled: boolean) => void;
  onObserveAttachmentsChange: (value: 'auto' | boolean) => void | Promise<void>;
  onClose: () => void;
}

const AUTO_MODEL_ID = '__auto__';

class OMModelSubmenu extends Container implements Focusable {
  private readonly selector: ModelSelectorComponent;
  private _focused = false;

  get focused(): boolean {
    return this._focused;
  }

  set focused(value: boolean) {
    this._focused = value;
    this.selector.focused = value;
  }

  constructor(args: {
    model: OMModel;
    effectiveModelId: string;
    models: ModelItem[];
    onAuto: () => void | Promise<void>;
    onModel: (model: ModelItem) => void | Promise<void>;
    onDone: (value?: string) => void;
    tui: TUI;
    title: string;
  }) {
    super();
    const autoModel: ModelItem = {
      id: AUTO_MODEL_ID,
      provider: 'auto',
      modelName: 'auto',
      displayName: `Auto (${getShortModelName(args.effectiveModelId)})`,
      hasApiKey: true,
      useCount: Number.MAX_SAFE_INTEGER,
    };
    this.selector = new ModelSelectorComponent({
      tui: args.tui,
      models: [autoModel, ...args.models],
      currentModelId: args.model === 'auto' ? AUTO_MODEL_ID : args.model,
      title: args.title,
      onSelect: async model => {
        if (model.id === AUTO_MODEL_ID) {
          await args.onAuto();
          args.onDone(autoModel.displayName);
          return;
        }
        await args.onModel(model);
        args.onDone(getShortModelName(model.id));
      },
      onCancel: () => args.onDone(),
    });
    this.addChild(this.selector);
  }

  handleInput(data: string): void {
    this.selector.handleInput(data);
  }
}

interface BooleanSubmenuLabels {
  onLabel?: string;
  offLabel?: string;
  onDescription?: string;
  offDescription?: string;
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

export class ThresholdSubmenu extends Container implements MenuChrome {
  private input: Input;
  private selectList: MenuList;
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

    // Input for custom value — type a number like 30 for 30k
    this.addChild(new Text(theme.fg('muted', '_k tokens (type a number, e.g. 30 for 30k):'), 0, 0));
    this.input = new TextInput();
    this.addChild(this.input);
    this.addChild(new Spacer(1));

    // Preset list
    this.addChild(new Text(theme.fg('muted', 'Or pick a preset:'), 0, 0));

    const items: SelectItem[] = presets.map(p => ({
      value: String(p),
      label: `${formatTokens(p)} tokens`,
    }));

    this.selectList = new MenuList(items, Math.min(items.length, 8));

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
    this.addChild(new Text(theme.fg('dim', '↓ to pick a preset'), 0, 0));
  }

  /** Typing goes to the token input, not to the preset list. */
  menuFilterTarget(): Filterable | undefined {
    return undefined;
  }

  handleInput(data: string): void {
    if (this.inInputMode) {
      const kb = getKeybindings();

      // Enter — submit the typed value
      if (data === '\r' || data === '\n' || kb.matches(data, 'tui.input.submit')) {
        const parsed = parseTokenInput(this.input.getValue());
        if (parsed) {
          this.onDone(parsed);
        }
        return;
      }

      // Escape
      if (kb.matches(data, 'tui.select.cancel')) {
        this.onBack();
        return;
      }

      // Down arrow — switch to preset list
      if (kb.matches(data, 'tui.select.down')) {
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
// Boolean Submenu
// =============================================================================

class BooleanSubmenu extends MenuList {
  constructor(
    currentValue: boolean,
    onSelect: (value: boolean) => void,
    onBack: () => void,
    labels?: BooleanSubmenuLabels,
  ) {
    const items: SelectItem[] = [
      { value: 'on', label: labels?.onLabel ?? 'On', description: labels?.onDescription ?? '' },
      { value: 'off', label: labels?.offLabel ?? 'Off', description: labels?.offDescription ?? '' },
    ];
    super(items, items.length);

    this.setSelectedIndex(currentValue ? 0 : 1);

    this.onSelect = (item: SelectItem) => {
      onSelect(item.value === 'on');
    };
    this.onCancel = onBack;
  }
}

// =============================================================================
// OM Settings Component
// =============================================================================

export class OMSettingsComponent extends Container implements Focusable, MenuChrome {
  private settingsList: SettingsMenu;

  // Focusable implementation
  private _focused = false;
  get focused(): boolean {
    return this._focused;
  }
  set focused(value: boolean) {
    this._focused = value;
  }

  constructor(config: OMSettingsConfig, callbacks: OMSettingsCallbacks, models: ModelItem[], tui: TUI) {
    super();

    // Build settings items
    const items: SettingItem[] = [
      {
        id: 'observer-model',
        label: 'Observer model',
        description: 'Model used for observing and summarizing message history',
        currentValue: formatModel(config.observerModel, config.observerModelId, config.packMemoryModelId),
        submenu: (_currentValue, done) =>
          new OMModelSubmenu({
            tui,
            models,
            model: config.observerModel,
            effectiveModelId: config.observerAutoModelId,
            title: 'Observer Model',
            onAuto: async () => {
              await callbacks.onObserverAuto();
              config.observerModel = 'auto';
            },
            onModel: async model => {
              await callbacks.onObserverModelChange(model);
              config.observerModel = model.id;
              config.observerModelId = model.id;
            },
            onDone: done,
          }),
      },
      {
        id: 'reflector-model',
        label: 'Reflector model',
        description: 'Model used for compressing observations when they grow too large',
        currentValue: formatModel(config.reflectorModel, config.reflectorModelId, config.packMemoryModelId),
        submenu: (_currentValue, done) =>
          new OMModelSubmenu({
            tui,
            models,
            model: config.reflectorModel,
            effectiveModelId: config.reflectorAutoModelId,
            title: 'Reflector Model',
            onAuto: async () => {
              await callbacks.onReflectorAuto();
              config.reflectorModel = 'auto';
            },
            onModel: async model => {
              await callbacks.onReflectorModelChange(model);
              config.reflectorModel = model.id;
              config.reflectorModelId = model.id;
            },
            onDone: done,
          }),
      },
      {
        id: 'obs-threshold',
        label: 'Messages before observation',
        description: 'Message tokens before the Observer runs. More means a larger message window per observation.',
        currentValue: formatTokens(config.observationThreshold),
        submenu: (_currentValue, done) =>
          new ThresholdSubmenu(
            'Messages Before Observation',
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
        label: 'Observations before reflection',
        description:
          'Accumulated observation tokens before the Reflector compresses them. ' +
          'More means less frequent compression.',
        currentValue: formatTokens(config.reflectionThreshold),
        submenu: (_currentValue, done) =>
          new ThresholdSubmenu(
            'Observations Before Reflection',
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
      {
        id: 'caveman-observations',
        label: 'Caveman observations',
        description:
          'Optional. Use terse caveman-style compression for observations and reflections ' +
          'instead of standard prose. Off by default; turn on if you prefer the more compact style',
        currentValue: config.cavemanObservations ? 'On' : 'Off',
        submenu: (_currentValue, done) =>
          new BooleanSubmenu(
            config.cavemanObservations,
            value => {
              config.cavemanObservations = value;
              callbacks.onCavemanObservationsChange(value);
              done(value ? 'On' : 'Off');
            },
            () => done(),
            {
              onDescription: 'Caveman-style terse compression',
              offDescription: 'Standard prose observations',
            },
          ),
      },
      {
        id: 'observe-attachments',
        label: 'Observe attachments',
        description: 'Forward image and file attachments to the Observer LLM. Auto checks model capabilities to decide',
        currentValue: formatAttachmentValue(config.observeAttachments),
        submenu: (_currentValue, done) => {
          const items: SelectItem[] = [
            { value: 'auto', label: 'Auto', description: 'Use model capabilities to decide' },
            { value: 'on', label: 'On', description: 'Always forward attachments' },
            { value: 'off', label: 'Off', description: 'Drop attachments (placeholder text only)' },
          ];
          const list = new MenuList(items, items.length);
          const currentIndex = config.observeAttachments === 'auto' ? 0 : config.observeAttachments ? 1 : 2;
          list.setSelectedIndex(currentIndex);
          list.onSelect = async (item: SelectItem) => {
            const value: 'auto' | boolean = item.value === 'auto' ? 'auto' : item.value === 'on';
            try {
              await callbacks.onObserveAttachmentsChange(value);
              config.observeAttachments = value;
              done(formatAttachmentValue(value));
            } catch (error) {
              console.error('Failed to update observe attachments setting:', error);
            }
          };
          list.onCancel = () => done();
          return list;
        },
      },
    ];

    this.settingsList = new SettingsMenu(
      items,
      11,
      (_id, _newValue) => {
        // All changes handled via submenu callbacks
      },
      callbacks.onClose,
    );

    this.addChild(this.settingsList);
  }

  /** "observational memory › observer model" while a setting's submenu is open. */
  menuTitle(): string | undefined {
    const open = this.settingsList.openSubmenuLabel();
    return open ? `observational memory › ${lowerFirst(open)}` : undefined;
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

function formatModel(model: OMModel, effectiveModelId: string, packMemoryModelId?: string): string {
  if (packMemoryModelId) return `${getShortModelName(effectiveModelId)} (set by active pack)`;
  return model === 'auto' ? `Auto (${getShortModelName(effectiveModelId)})` : getShortModelName(model);
}

function formatAttachmentValue(value: 'auto' | boolean): string {
  if (value === 'auto') return 'Auto';
  return value ? 'On' : 'Off';
}
