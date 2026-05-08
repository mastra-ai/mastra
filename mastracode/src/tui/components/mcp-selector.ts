/**
 * MCP server selector component for managing MCP server connections.
 * Uses pi-tui overlay pattern with navigation.
 */

import { Box, Container, getEditorKeybindings, Spacer, Text } from '@mariozechner/pi-tui';
import type { Focusable, TUI } from '@mariozechner/pi-tui';
import chalk from 'chalk';
import type { McpServerStatus, McpSkippedServer } from '../../mcp/types.js';
import { theme } from '../theme.js';

// =============================================================================
// Types
// =============================================================================

export interface McpSelectorOptions {
  /** TUI instance for rendering */
  tui: TUI;
  /** Server statuses */
  statuses: McpServerStatus[];
  /** Skipped servers */
  skipped: McpSkippedServer[];
  /** Config file paths for display */
  configPaths: { project: string; global: string; claude: string };
  /** Get current statuses (for polling during initial connect) */
  getStatuses: () => { statuses: McpServerStatus[]; skipped: McpSkippedServer[] };
  /** Callback to reload all servers — should return fresh statuses/skipped */
  onReloadAll: () => Promise<{ statuses: McpServerStatus[]; skipped: McpSkippedServer[] }>;
  /** Callback to reconnect a single server by name — returns updated status */
  onReconnectServer: (name: string) => Promise<McpServerStatus>;
  /** Get captured stderr logs for a server */
  getServerLogs: (name: string) => string[];
  /** Show an info message in the chat area */
  showInfo: (msg: string) => void;
  /** Callback when selector is dismissed */
  onClose: () => void;
}

// =============================================================================
// Sub-menu actions
// =============================================================================

interface ServerAction {
  label: string;
  key: string;
}

const CONNECTED_ACTIONS: ServerAction[] = [
  { label: 'View tools', key: 'tools' },
  { label: 'View logs', key: 'logs' },
  { label: 'Reconnect', key: 'reconnect' },
];

const FAILED_ACTIONS: ServerAction[] = [
  { label: 'View error', key: 'error' },
  { label: 'View logs', key: 'logs' },
  { label: 'Reconnect', key: 'reconnect' },
];

const CONNECTING_ACTIONS: ServerAction[] = [{ label: 'Waiting for connection...', key: 'none' }];

// =============================================================================
// McpSelectorComponent
// =============================================================================

export class McpSelectorComponent extends Box implements Focusable {
  private listContainer!: Container;
  private statuses: McpServerStatus[];
  private skipped: McpSkippedServer[];
  private selectedIndex = 0;
  private getStatusesCallback: McpSelectorOptions['getStatuses'];
  private onReloadAllCallback: McpSelectorOptions['onReloadAll'];
  private onReconnectServerCallback: McpSelectorOptions['onReconnectServer'];
  private getServerLogsCallback: McpSelectorOptions['getServerLogs'];
  private showInfoCallback: McpSelectorOptions['showInfo'];
  private onCloseCallback: () => void;
  private tui: TUI;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  // Sub-menu state
  private subMenuOpen = false;
  private subMenuIndex = 0;
  private subMenuActions: ServerAction[] = [];

  // Detail view state (tool list / error display)
  private _detailView = false;

  // Loading state during reload
  private _reloading = false;

  // Focusable implementation
  private _focused = false;
  get focused(): boolean {
    return this._focused;
  }
  set focused(value: boolean) {
    this._focused = value;
  }

  constructor(options: McpSelectorOptions) {
    super(2, 1, text => theme.bg('overlayBg', text));

    this.tui = options.tui;
    this.statuses = options.statuses;
    this.skipped = options.skipped;
    this.getStatusesCallback = options.getStatuses;
    this.onReloadAllCallback = options.onReloadAll;
    this.onReconnectServerCallback = options.onReconnectServer;
    this.getServerLogsCallback = options.getServerLogs;
    this.showInfoCallback = options.showInfo;
    this.onCloseCallback = options.onClose;

    this.buildUI();
    this.startPollingIfNeeded();
  }

  private buildUI(): void {
    // Title
    const titleText = chalk.bgHex('#16c858').white.bold(' Manage MCP servers ');
    this.addChild(new Text(titleText, 0, 0));
    this.addChild(new Spacer(1));

    // List container (includes server count + server list)
    this.listContainer = new Container();
    this.addChild(this.listContainer);

    // Footer spacer + hints
    this.addChild(new Spacer(1));
    this.addChild(new Text(theme.fg('muted', '↑↓ navigate • Enter select • r reload all • Esc close'), 0, 0));

    // Initial render
    this.updateList();
  }

  private getTotalItems(): number {
    return this.statuses.length + this.skipped.length;
  }

  private updateList(): void {
    this.listContainer.clear();

    // Server count line
    const total = this.getTotalItems();
    const countLabel = this._reloading
      ? `${total} server${total !== 1 ? 's' : ''} — reconnecting...`
      : `${total} server${total !== 1 ? 's' : ''}`;
    this.listContainer.addChild(new Text(theme.fg(this._reloading ? 'warning' : 'muted', countLabel), 0, 0));
    this.listContainer.addChild(new Spacer(1));

    const totalItems = this.getTotalItems();

    for (let i = 0; i < this.statuses.length; i++) {
      const status = this.statuses[i]!;
      const isSelected = i === this.selectedIndex && !this.subMenuOpen;

      let icon: string;
      let stateText: string;
      if (this._reloading) {
        icon = theme.fg('warning', '⟳');
        stateText = theme.fg('warning', 'reconnecting...');
      } else if (status.connecting) {
        icon = theme.fg('warning', '⟳');
        stateText = theme.fg('warning', 'connecting...');
      } else if (status.connected) {
        icon = theme.fg('success', '✔');
        stateText = theme.fg('success', 'connected');
      } else {
        icon = theme.fg('error', '✗');
        stateText = theme.fg('error', 'failed');
      }

      const cursor = isSelected ? theme.fg('accent', '› ') : '  ';
      const name = isSelected ? theme.bold(theme.fg('accent', status.name)) : status.name;
      const transport = theme.fg('muted', `[${status.transport}]`);
      const toolInfo =
        !this._reloading && status.toolCount > 0 ? theme.fg('muted', ` · ${status.toolCount} tools`) : '';

      this.listContainer.addChild(new Text(`${cursor}${icon} ${name} ${transport} ${stateText}${toolInfo}`, 0, 0));

      // Sub-menu for this server
      if (i === this.selectedIndex && this.subMenuOpen) {
        for (let j = 0; j < this.subMenuActions.length; j++) {
          const action = this.subMenuActions[j]!;
          const actionSelected = j === this.subMenuIndex;
          const actionCursor = actionSelected ? theme.fg('accent', '  › ') : '    ';
          const actionText = actionSelected
            ? theme.bold(theme.fg('accent', action.label))
            : theme.fg('muted', action.label);
          this.listContainer.addChild(new Text(`${actionCursor}${actionText}`, 0, 0));
        }
      }
    }

    // Skipped servers
    if (this.skipped.length > 0) {
      this.listContainer.addChild(new Spacer(1));
      this.listContainer.addChild(new Text(theme.fg('muted', 'Skipped:'), 0, 0));
      for (let i = 0; i < this.skipped.length; i++) {
        const s = this.skipped[i]!;
        const idx = this.statuses.length + i;
        const isSelected = idx === this.selectedIndex && !this.subMenuOpen;
        const cursor = isSelected ? theme.fg('accent', '› ') : '  ';
        const name = isSelected ? theme.bold(theme.fg('accent', s.name)) : s.name;
        this.listContainer.addChild(
          new Text(`${cursor}${theme.fg('warning', '⊘')} ${name} — ${theme.fg('muted', s.reason)}`, 0, 0),
        );
      }
    }

    // Empty state
    if (totalItems === 0) {
      this.listContainer.addChild(new Text(theme.fg('muted', 'No MCP servers configured'), 0, 0));
    }

    this.tui.requestRender();
  }

  private startPollingIfNeeded(): void {
    if (this.pollTimer) return;
    const hasConnecting = this.statuses.some(s => s.connecting);
    if (!hasConnecting) return;

    this.pollTimer = setInterval(() => {
      // Don't refresh while in a detail view or mid-reload
      if (this._detailView || this._reloading) return;

      const fresh = this.getStatusesCallback();
      this.statuses = fresh.statuses;
      this.skipped = fresh.skipped;

      // Clamp index
      const total = this.getTotalItems();
      if (this.selectedIndex >= total) {
        this.selectedIndex = Math.max(0, total - 1);
      }

      this.updateList();

      // Stop polling when nothing is connecting anymore
      if (!this.statuses.some(s => s.connecting)) {
        this.stopPolling();
      }
    }, 500);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /** Clean up resources when component is removed. */
  dispose(): void {
    this.stopPolling();
  }

  handleInput(data: string): void {
    const kb = getEditorKeybindings();

    // During reload, only allow closing the selector
    if (this._reloading) {
      if (kb.matches(data, 'selectCancel')) {
        this.onCloseCallback();
      }
      return;
    }
    const totalItems = this.getTotalItems();

    // Detail view (tool list or error) — Esc goes back to server list
    if (this._detailView) {
      if (kb.matches(data, 'selectCancel')) {
        this._detailView = false;
        this.updateList();
      }
      return;
    }

    if (this.subMenuOpen) {
      this.handleSubMenuInput(data, kb);
      return;
    }

    // Up arrow
    if (kb.matches(data, 'selectUp')) {
      if (totalItems === 0) return;
      this.selectedIndex = this.selectedIndex === 0 ? totalItems - 1 : this.selectedIndex - 1;
      this.updateList();
    }
    // Down arrow
    else if (kb.matches(data, 'selectDown')) {
      if (totalItems === 0) return;
      this.selectedIndex = this.selectedIndex === totalItems - 1 ? 0 : this.selectedIndex + 1;
      this.updateList();
    }
    // Enter — open sub-menu for the selected server
    else if (kb.matches(data, 'selectConfirm')) {
      if (this.selectedIndex < this.statuses.length) {
        this.openSubMenu();
      }
      // Skipped servers have no sub-menu actions
    }
    // 'r' — reload all servers
    else if (data === 'r') {
      this.doReloadAll();
    }
    // Escape or Ctrl+C
    else if (kb.matches(data, 'selectCancel')) {
      this.stopPolling();
      this.onCloseCallback();
    }
  }

  private openSubMenu(): void {
    const status = this.statuses[this.selectedIndex];
    if (!status) return;

    if (status.connecting) {
      this.subMenuActions = CONNECTING_ACTIONS;
    } else if (status.connected) {
      this.subMenuActions = CONNECTED_ACTIONS;
    } else {
      this.subMenuActions = FAILED_ACTIONS;
    }

    this.subMenuOpen = true;
    this.subMenuIndex = 0;
    this.updateList();
  }

  private handleSubMenuInput(data: string, kb: ReturnType<typeof getEditorKeybindings>): void {
    // Up arrow
    if (kb.matches(data, 'selectUp')) {
      this.subMenuIndex = this.subMenuIndex === 0 ? this.subMenuActions.length - 1 : this.subMenuIndex - 1;
      this.updateList();
    }
    // Down arrow
    else if (kb.matches(data, 'selectDown')) {
      this.subMenuIndex = this.subMenuIndex === this.subMenuActions.length - 1 ? 0 : this.subMenuIndex + 1;
      this.updateList();
    }
    // Enter — execute action
    else if (kb.matches(data, 'selectConfirm')) {
      const action = this.subMenuActions[this.subMenuIndex];
      if (!action || action.key === 'none') return;
      this.executeAction(action.key);
    }
    // Escape — close sub-menu
    else if (kb.matches(data, 'selectCancel')) {
      this.subMenuOpen = false;
      this.updateList();
    }
  }

  private executeAction(actionKey: string): void {
    const status = this.statuses[this.selectedIndex];
    if (!status) return;

    switch (actionKey) {
      case 'tools': {
        this.subMenuOpen = false;
        this.showToolList(status);
        break;
      }
      case 'error': {
        this.subMenuOpen = false;
        this.showError(status);
        break;
      }
      case 'logs': {
        this.subMenuOpen = false;
        this.showLogs(status);
        break;
      }
      case 'reconnect': {
        this.subMenuOpen = false;
        this.doReconnectServer(status);
        break;
      }
    }
  }

  private doReloadAll(): void {
    this._reloading = true;
    this.updateList();

    this.onReloadAllCallback()
      .then((result: { statuses: McpServerStatus[]; skipped: McpSkippedServer[] }) => {
        this.statuses = result.statuses;
        this.skipped = result.skipped;
        // Clamp selected index in case server count changed
        const total = this.getTotalItems();
        if (this.selectedIndex >= total) {
          this.selectedIndex = Math.max(0, total - 1);
        }
        const connected = result.statuses.filter(s => s.connected);
        const totalTools = connected.reduce((sum, s) => sum + s.toolCount, 0);
        this.showInfoCallback(`MCP: Reloaded. ${connected.length} server(s) connected, ${totalTools} tool(s).`);
        for (const s of result.statuses.filter(s => !s.connected)) {
          this.showInfoCallback(`MCP: Failed to connect to "${s.name}": ${s.error ?? 'Unknown error'}`);
        }
      })
      .catch(() => {
        this.showInfoCallback('MCP: Reload failed. Retrying may help.');
      })
      .finally(() => {
        this._reloading = false;
        this.updateList();
      });
  }

  private doReconnectServer(status: McpServerStatus): void {
    if (status.connecting) return;
    const name = status.name;

    // Mark this server as connecting
    const idx = this.statuses.findIndex(s => s.name === name);
    if (idx >= 0) {
      this.statuses[idx] = {
        name,
        connected: false,
        connecting: true,
        toolCount: 0,
        toolNames: [],
        transport: status.transport,
      };
    }
    this.updateList();

    this.onReconnectServerCallback(name)
      .then((updated: McpServerStatus) => {
        // If a reload-all started, ignore stale reconnect results
        if (this._reloading) return;
        const i = this.statuses.findIndex(s => s.name === name);
        if (i >= 0) {
          this.statuses[i] = updated;
        }
        if (updated.connected) {
          this.showInfoCallback(`MCP: Reconnected "${name}" — ${updated.toolCount} tool(s)`);
        } else {
          this.showInfoCallback(`MCP: Failed to reconnect "${name}": ${updated.error ?? 'Unknown error'}`);
        }
      })
      .catch((err: unknown) => {
        if (this._reloading) return;
        const errMsg = err instanceof Error ? err.message : String(err);
        const i = this.statuses.findIndex(s => s.name === name);
        if (i >= 0) {
          this.statuses[i] = {
            name,
            connected: false,
            connecting: false,
            toolCount: 0,
            toolNames: [],
            transport: status.transport,
            error: errMsg,
          };
        }
        this.showInfoCallback(`MCP: Failed to reconnect "${name}": ${errMsg}`);
      })
      .finally(() => {
        if (!this._reloading) {
          this.updateList();
        }
      });
  }

  private showToolList(status: McpServerStatus): void {
    this.listContainer.clear();

    this.listContainer.addChild(
      new Text(theme.bold(`Tools for ${status.name}`) + theme.fg('muted', ` (${status.toolCount})`), 0, 0),
    );
    this.listContainer.addChild(new Spacer(1));

    if (status.toolNames.length === 0) {
      this.listContainer.addChild(new Text(theme.fg('muted', 'No tools available'), 0, 0));
    } else {
      for (const toolName of status.toolNames) {
        this.listContainer.addChild(new Text(`  ${theme.fg('muted', '–')} ${toolName}`, 0, 0));
      }
    }

    this.listContainer.addChild(new Spacer(1));
    this.listContainer.addChild(new Text(theme.fg('muted', 'Press Esc to go back'), 0, 0));

    this._detailView = true;
    this.tui.requestRender();
  }

  private showError(status: McpServerStatus): void {
    this.listContainer.clear();

    this.listContainer.addChild(new Text(theme.bold(`Error for ${status.name}`), 0, 0));
    this.listContainer.addChild(new Spacer(1));
    this.listContainer.addChild(new Text(theme.fg('error', status.error ?? 'Unknown error'), 0, 0));
    this.listContainer.addChild(new Spacer(1));
    this.listContainer.addChild(new Text(theme.fg('muted', 'Press Esc to go back'), 0, 0));

    this._detailView = true;
    this.tui.requestRender();
  }

  private showLogs(status: McpServerStatus): void {
    this.listContainer.clear();

    const logs = this.getServerLogsCallback(status.name);

    this.listContainer.addChild(
      new Text(theme.bold(`Logs for ${status.name}`) + theme.fg('muted', ` (${logs.length} lines)`), 0, 0),
    );
    this.listContainer.addChild(new Spacer(1));

    if (logs.length === 0) {
      const hint =
        status.transport === 'http'
          ? 'No logs available (HTTP servers do not produce stderr output)'
          : 'No logs captured yet';
      this.listContainer.addChild(new Text(theme.fg('muted', hint), 0, 0));
    } else {
      // Show last 50 lines to avoid overwhelming the overlay
      const tail = logs.slice(-50);
      if (logs.length > 50) {
        this.listContainer.addChild(
          new Text(theme.fg('muted', `  ... ${logs.length - 50} earlier lines omitted`), 0, 0),
        );
      }
      for (const line of tail) {
        this.listContainer.addChild(new Text(theme.fg('muted', `  ${line}`), 0, 0));
      }
    }

    this.listContainer.addChild(new Spacer(1));
    this.listContainer.addChild(new Text(theme.fg('muted', 'Press Esc to go back'), 0, 0));

    this._detailView = true;
    this.tui.requestRender();
  }
}
