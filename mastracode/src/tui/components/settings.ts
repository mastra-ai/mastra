/**
 * General settings component.
 * Uses pi-tui's SettingsList for a clean overlay with
 * notifications, YOLO mode, and thinking level configuration.
 *
 * Changes apply immediately — Esc closes the panel.
 */

import { Box, Container, Input, SelectList, SettingsList, Spacer, Text } from '@mariozechner/pi-tui';
import type { Focusable, SelectItem, SettingItem } from '@mariozechner/pi-tui';
import type { StorageBackend } from '../../onboarding/settings.js';
import type { NotificationMode } from '../notify.js';
import { theme, getSettingsListTheme, getSelectListTheme } from '../theme.js';

// =============================================================================
// Types
// =============================================================================
export interface SettingsConfig {
  notifications: NotificationMode;
  yolo: boolean;
  thinkingLevel: string;
  escapeAsCancel: boolean;
  storageBackend: StorageBackend;
  pgConnectionString: string;
  libsqlUrl: string;
}

export interface SettingsCallbacks {
  onNotificationsChange: (mode: NotificationMode) => void;
  onYoloChange: (enabled: boolean) => void;
  onThinkingLevelChange: (level: string) => void;
  onEscapeAsCancelChange: (enabled: boolean) => void;
  onStorageBackendChange: (backend: StorageBackend, connectionUrl?: string) => void;
  onClose: () => void;
}

// =============================================================================
// Select Submenu (reusable for any enum-style setting)
// =============================================================================

class SelectSubmenu extends SelectList {
  constructor(items: SelectItem[], currentValue: string, onSelect: (value: string) => void, onBack: () => void) {
    super(items, Math.min(items.length, 8), getSelectListTheme());

    const currentIndex = items.findIndex(i => i.value === currentValue);
    if (currentIndex !== -1) {
      this.setSelectedIndex(currentIndex);
    }

    this.onSelect = (item: SelectItem) => {
      onSelect(item.value);
    };
    this.onCancel = onBack;
  }
}

// =============================================================================
// Storage Backend Submenu (backend selector → optional PG connection input)
// =============================================================================

class StorageBackendSubmenu extends Container {
  private phase: 'select' | 'connection' = 'select';
  private pendingBackend: StorageBackend = 'libsql';
  private selectList: SelectList;
  private input!: Input;
  private onDone: (backend: StorageBackend, connectionUrl?: string) => void;
  private onBack: () => void;
  private currentPgConnectionString: string;
  private currentLibsqlUrl: string;

  constructor(
    currentBackend: StorageBackend,
    currentPgConnectionString: string,
    currentLibsqlUrl: string,
    onDone: (backend: StorageBackend, connectionUrl?: string) => void,
    onBack: () => void,
  ) {
    super();
    this.onDone = onDone;
    this.onBack = onBack;
    this.currentPgConnectionString = currentPgConnectionString;
    this.currentLibsqlUrl = currentLibsqlUrl;

    // Phase 1: backend selection
    const items: SelectItem[] = [
      {
        value: 'libsql',
        label: '  LibSQL',
        description: 'Local file-based SQLite or remote Turso URL',
      },
      {
        value: 'pg',
        label: '  PostgreSQL',
        description: 'Remote PostgreSQL (requires connection string)',
      },
    ];

    this.selectList = new SelectList(items, items.length, getSelectListTheme());
    const currentIndex = items.findIndex(i => i.value === currentBackend);
    if (currentIndex !== -1) this.selectList.setSelectedIndex(currentIndex);

    this.selectList.onSelect = (item: SelectItem) => {
      this.pendingBackend = item.value as StorageBackend;
      this.showConnectionInput();
    };
    this.selectList.onCancel = onBack;

    this.addChild(this.selectList);
  }

  private showConnectionInput(): void {
    this.phase = 'connection';
    this.clear();

    if (this.pendingBackend === 'pg') {
      this.addChild(new Text(theme.bold(theme.fg('accent', 'PostgreSQL Connection')), 0, 0));
      this.addChild(new Spacer(1));
      this.addChild(new Text(theme.fg('muted', 'Enter a connection string:'), 0, 0));
      this.addChild(new Text(theme.fg('dim', 'e.g. postgresql://user:pass@localhost:5432/mydb'), 0, 0));
    } else {
      this.addChild(new Text(theme.bold(theme.fg('accent', 'LibSQL Connection')), 0, 0));
      this.addChild(new Spacer(1));
      this.addChild(new Text(theme.fg('muted', 'Enter a URL or leave empty for default local file:'), 0, 0));
      this.addChild(new Text(theme.fg('dim', 'e.g. libsql://your-db.turso.io'), 0, 0));
    }
    this.addChild(new Spacer(1));

    this.input = new Input();
    const currentValue = this.pendingBackend === 'pg' ? this.currentPgConnectionString : this.currentLibsqlUrl;
    if (currentValue) {
      this.input.setValue(currentValue);
    }
    this.addChild(this.input);

    this.addChild(new Spacer(1));
    this.addChild(new Text(theme.fg('dim', 'Enter to save · Esc to go back'), 0, 0));
  }

  handleInput(data: string): void {
    if (this.phase === 'select') {
      this.selectList.handleInput(data);
      return;
    }

    // Connection string input phase
    if (data === '\r' || data === '\n') {
      const value = this.input.getValue().trim();
      if (this.pendingBackend === 'pg') {
        // PG requires a connection string
        if (value) {
          this.onDone('pg', value);
        }
      } else {
        // LibSQL: empty = default local file, non-empty = custom URL
        this.onDone('libsql', value || undefined);
      }
      return;
    }

    if (data === '\x1b' || data === '\x1b\x1b') {
      this.onBack();
      return;
    }

    this.input.handleInput(data);
  }
}

// =============================================================================
// Helpers
// =============================================================================

function storageLabel(config: SettingsConfig): string {
  if (config.storageBackend === 'pg') return 'PostgreSQL';
  if (config.libsqlUrl) return `LibSQL (${config.libsqlUrl})`;
  return 'LibSQL (local file)';
}

// =============================================================================
// Settings Component
// =============================================================================

export class SettingsComponent extends Box implements Focusable {
  private settingsList: SettingsList;
  private _focused = false;

  get focused(): boolean {
    return this._focused;
  }
  set focused(value: boolean) {
    this._focused = value;
  }

  constructor(config: SettingsConfig, callbacks: SettingsCallbacks) {
    super(2, 1, (text: string) => theme.bg('overlayBg', text));

    // Title
    this.addChild(new Text(theme.bold(theme.fg('accent', 'Settings')), 0, 0));
    this.addChild(new Spacer(1));

    // Build settings items
    const notificationModes: {
      value: NotificationMode;
      label: string;
      desc: string;
    }[] = [
      { value: 'off', label: 'Off', desc: 'No notifications' },
      { value: 'bell', label: 'Bell', desc: 'Terminal bell (\\x07)' },
      { value: 'system', label: 'System', desc: 'Native OS notification' },
      { value: 'both', label: 'Both', desc: 'Bell + system notification' },
    ];

    const thinkingLevels: { value: string; label: string; desc: string }[] = [
      { value: 'off', label: 'Off', desc: 'No extended thinking' },
      { value: 'minimal', label: 'Minimal', desc: '~1k budget tokens' },
      { value: 'low', label: 'Low', desc: '~4k budget tokens' },
      { value: 'medium', label: 'Medium', desc: '~10k budget tokens' },
      { value: 'high', label: 'High', desc: '~32k budget tokens' },
    ];

    const getNotifLabel = (mode: NotificationMode) => notificationModes.find(m => m.value === mode)?.label ?? mode;

    const getThinkingLabel = (level: string) => thinkingLevels.find(l => l.value === level)?.label ?? level;

    const items: SettingItem[] = [
      {
        id: 'notifications',
        label: 'Notifications',
        description: 'How to alert when the agent needs attention',
        currentValue: getNotifLabel(config.notifications),
        submenu: (_currentValue, done) =>
          new SelectSubmenu(
            notificationModes.map(m => ({
              value: m.value,
              label: `  ${m.label}`,
              description: m.desc,
            })),
            config.notifications,
            value => {
              config.notifications = value as NotificationMode;
              callbacks.onNotificationsChange(config.notifications);
              done(getNotifLabel(config.notifications));
            },
            () => done(),
          ),
      },
      {
        id: 'yolo',
        label: 'YOLO mode',
        description: 'Auto-approve all tool calls without confirmation',
        currentValue: config.yolo ? 'On' : 'Off',
        submenu: (_currentValue, done) =>
          new SelectSubmenu(
            [
              {
                value: 'on',
                label: '  On',
                description: 'Auto-approve all tools',
              },
              {
                value: 'off',
                label: '  Off',
                description: 'Require approval for tools',
              },
            ],
            config.yolo ? 'on' : 'off',
            value => {
              config.yolo = value === 'on';
              callbacks.onYoloChange(config.yolo);
              done(config.yolo ? 'On' : 'Off');
            },
            () => done(),
          ),
      },
      {
        id: 'thinking',
        label: 'Thinking level',
        description: 'Extended thinking budget for Anthropic models (currently disabled)',
        currentValue: getThinkingLabel(config.thinkingLevel),
        submenu: (_currentValue, done) =>
          new SelectSubmenu(
            thinkingLevels.map(l => ({
              value: l.value,
              label: `  ${l.label}`,
              description: l.desc,
            })),
            config.thinkingLevel,
            value => {
              config.thinkingLevel = value;
              callbacks.onThinkingLevelChange(value);
              done(getThinkingLabel(value));
            },
            () => done(),
          ),
      },
      {
        id: 'escapeAsCancel',
        label: 'Escape cancels',
        description: 'Use Escape to cancel/clear (Ctrl+C always works). Ctrl+Z undoes a clear.',
        currentValue: config.escapeAsCancel ? 'On' : 'Off',
        submenu: (_currentValue, done) =>
          new SelectSubmenu(
            [
              {
                value: 'on',
                label: '  On',
                description: 'Escape clears input / aborts',
              },
              {
                value: 'off',
                label: '  Off',
                description: 'Only Ctrl+C clears / aborts',
              },
            ],
            config.escapeAsCancel ? 'on' : 'off',
            value => {
              config.escapeAsCancel = value === 'on';
              callbacks.onEscapeAsCancelChange(config.escapeAsCancel);
              done(config.escapeAsCancel ? 'On' : 'Off');
            },
            () => done(),
          ),
      },
      {
        id: 'storageBackend',
        label: 'Storage backend',
        description: 'Database backend for threads, memory, and agent data (restart required)',
        currentValue: storageLabel(config),
        submenu: (_currentValue, done) =>
          new StorageBackendSubmenu(
            config.storageBackend,
            config.pgConnectionString,
            config.libsqlUrl,
            (backend: StorageBackend, connectionUrl?: string) => {
              config.storageBackend = backend;
              if (backend === 'pg' && connectionUrl !== undefined) {
                config.pgConnectionString = connectionUrl;
              } else if (backend === 'libsql') {
                config.libsqlUrl = connectionUrl ?? '';
              }
              callbacks.onStorageBackendChange(backend, connectionUrl);
              done(storageLabel(config));
            },
            () => done(),
          ),
      },
    ];

    this.settingsList = new SettingsList(
      items,
      10,
      getSettingsListTheme(),
      (_id, _newValue) => {
        // All changes handled via submenu callbacks
      },
      callbacks.onClose,
    );

    this.addChild(this.settingsList);
  }

  handleInput(data: string): void {
    this.settingsList.handleInput(data);
  }
}
