/**
 * Thinking level settings component.
 * Simple selector for extended thinking budget levels (Anthropic models).
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

export const THINKING_LEVELS = [
  { id: 'off', label: 'Off', description: 'No extended thinking' },
  { id: 'minimal', label: 'Minimal', description: '~1k budget tokens' },
  { id: 'low', label: 'Low', description: '~4k budget tokens' },
  { id: 'medium', label: 'Medium', description: '~10k budget tokens' },
  { id: 'high', label: 'High', description: '~32k budget tokens' },
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
