import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  lastSettingsList: undefined as any,
  selectLists: [] as any[],
}));

vi.mock('@earendil-works/pi-tui', () => {
  class MockNode {
    children: MockNode[] = [];

    addChild(child: MockNode): void {
      this.children.push(child);
    }

    clear(): void {
      this.children = [];
    }
  }

  class MockInput extends MockNode {
    private value = '';

    getValue(): string {
      return this.value;
    }

    setValue(value: string): void {
      this.value = value;
    }

    handleInput(data: string): void {
      this.value += data;
    }
  }

  class MockSelectList extends MockNode {
    onSelect?: (item: { value: string }) => void | Promise<void>;
    onCancel?: () => void;
    selectedIndex = 0;

    constructor(
      public items: { value: string }[],
      _visibleRows?: number,
      _theme?: unknown,
    ) {
      super();
      mocks.selectLists.push(this);
    }

    setSelectedIndex(index: number): void {
      this.selectedIndex = index;
    }

    handleInput(data: string): void {
      if (data === '\r') {
        this.onSelect?.(this.items[this.selectedIndex]);
      } else if (data === '\x1b') {
        this.onCancel?.();
      }
    }
  }

  class MockSettingsList extends MockNode {
    constructor(
      public items: { id: string; submenu?: (currentValue: string, done: (value?: string) => void) => MockNode }[],
      _visibleRows?: number,
      _theme?: unknown,
      _onChange?: (id: string, value: string) => void,
      public onClose?: () => void,
    ) {
      super();
      mocks.lastSettingsList = this;
    }

    handleInput(data: string): void {
      if (data === '\x1b') this.onClose?.();
    }
  }

  return {
    Box: MockNode,
    Container: MockNode,
    Input: MockInput,
    SelectList: MockSelectList,
    SettingsList: MockSettingsList,
    Spacer: MockNode,
    Text: MockNode,
    matchesKey: (data: string, key: string) => data === `<${key}>`,
  };
});

import type { SettingsCallbacks, SettingsConfig } from '../settings.js';
import { SettingsComponent } from '../settings.js';

function createConfig(overrides: Partial<SettingsConfig> = {}): SettingsConfig {
  return {
    notifications: 'off',
    yolo: false,
    thinkingLevel: 'off',
    currentModelId: 'openai/gpt-5.4-mini',
    escapeAsCancel: false,
    quietMode: false,
    quietModeMaxToolPreviewLines: 2,
    storageBackend: 'libsql',
    pgConnectionString: '',
    libsqlUrl: '',
    experimentalGithubSignals: false,
    ...overrides,
  };
}

function createCallbacks(overrides: Partial<SettingsCallbacks> = {}): SettingsCallbacks {
  return {
    onNotificationsChange: vi.fn(),
    onYoloChange: vi.fn(),
    onThinkingLevelChange: vi.fn(),
    onEscapeAsCancelChange: vi.fn(),
    onQuietModeChange: vi.fn(),
    onQuietModeMaxToolPreviewLinesChange: vi.fn(),
    onStorageBackendChange: vi.fn(),
    onExperimentalGithubSignalsChange: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

function openStorageSubmenu(config = createConfig(), callbacks = createCallbacks()) {
  new SettingsComponent(config, callbacks);
  const item = mocks.lastSettingsList?.items.find((setting: { id: string }) => setting.id === 'storageBackend');
  if (!item?.submenu) throw new Error('Expected storage backend submenu');

  const done = vi.fn();
  const submenu = item.submenu('', done) as { handleInput(data: string): void };
  const backendSelect = mocks.selectLists.at(-1);
  if (!backendSelect) throw new Error('Expected backend select list');

  return { config, callbacks, done, submenu, backendSelect };
}

describe('SettingsComponent storage backend submenu', () => {
  beforeEach(() => {
    mocks.lastSettingsList = undefined;
    mocks.selectLists = [];
  });

  it('saves a PostgreSQL connection string when normalized Enter is pressed', () => {
    const { callbacks, config, done, submenu, backendSelect } = openStorageSubmenu();

    backendSelect.onSelect?.({ value: 'pg' });
    for (const char of 'postgresql://user:pass@example.test:5432/mastra') {
      submenu.handleInput(char);
    }
    submenu.handleInput('<enter>');

    expect(callbacks.onStorageBackendChange).toHaveBeenCalledWith(
      'pg',
      'postgresql://user:pass@example.test:5432/mastra',
    );
    expect(config.storageBackend).toBe('pg');
    expect(config.pgConnectionString).toBe('postgresql://user:pass@example.test:5432/mastra');
    expect(done).toHaveBeenCalledWith('PostgreSQL');
  });

  it('saves empty LibSQL input as the default local-file backend on raw Enter', () => {
    const { callbacks, config, done, submenu, backendSelect } = openStorageSubmenu(
      createConfig({
        storageBackend: 'pg',
        pgConnectionString: 'postgresql://settings@example.test/mastra',
      }),
    );

    backendSelect.onSelect?.({ value: 'libsql' });
    submenu.handleInput('\r');

    expect(callbacks.onStorageBackendChange).toHaveBeenCalledWith('libsql', undefined);
    expect(config.storageBackend).toBe('libsql');
    expect(config.libsqlUrl).toBe('');
    expect(done).toHaveBeenCalledWith('LibSQL (local file)');
  });

  it('cancels the connection input on raw Escape without saving backend changes', () => {
    const { callbacks, config, done, submenu, backendSelect } = openStorageSubmenu();

    backendSelect.onSelect?.({ value: 'pg' });
    for (const char of 'postgresql://user:pass@example.test/mastra') {
      submenu.handleInput(char);
    }
    submenu.handleInput('\x1b');

    expect(callbacks.onStorageBackendChange).not.toHaveBeenCalled();
    expect(config.storageBackend).toBe('libsql');
    expect(config.pgConnectionString).toBe('');
    expect(done).toHaveBeenCalledWith();
  });
});
