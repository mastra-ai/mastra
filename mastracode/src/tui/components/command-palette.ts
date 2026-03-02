/**
 * Command palette component — fuzzy-searchable overlay for all slash commands,
 * keyboard shortcuts, and custom commands.
 *
 * Triggered by Ctrl+K. Replaces the static /help text with an interactive,
 * filterable command list.
 */

import { Text } from '@mariozechner/pi-tui';
import type { TUI } from '@mariozechner/pi-tui';
import { SearchableListOverlay } from './searchable-list-overlay.js';
import { theme } from '../theme.js';
import type { SlashCommandMetadata } from '../../utils/slash-command-loader.js';

// =============================================================================
// Types
// =============================================================================

export type CommandCategory = 'command' | 'shortcut' | 'custom';

export interface PaletteItem {
  /** Display label (e.g. "/new", "Ctrl+T") */
  label: string;
  /** Short description */
  description: string;
  /** Category for visual grouping */
  category: CommandCategory;
  /**
   * Slash command string to execute (e.g. "/new", "/threads").
   * Shortcuts don't have this — they're displayed but not executable from the palette.
   */
  command?: string;
}

export interface CommandPaletteOptions {
  tui: TUI;
  /** Number of available harness modes */
  modes: number;
  /** User-defined custom slash commands */
  customSlashCommands: SlashCommandMetadata[];
  /** Called when a command is selected for execution */
  onSelect: (item: PaletteItem) => void;
  /** Called when the palette is dismissed */
  onCancel: () => void;
}

// =============================================================================
// Helpers
// =============================================================================

function buildPaletteItems(modes: number, customSlashCommands: SlashCommandMetadata[]): PaletteItem[] {
  const items: PaletteItem[] = [];

  // -- Slash commands ---------------------------------------------------------
  const commands: Array<{ label: string; description: string; command: string }> = [
    { label: '/new', description: 'Start a new thread', command: '/new' },
    { label: '/threads', description: 'Switch between threads', command: '/threads' },
    { label: '/thread:tag-dir', description: 'Tag thread with current directory', command: '/thread:tag-dir' },
    { label: '/name', description: 'Rename current thread', command: '/name' },
    { label: '/resource', description: 'Show/switch resource ID', command: '/resource' },
    { label: '/skills', description: 'List available skills', command: '/skills' },
    { label: '/models', description: 'Configure model', command: '/models' },
    { label: '/models:pack', description: 'Switch model pack', command: '/models:pack' },
    { label: '/subagents', description: 'Configure subagent models', command: '/subagents' },
    { label: '/permissions', description: 'Tool approval permissions', command: '/permissions' },
    { label: '/settings', description: 'Notifications, YOLO, thinking', command: '/settings' },
    { label: '/om', description: 'Configure Observational Memory', command: '/om' },
    { label: '/review', description: 'Review a GitHub pull request', command: '/review' },
    { label: '/cost', description: 'Token usage and costs', command: '/cost' },
    { label: '/diff', description: 'Modified files or git diff', command: '/diff' },
    { label: '/sandbox', description: 'Manage sandbox allowed paths', command: '/sandbox' },
    { label: '/hooks', description: 'Show/reload configured hooks', command: '/hooks' },
    { label: '/mcp', description: 'Show/reload MCP connections', command: '/mcp' },
    { label: '/login', description: 'Login with OAuth provider', command: '/login' },
    { label: '/logout', description: 'Logout from OAuth provider', command: '/logout' },
    { label: '/setup', description: 'Run the setup wizard', command: '/setup' },
    { label: '/theme', description: 'Switch color theme', command: '/theme' },
    { label: '/yolo', description: 'Toggle YOLO mode', command: '/yolo' },
  ];

  if (modes > 1) {
    commands.push({ label: '/mode', description: 'Switch or list modes', command: '/mode' });
  }

  commands.push(
    { label: '/help', description: 'Show full help text', command: '/help' },
    { label: '/exit', description: 'Exit', command: '/exit' },
  );

  for (const cmd of commands) {
    items.push({ label: cmd.label, description: cmd.description, category: 'command', command: cmd.command });
  }

  // -- Custom commands --------------------------------------------------------
  for (const cmd of customSlashCommands) {
    items.push({
      label: `//${cmd.name}`,
      description: cmd.description || 'Custom command',
      category: 'custom',
      command: `//${cmd.name}`,
    });
  }

  // -- Keyboard shortcuts (display only, not executable from palette) ---------
  const shortcuts: Array<{ label: string; description: string }> = [
    { label: 'Ctrl+C', description: 'Interrupt / clear input' },
    { label: 'Ctrl+D', description: 'Exit (when editor empty)' },
    { label: 'Ctrl+F', description: 'Queue follow-up message' },
    { label: 'Ctrl+T', description: 'Toggle thinking blocks' },
    { label: 'Ctrl+E', description: 'Expand/collapse tool outputs' },
    { label: 'Ctrl+Y', description: 'Toggle YOLO mode' },
    { label: 'Ctrl+Z', description: 'Undo last clear' },
    { label: 'Ctrl+K', description: 'Command palette' },
  ];

  if (modes > 1) {
    shortcuts.push({ label: 'Shift+Tab', description: 'Cycle agent modes' });
  }

  for (const s of shortcuts) {
    items.push({ label: s.label, description: s.description, category: 'shortcut' });
  }

  return items;
}

// =============================================================================
// CommandPaletteComponent
// =============================================================================

export class CommandPaletteComponent extends SearchableListOverlay<PaletteItem> {
  private onSelectCallback: (item: PaletteItem) => void;
  private onCancelCallback: () => void;

  constructor(options: CommandPaletteOptions) {
    const items = buildPaletteItems(options.modes, options.customSlashCommands);

    super(
      {
        tui: options.tui,
        title: 'Command Palette',
        hint: 'Type to filter • ↑↓ navigate • Enter run • Esc close',
      },
      items,
    );

    this.onSelectCallback = options.onSelect;
    this.onCancelCallback = options.onCancel;
  }

  // ---------------------------------------------------------------------------
  // SearchableListOverlay implementation
  // ---------------------------------------------------------------------------

  protected getSearchableText(item: PaletteItem): string {
    return `${item.label} ${item.description} ${item.category}`;
  }

  protected renderItem(item: PaletteItem, _index: number, isSelected: boolean): Text[] {
    const categoryBadge = this.getCategoryBadge(item.category);
    const pointer = isSelected ? theme.fg('accent', '→ ') : '  ';
    const label = isSelected ? theme.fg('accent', item.label) : theme.fg('text', item.label);
    const desc = theme.fg('muted', item.description);

    const line = `${pointer}${categoryBadge} ${label}  ${desc}`;
    return [new Text(line, 0, 0)];
  }

  protected onSelect(item: PaletteItem): void {
    this.onSelectCallback(item);
  }

  protected onCancel(): void {
    this.onCancelCallback();
  }

  protected getEmptyMessage(): string {
    return 'No matching commands';
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private getCategoryBadge(category: CommandCategory): string {
    switch (category) {
      case 'command':
        return theme.fg('accent', '⌘');
      case 'custom':
        return theme.fg('warning', '✦');
      case 'shortcut':
        return theme.fg('dim', '⌨');
    }
  }
}
