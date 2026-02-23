/**
 * Help overlay — shows slash commands and keyboard shortcuts in a styled panel.
 * Opened by the /help slash command; closed with Escape.
 */

import { Box, Spacer, Text, matchesKey } from '@mariozechner/pi-tui';
import type { Focusable } from '@mariozechner/pi-tui';
import type { SlashCommandMetadata } from '../../utils/slash-command-loader.js';
import { bg, bold, fg } from '../theme.js';

export interface HelpOverlayOptions {
  /** Number of available harness modes (mode commands shown when > 1) */
  modes: number;
  /** User-defined custom slash commands */
  customSlashCommands: SlashCommandMetadata[];
  onClose: () => void;
}

interface HelpEntry {
  key: string;
  description: string;
}

// =============================================================================
// Data
// =============================================================================

function getCommands(modes: number): HelpEntry[] {
  const cmds: HelpEntry[] = [
    { key: '/new', description: 'Start a new thread' },
    { key: '/threads', description: 'Switch between threads' },
    { key: '/thread:tag-dir', description: 'Tag thread with current directory' },
    { key: '/name', description: 'Rename current thread' },
    { key: '/resource', description: 'Show/switch resource ID' },
    { key: '/skills', description: 'List available skills' },
    { key: '/models', description: 'Configure model' },
    { key: '/subagents', description: 'Configure subagent models' },
    { key: '/permissions', description: 'Tool approval permissions' },
    { key: '/settings', description: 'Notifications, YOLO, thinking' },
    { key: '/om', description: 'Configure Observational Memory' },
    { key: '/review', description: 'Review a GitHub pull request' },
    { key: '/cost', description: 'Token usage and costs' },
    { key: '/diff', description: 'Modified files or git diff' },
    { key: '/sandbox', description: 'Manage sandbox allowed paths' },
    { key: '/hooks', description: 'Show/reload configured hooks' },
    { key: '/mcp', description: 'Show/reload MCP connections' },
    { key: '/login', description: 'Login with OAuth provider' },
    { key: '/logout', description: 'Logout from OAuth provider' },
  ];

  if (modes > 1) {
    cmds.push({ key: '/mode', description: 'Switch or list modes' });
  }

  cmds.push(
    { key: '/exit', description: 'Exit' },
    { key: '/help', description: 'Show this help' },
  );

  return cmds;
}

function getShortcuts(modes: number): HelpEntry[] {
  const shortcuts: HelpEntry[] = [
    { key: 'Ctrl+C', description: 'Interrupt / clear input' },
    { key: 'Ctrl+C×2', description: 'Exit (double-tap)' },
    { key: 'Ctrl+D', description: 'Exit (when editor empty)' },
    { key: 'Enter', description: 'While working → steer' },
    { key: 'Ctrl+F', description: 'Queue follow-up message' },
    { key: 'Ctrl+T', description: 'Toggle thinking blocks' },
    { key: 'Ctrl+E', description: 'Expand/collapse tool outputs' },
    { key: 'Ctrl+Y', description: 'Toggle YOLO mode' },
    { key: 'Ctrl+Z', description: 'Undo last clear' },
  ];

  if (modes > 1) {
    shortcuts.push({ key: '⇧Tab', description: 'Cycle agent modes' });
  }

  shortcuts.push(
    { key: '/', description: 'Commands' },
    { key: '!', description: 'Shell' },
  );

  return shortcuts;
}

// =============================================================================
// Rendering
// =============================================================================

function renderSection(title: string, entries: HelpEntry[]): string {
  const maxKeyLen = Math.max(...entries.map(e => e.key.length));
  const lines = entries
    .map(e => `  ${fg('accent', e.key.padEnd(maxKeyLen + 2))}${fg('muted', e.description)}`)
    .join('\n');
  return `${bold(fg('text', title))}\n${lines}`;
}

// =============================================================================
// Component
// =============================================================================

export class HelpOverlayComponent extends Box implements Focusable {
  private _focused = false;
  private onClose: () => void;

  get focused(): boolean {
    return this._focused;
  }
  set focused(value: boolean) {
    this._focused = value;
  }

  constructor(options: HelpOverlayOptions) {
    super(2, 1, (text: string) => bg('overlayBg', text));
    this.onClose = options.onClose;

    // Title
    this.addChild(new Text(bold(fg('accent', 'Help')), 0, 0));
    this.addChild(new Spacer(1));

    // Commands
    this.addChild(new Text(renderSection('Commands', getCommands(options.modes)), 0, 0));

    // Custom commands
    if (options.customSlashCommands.length > 0) {
      this.addChild(new Spacer(1));
      const customEntries = options.customSlashCommands.map(cmd => ({
        key: `//${cmd.name}`,
        description: cmd.description || 'No description',
      }));
      this.addChild(new Text(renderSection('Custom Commands', customEntries), 0, 0));
    }

    // Shell
    this.addChild(new Spacer(1));
    this.addChild(
      new Text(renderSection('Shell', [{ key: '!<cmd>', description: 'Run a shell command' }]), 0, 0),
    );

    // Keyboard shortcuts
    this.addChild(new Spacer(1));
    this.addChild(new Text(renderSection('Keyboard Shortcuts', getShortcuts(options.modes)), 0, 0));

    // Footer
    this.addChild(new Spacer(1));
    this.addChild(new Text(fg('dim', '  Esc to close'), 0, 0));
  }

  handleInput(data: string): void {
    if (matchesKey(data, 'escape')) {
      this.onClose();
    }
  }
}
