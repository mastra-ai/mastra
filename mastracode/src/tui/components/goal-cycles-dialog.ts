/**
 * Goal max-cycles input dialog.
 * Shows a preconfigured input with the current default value that the user can edit.
 */

import { Box, getEditorKeybindings, Input, Spacer, Text } from '@mariozechner/pi-tui';
import type { Focusable } from '@mariozechner/pi-tui';

import { theme } from '../theme.js';

export interface GoalCyclesDialogOptions {
  defaultValue: number;
  onSubmit: (maxCycles: number) => void;
  onCancel: () => void;
}

export class GoalCyclesDialogComponent extends Box implements Focusable {
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
    super(2, 1, text => theme.bg('overlayBg', text));

    this.onSubmit = options.onSubmit;
    this.onCancel = options.onCancel;

    this.addChild(new Text(theme.bold(theme.fg('accent', 'Max Attempts')), 0, 0));
    this.addChild(new Spacer(1));
    this.addChild(new Text(theme.fg('text', 'How many attempts before pausing the goal?'), 0, 0));
    this.addChild(new Spacer(1));

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
    this.addChild(new Spacer(1));
    this.addChild(new Text(theme.fg('dim', '  Enter to confirm · Esc to cancel'), 0, 0));
  }

  handleInput(data: string): void {
    const kb = getEditorKeybindings();
    if (kb.matches(data, 'selectCancel')) {
      this.onCancel();
      return;
    }
    this.input.handleInput(data);
  }
}
