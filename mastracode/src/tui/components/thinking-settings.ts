/**
 * Thinking level settings component.
 * Simple selector for reasoning depth levels.
 *
 * Changes apply immediately — Esc closes the panel.
 */

import { Box, SelectList, Spacer, Text } from '@mariozechner/pi-tui';
import type { SelectItem, Focusable } from '@mariozechner/pi-tui';
import { fg, bg, bold, getSelectListTheme } from '../theme.js';

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

export const THINKING_LEVELS = [
  { id: 'off', label: 'Off', providerValue: 'none', description: 'Reasoning disabled' },
  { id: 'low', label: 'Low', providerValue: 'low', description: 'Light reasoning' },
  { id: 'medium', label: 'Medium', providerValue: 'medium', description: 'Balanced reasoning' },
  { id: 'high', label: 'High', providerValue: 'high', description: 'Deep reasoning' },
  { id: 'xhigh', label: 'Very High', providerValue: 'xhigh', description: 'Maximum reasoning depth' },
] as const;

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

  constructor(currentLevel: string, callbacks: ThinkingSettingsCallbacks, showProviderValues = false) {
    super(2, 1, (text: string) => bg('overlayBg', text));

    // Title
    this.addChild(new Text(bold(fg('accent', 'Thinking Level')), 0, 0));
    this.addChild(new Spacer(1));
    this.addChild(new Text(fg('muted', 'Extended thinking / reasoning effort'), 0, 0));
    this.addChild(new Spacer(1));

    // Build items
    const items: SelectItem[] = THINKING_LEVELS.map(level => ({
      value: level.id,
      label: `  ${level.label}${showProviderValues ? ` ${fg('dim', `(${level.providerValue})`)}` : ''}  ${fg('dim', level.description)}`,
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
    this.addChild(new Text(fg('dim', '  Enter to select · Esc to close'), 0, 0));
  }

  handleInput(data: string): void {
    this.selectList.handleInput(data);
  }
}
