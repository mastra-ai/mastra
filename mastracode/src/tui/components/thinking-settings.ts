/**
 * Thinking level settings component.
 * Simple selector for reasoning depth levels.
 *
 * Changes apply immediately — Esc closes the panel.
 */

import { Box, SelectList, Spacer, Text } from '@mariozechner/pi-tui';
import type { SelectItem, Focusable } from '@mariozechner/pi-tui';
import { theme, getSelectListTheme } from '../theme.js';

// =============================================================================
// Types
// =============================================================================

export interface ThinkingSettingsCallbacks {
  onLevelChange: (level: string) => void;
  onClose: () => void;
}

// =============================================================================
// Thinking Levels
// =============================================================================

export type ThinkingLevelId = 'off' | 'low' | 'medium' | 'high' | 'xhigh';

export interface ThinkingLevelOption {
  id: ThinkingLevelId;
  label: string;
  providerValue: 'none' | 'low' | 'medium' | 'high' | 'xhigh';
  description: string;
}

const BASE_THINKING_LEVELS: ThinkingLevelOption[] = [
  { id: 'off', label: 'Off', providerValue: 'none', description: 'Reasoning disabled' },
  { id: 'low', label: 'Low', providerValue: 'low', description: 'Light reasoning' },
  { id: 'medium', label: 'Medium', providerValue: 'medium', description: 'Balanced reasoning' },
  { id: 'high', label: 'High', providerValue: 'high', description: 'Deep reasoning' },
  { id: 'xhigh', label: 'Very High', providerValue: 'xhigh', description: 'Maximum reasoning depth' },
];

function isOpenAIModel(modelId: string): boolean {
  return modelId.startsWith('openai/');
}

export function getThinkingLevelsForModel(modelId: string): ThinkingLevelOption[] {
  if (!isOpenAIModel(modelId)) {
    return [...BASE_THINKING_LEVELS];
  }

  return BASE_THINKING_LEVELS.map(level => ({
    ...level,
    label: level.providerValue,
  }));
}

export const THINKING_LEVELS = getThinkingLevelsForModel('');

export function getThinkingLevelForModel(modelId: string, levelId: string): ThinkingLevelOption {
  return (
    getThinkingLevelsForModel(modelId).find(level => level.id === levelId) ?? getThinkingLevelsForModel(modelId)[0]!
  );
}

// =============================================================================
// Thinking Settings Component
// =============================================================================

export class ThinkingSettingsComponent extends Box implements Focusable {
  private selectList: SelectList;

  // Focusable implementation
  private _focused = false;
  get focused(): boolean {
    return this._focused;
  }
  set focused(value: boolean) {
    this._focused = value;
  }

  constructor(currentLevel: string, callbacks: ThinkingSettingsCallbacks) {
    super(2, 1, (text: string) => theme.bg('overlayBg', text));

    // Title
    this.addChild(new Text(theme.bold(theme.fg('accent', 'Thinking Level')), 0, 0));
    this.addChild(new Spacer(1));
    this.addChild(new Text(theme.fg('muted', 'Extended thinking for Anthropic models'), 0, 0));
    this.addChild(new Spacer(1));

    // Build items
    const items: SelectItem[] = THINKING_LEVELS.map(level => ({
      value: level.id,
      label: `  ${level.label}  ${theme.fg('dim', level.description)}`,
    }));

    this.selectList = new SelectList(items, items.length, getSelectListTheme());

    // Pre-select current level
    const currentIndex = THINKING_LEVELS.findIndex(l => l.id === currentLevel);
    if (currentIndex !== -1) {
      this.selectList.setSelectedIndex(currentIndex);
    }

    this.selectList.onSelect = (item: SelectItem) => {
      callbacks.onLevelChange(item.value);
      callbacks.onClose();
    };
    this.selectList.onCancel = callbacks.onClose;

    this.addChild(this.selectList);
    this.addChild(new Spacer(1));
    this.addChild(new Text(theme.fg('dim', '  Enter to select · Esc to close'), 0, 0));
  }

  handleInput(data: string): void {
    this.selectList.handleInput(data);
  }
}
