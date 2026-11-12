import { Box, getKeybindings, Spacer, Text } from '@earendil-works/pi-tui';
import type { Focusable } from '@earendil-works/pi-tui';
import { sanitizeAnsiForRendering } from '../sanitize-ansi.js';
import { theme } from '../theme.js';

const MAX_OUTPUT_LINES = 40;

export interface BackgroundProcessOutputOptions {
  pid: string;
  command?: string;
  /** Undefined while the process runs. */
  exitCode?: number;
  stdout: string;
  stderr: string;
  onClose: () => void;
}

/** Overlay with a background shell's latest output. */
export class BackgroundProcessOutputComponent extends Box implements Focusable {
  focused = false;
  private readonly onClose: () => void;

  constructor(options: BackgroundProcessOutputOptions) {
    super(2, 1, text => theme.bg('overlayBg', text));
    this.onClose = options.onClose;

    const state = options.exitCode === undefined ? 'running' : `exit ${options.exitCode}`;
    this.addChild(new Text(theme.bold(theme.fg('accent', `$ ${options.command ?? `PID ${options.pid}`}`)), 0, 0));
    this.addChild(new Text(theme.fg('dim', `${state} · PID ${options.pid}`), 0, 0));
    this.addChild(new Spacer(1));

    const output = [options.stdout.trimEnd(), options.stderr.trimEnd() ? `stderr:\n${options.stderr.trimEnd()}` : '']
      .filter(Boolean)
      .join('\n\n');
    const lines = output ? sanitizeAnsiForRendering(output).split('\n') : [];
    const hidden = Math.max(0, lines.length - MAX_OUTPUT_LINES);
    if (hidden > 0) this.addChild(new Text(theme.fg('muted', `… ${hidden} earlier lines`), 0, 0));
    this.addChild(
      new Text(
        lines.length > 0 ? lines.slice(-MAX_OUTPUT_LINES).join('\n') : theme.fg('muted', '(no output yet)'),
        0,
        0,
      ),
    );
    this.addChild(new Spacer(1));
    this.addChild(new Text(theme.fg('dim', 'Esc close'), 0, 0));
  }

  handleInput(data: string): void {
    if (getKeybindings().matches(data, 'tui.select.cancel')) this.onClose();
  }
}
