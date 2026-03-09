/**
 * Login dialog component - handles OAuth login flow UI
 */

import { exec } from 'node:child_process';
import { Box, Container, getEditorKeybindings, Input, Spacer, Text } from '@mariozechner/pi-tui';
import type { Focusable, TUI } from '@mariozechner/pi-tui';
import { getOAuthProviders } from '../../auth/index.js';
import { theme } from '../theme.js';

export class LoginDialogComponent extends Box implements Focusable {
  private contentContainer: Container;
  private input: Input;
  private tui: TUI;
  private abortController = new AbortController();
  private inputResolver?: (value: string) => void;
  private inputRejecter?: (error: Error) => void;

  // Focusable implementation
  private _focused = false;
  get focused(): boolean {
    return this._focused;
  }
  set focused(value: boolean) {
    this._focused = value;
    this.input.focused = value;
  }

  constructor(
    tui: TUI,
    providerId: string,
    private onComplete: (success: boolean, message?: string) => void,
  ) {
    // Box with padding and background
    super(2, 1, text => theme.bg('overlayBg', text));
    this.tui = tui;

    const providerInfo = getOAuthProviders().find(p => p.id === providerId);
    const providerName = providerInfo?.name || providerId;

    // Title
    this.addChild(new Text(theme.fg('warning', `Login to ${providerName}`)));
    this.addChild(new Spacer(1));

    // Dynamic content area
    this.contentContainer = new Container();
    this.addChild(this.contentContainer);

    // Input (always present, used when needed)
    this.input = new Input();
    this.input.onSubmit = () => {
      if (this.inputResolver) {
        this.inputResolver(this.input.getValue());
        this.inputResolver = undefined;
        this.inputRejecter = undefined;
      }
    };
    this.input.onEscape = () => {
      this.cancel();
    };
  }

  get signal(): AbortSignal {
    return this.abortController.signal;
  }

  private cancel(): void {
    try {
      this.abortController.abort();
    } catch {}
    if (this.inputRejecter) {
      this.inputRejecter(new Error('Login cancelled'));
      this.inputResolver = undefined;
      this.inputRejecter = undefined;
    }
    this.onComplete(false, 'Login cancelled');
  }

  /**
   * Called by onAuth callback - show URL and optional instructions
   */
  showAuth(url: string, instructions?: string): void {
    this.contentContainer.clear();

    this.contentContainer.addChild(new Text(theme.fg('accent', url)));

    const clickHint = process.platform === 'darwin' ? 'Cmd+click to open' : 'Ctrl+click to open';
    const hyperlink = `\x1b]8;;${url}\x07${clickHint}\x1b]8;;\x07`;
    this.contentContainer.addChild(new Text(theme.fg('muted', hyperlink)));

    if (instructions) {
      this.contentContainer.addChild(new Spacer(1));
      this.contentContainer.addChild(new Text(theme.fg('warning', instructions)));
    }

    // Try to open browser
    const openCmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    exec(`${openCmd} "${url}"`);

    this.tui.requestRender();
  }

  /**
   * Called by onPrompt callback - show prompt and wait for input
   */
  showPrompt(message: string, placeholder?: string): Promise<string> {
    this.contentContainer.addChild(new Spacer(1));
    this.contentContainer.addChild(new Text(theme.fg('text', message)));
    if (placeholder) {
      this.contentContainer.addChild(new Text(theme.fg('muted', `e.g., ${placeholder}`)));
    }
    this.contentContainer.addChild(this.input);
    this.contentContainer.addChild(new Text(theme.fg('muted', '(Escape to cancel, Enter to submit)')));

    this.input.setValue('');
    this.tui.requestRender();

    return new Promise((resolve, reject) => {
      this.inputResolver = resolve;
      this.inputRejecter = reject;
    });
  }

  /**
   * Show progress message
   */
  showProgress(message: string): void {
    this.contentContainer.addChild(new Text(theme.fg('muted', message)));
    this.tui.requestRender();
  }

  handleInput(data: string): void {
    const kb = getEditorKeybindings();

    if (kb.matches(data, 'selectCancel')) {
      this.cancel();
      return;
    }

    // Pass to input
    this.input.handleInput(data);
  }
}
