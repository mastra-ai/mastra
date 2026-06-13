import type { TUI } from '@mariozechner/pi-tui';
import stripAnsi from 'strip-ansi';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { McpServerStatus } from '../../../mcp/types.js';

vi.mock('@mariozechner/pi-tui', async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    getKeybindings: () => ({
      matches: (data: string, key: string) => data === `__${key}__`,
    }),
  };
});

import { McpSelectorComponent } from '../mcp-selector.js';

const confirm = '__tui.select.confirm__';
const cancel = '__tui.select.cancel__';
const down = '__tui.select.down__';

function createTui(): TUI {
  return { requestRender: vi.fn() } as unknown as TUI;
}

function connected(overrides: Partial<McpServerStatus> = {}): McpServerStatus {
  return {
    name: 'alpha',
    connected: true,
    toolCount: 2,
    toolNames: ['alpha_search', 'alpha_write'],
    transport: 'stdio',
    ...overrides,
  };
}

function failed(overrides: Partial<McpServerStatus> = {}): McpServerStatus {
  return {
    name: 'broken',
    connected: false,
    toolCount: 0,
    toolNames: [],
    transport: 'stdio',
    error: 'spawn ENOENT',
    ...overrides,
  };
}

function renderPlain(component: McpSelectorComponent): string {
  return stripAnsi(component.render(120).join('\n'));
}

function createSelector(overrides: Partial<ConstructorParameters<typeof McpSelectorComponent>[0]> = {}) {
  const infoMessages: string[] = [];
  const component = new McpSelectorComponent({
    tui: createTui(),
    statuses: [connected()],
    skipped: [],
    configPaths: { project: '/project/mcp.json', global: '/global/mcp.json', claude: '/claude.json' },
    getStatuses: () => ({ statuses: [connected()], skipped: [] }),
    onReloadAll: async () => ({ statuses: [connected()], skipped: [] }),
    onReconnectServer: async name => connected({ name }),
    getServerLogs: () => ['first stderr line', 'second stderr line'],
    showInfo: msg => infoMessages.push(msg),
    onClose: vi.fn(),
    ...overrides,
  });

  return { component, infoMessages };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('McpSelectorComponent', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders connected server tool and log detail views, then returns to the server list', () => {
    const { component } = createSelector();

    component.handleInput(confirm);
    component.handleInput(confirm);

    expect(renderPlain(component)).toContain('Tools for alpha (2)');
    expect(renderPlain(component)).toContain('alpha_search');
    expect(renderPlain(component)).toContain('alpha_write');

    component.handleInput(cancel);
    expect(renderPlain(component)).toContain('alpha [stdio] connected · 2 tools');

    component.handleInput(confirm);
    component.handleInput(down);
    component.handleInput(confirm);

    expect(renderPlain(component)).toContain('Logs for alpha (2 lines)');
    expect(renderPlain(component)).toContain('first stderr line');
    expect(renderPlain(component)).toContain('second stderr line');
  });

  it('renders failed server error detail view', () => {
    const { component } = createSelector({ statuses: [failed()] });

    component.handleInput(confirm);
    component.handleInput(confirm);

    expect(renderPlain(component)).toContain('Error for broken');
    expect(renderPlain(component)).toContain('spawn ENOENT');
  });

  it('polls connecting servers until statuses settle', () => {
    vi.useFakeTimers();
    const getStatuses = vi.fn(() => ({
      statuses: [connected({ name: 'booting', transport: 'http', toolCount: 1, toolNames: ['ready_tool'] })],
      skipped: [],
    }));
    const { component } = createSelector({
      statuses: [
        {
          name: 'booting',
          connected: false,
          connecting: true,
          toolCount: 0,
          toolNames: [],
          transport: 'http',
        },
      ],
      getStatuses,
    });

    expect(renderPlain(component)).toContain('booting [http] connecting...');

    vi.advanceTimersByTime(500);

    expect(getStatuses).toHaveBeenCalledOnce();
    expect(renderPlain(component)).toContain('booting [http] connected · 1 tools');

    vi.advanceTimersByTime(1_000);
    expect(getStatuses).toHaveBeenCalledOnce();
    component.dispose();
  });

  it('ignores stale reconnect results while reload-all is in progress', async () => {
    const reconnect = deferred<McpServerStatus>();
    const reload = deferred<{ statuses: McpServerStatus[]; skipped: [] }>();
    const onReconnectServer = vi.fn(() => reconnect.promise);
    const onReloadAll = vi.fn(() => reload.promise);
    const { component, infoMessages } = createSelector({
      statuses: [failed({ name: 'race', error: 'initial failure' })],
      onReconnectServer,
      onReloadAll,
    });

    component.handleInput(confirm);
    component.handleInput(down);
    component.handleInput(down);
    component.handleInput(confirm);

    expect(onReconnectServer).toHaveBeenCalledWith('race');
    expect(renderPlain(component)).toContain('race [stdio] connecting...');

    component.handleInput('r');
    expect(onReloadAll).toHaveBeenCalledOnce();
    expect(renderPlain(component)).toContain('1 server — reconnecting...');

    reconnect.resolve(failed({ name: 'race', error: 'stale reconnect failure' }));
    await flushPromises();

    expect(infoMessages.join('\n')).not.toContain('stale reconnect failure');
    expect(renderPlain(component)).toContain('reconnecting...');

    reload.resolve({
      statuses: [connected({ name: 'fresh', transport: 'http', toolCount: 1, toolNames: ['fresh_tool'] })],
      skipped: [],
    });
    await flushPromises();

    const rendered = renderPlain(component);
    expect(rendered).toContain('fresh [http] connected · 1 tools');
    expect(rendered).not.toContain('stale reconnect failure');
    expect(infoMessages.join('\n')).toContain('MCP: Reloaded. 1 server(s) connected, 1 tool(s).');
  });
});
