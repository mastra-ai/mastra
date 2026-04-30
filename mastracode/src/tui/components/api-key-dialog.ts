/**
 * API key input dialog component.
 * Shown when a user selects a model that doesn't have an API key configured.
 * Allows entering a key or cancelling to proceed without one.
 */

import { Box, getEditorKeybindings, Spacer, Text } from '@mariozechner/pi-tui';
import type { Focusable } from '@mariozechner/pi-tui';
import { theme } from '../theme.js';
import { MaskedInput } from './masked-input.js';

export interface ApiKeyDialogOptions {
  /** Provider name shown in the title (e.g., "Google") */
  providerName: string;
  /** Environment variable name hint (e.g., "GOOGLE_GENERATIVE_AI_API_KEY") */
  apiKeyEnvVar?: string;
  /** Called with the entered key when the user submits */
  onSubmit: (key: string) => void;
  /** Called when the user cancels */
  onCancel: () => void;
}

export class ApiKeyDialogComponent extends Box implements Focusable {
  private input: MaskedInput;
  private onSubmit: (key: string) => void;
  private onCancel: () => void;

  private _focused = false;
  get focused(): boolean {
    return this._focused;
  }
  set focused(value: boolean) {
    this._focused = value;
    this.input.focused = value;
  }

  constructor(options: ApiKeyDialogOptions) {
    super(2, 1, text => theme.bg('overlayBg', text));

    this.onSubmit = options.onSubmit;
    this.onCancel = options.onCancel;

    // Title
    this.addChild(new Text(theme.bold(theme.fg('accent', `API Key Required`)), 0, 0));
    this.addChild(new Spacer(1));

    // Description
    this.addChild(new Text(theme.fg('text', `Enter an API key for ${options.providerName}:`), 0, 0));
    if (options.apiKeyEnvVar) {
      this.addChild(new Text(theme.fg('dim', `You can also set ${options.apiKeyEnvVar} in your environment.`), 0, 0));
    }
    this.addChild(new Spacer(1));

    // Input
    this.input = new MaskedInput();
    this.input.onSubmit = (value: string) => {
      const trimmed = value.trim();
      if (trimmed) {
        this.onSubmit(trimmed);
      } else {
        this.onCancel();
      }
    };
    this.addChild(this.input);
    this.addChild(new Spacer(1));

    // Hints
    this.addChild(new Text(theme.fg('dim', '  Enter to submit · Esc to cancel'), 0, 0));
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
