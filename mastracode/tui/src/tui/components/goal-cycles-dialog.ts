/**
 * Goal max-cycles input dialog.
 * Shows a preconfigured input with the current default value that the user can edit.
 */

import { Box, getKeybindings, Input, Spacer, Text } from '@earendil-works/pi-tui';
import type { Focusable } from '@earendil-works/pi-tui';

import { theme } from '../theme.js';
import type { MenuChrome } from './menu-chrome.js';

export interface GoalCyclesDialogOptions {
  defaultValue: number;
  onSubmit: (maxCycles: number) => void;
  onCancel: () => void;
}

export class GoalCyclesDialogComponent extends Box implements Focusable, MenuChrome {
  private input: Input;
  private onSubmit: (maxCycles: number) => void;
  private onCancel: () => void;

  private _focused = false;
  get focused(): boolean {
    return this._focused;
  }
  set focused(value: boolean) {
    this._focused = value;
    this.input.focused = value;
  }

  constructor(options: GoalCyclesDialogOptions) {
    // Content lines up with menu rows in the prompt slot.
    super(2, 0);

    this.onSubmit = options.onSubmit;
    this.onCancel = options.onCancel;

    this.input = new Input();
    this.input.setValue(String(options.defaultValue));
    this.input.onSubmit = (value: string) => {
      const parsed = parseInt(value.trim(), 10);
      if (isNaN(parsed) || parsed < 1) {
        this.onSubmit(options.defaultValue);
      } else {
        this.onSubmit(parsed);
      }
    };
    this.addChild(this.input);
  }

  menuTitle(): string {
    return 'How many attempts before pausing the goal?';
  }

  handleInput(data: string): void {
    const kb = getKeybindings();
    if (kb.matches(data, 'tui.select.cancel')) {
      this.onCancel();
      return;
    }
    this.input.handleInput(data);
  }
}
