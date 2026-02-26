/**
 * Help text builder — generates the inline help content shown by /help.
 */

import type { SlashCommandMetadata } from '../../utils/slash-command-loader.js';

export interface HelpTextOptions {
  /** Number of available harness modes (mode commands shown when > 1) */
  modes: number;
  /** User-defined custom slash commands */
  customSlashCommands: SlashCommandMetadata[];
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
    { key: '/models:pack', description: 'Switch model pack' },
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
    { key: '/setup', description: 'Run the setup wizard' },
    { key: '/theme', description: 'Switch color theme (auto/dark/light)' },
  ];

  if (modes > 1) {
    cmds.push({ key: '/mode', description: 'Switch or list modes' });
  }

  cmds.push({ key: '/exit', description: 'Exit' }, { key: '/help', description: 'Show this help' });

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
    shortcuts.push({ key: '⇧+Tab', description: 'Cycle agent modes' });
  }

  shortcuts.push({ key: '/', description: 'Commands' }, { key: '!', description: 'Shell' });

  return shortcuts;
}

// =============================================================================
// Rendering
// =============================================================================

function renderSection(title: string, entries: HelpEntry[]): string {
  const maxKeyLen = Math.max(...entries.map(e => e.key.length));
  const lines = entries.map(e => `  ${e.key.padEnd(maxKeyLen + 2)}${e.description}`).join('\n');
  return `${title}\n${lines}`;
}

/**
 * Build the full help text as a plain string for inline display via showInfo().
 */
export function buildHelpText(options: HelpTextOptions): string {
  const sections: string[] = [];

  sections.push(renderSection('Commands', getCommands(options.modes)));

  if (options.customSlashCommands.length > 0) {
    const customEntries = options.customSlashCommands.map(cmd => ({
      key: `//${cmd.name}`,
      description: cmd.description || 'No description',
    }));
    sections.push(renderSection('Custom Commands', customEntries));
  }

  sections.push(renderSection('Shell', [{ key: '!<cmd>', description: 'Run a shell command' }]));

  sections.push(renderSection('Keyboard Shortcuts', getShortcuts(options.modes)));

  return sections.join('\n\n');
}
