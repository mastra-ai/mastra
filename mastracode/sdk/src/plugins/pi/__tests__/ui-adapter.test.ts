import { describe, expect, it, vi } from 'vitest';

import { MastraPiExtensionGeneration } from '../runtime.js';
import { bindPiUiHost, createPiExtensionContext } from '../ui-adapter.js';
import type { PiUiHost } from '../ui-adapter.js';

function generation() {
  return new MastraPiExtensionGeneration('plugin.test', 'extension.test', '/tmp/extension.ts');
}

function host(): PiUiHost {
  return {
    notify: vi.fn(),
    setStatus: vi.fn(),
    setWidget: vi.fn(() => true),
    select: vi.fn(async (_generation, _title, options) => options[0]),
    confirm: vi.fn(async () => true),
    input: vi.fn(async () => 'input'),
    editor: vi.fn(async () => 'edited'),
    getTheme: vi.fn(() => ({ accent: '#fff' })),
    getEditorText: vi.fn(() => 'draft'),
    setEditorText: vi.fn(),
    clearGeneration: vi.fn(),
  };
}

describe('Pi UI adapter', () => {
  it('provides deterministic no-UI behavior with attributed diagnostics', async () => {
    const active = generation();
    const context = createPiExtensionContext(active, { cwd: '/workspace', mode: 'print' });
    const ui = context.ui as ReturnType<typeof createPiExtensionContext>['ui'] & {
      select(title: string, options: string[]): Promise<string | undefined>;
      confirm(title: string, message: string): Promise<boolean>;
      notify(message: string): void;
    };

    await expect(ui.select('Pick', ['one'])).resolves.toBeUndefined();
    await expect(ui.confirm('Confirm', 'Proceed?')).resolves.toBe(false);
    ui.notify('quiet');
    ui.notify('quiet again');

    expect(context).toMatchObject({ cwd: '/workspace', mode: 'print', hasUI: false });
    expect(active.compatibility.diagnostics.filter(entry => entry.capability === 'ui:notify:no-ui')).toHaveLength(1);
  });

  it('routes supported UI calls through a generation-owned host and clears it on invalidation', async () => {
    const active = generation();
    const uiHost = host();
    bindPiUiHost(active, uiHost);
    const context = createPiExtensionContext(active, { cwd: '/workspace', mode: 'tui' });
    const ui = context.ui as {
      select(title: string, options: string[]): Promise<string | undefined>;
      confirm(title: string, message: string): Promise<boolean>;
      input(title: string): Promise<string | undefined>;
      editor(title: string, value: string): Promise<string | undefined>;
      notify(message: string): void;
      setStatus(key: string, text?: string): void;
      setWidget(key: string, content: unknown): void;
      getTheme(): Record<string, string>;
      getEditorText(): string;
      setEditorText(text: string): void;
    };

    await expect(ui.select('Pick', ['one'])).resolves.toBe('one');
    await expect(ui.confirm('Confirm', 'Proceed?')).resolves.toBe(true);
    await expect(ui.input('Input')).resolves.toBe('input');
    await expect(ui.editor('Editor', 'draft')).resolves.toBe('edited');
    ui.notify('hello');
    ui.setStatus('sync', 'working');
    ui.setWidget('summary', 'ready');
    expect(ui.getTheme()).toEqual({ accent: '#fff' });
    expect(ui.getEditorText()).toBe('draft');
    ui.setEditorText('next');

    expect(context.hasUI).toBe(true);
    expect(uiHost.notify).toHaveBeenCalledWith(active, 'hello', 'info');
    expect(uiHost.setStatus).toHaveBeenCalledWith(active, 'sync', 'working');
    expect(uiHost.setWidget).toHaveBeenCalledWith(active, 'summary', 'ready', undefined);

    await active.invalidate();
    expect(uiHost.clearGeneration).toHaveBeenCalledWith(active);
    expect(() => ui.notify('stale')).toThrow(/stale/);
  });

  it('rejects late dialog results after generation invalidation', async () => {
    const active = generation();
    let resolve!: (value: string | undefined) => void;
    const uiHost = host();
    uiHost.select = vi.fn(() => new Promise<string | undefined>(done => (resolve = done)));
    bindPiUiHost(active, uiHost);
    const context = createPiExtensionContext(active, { cwd: '/workspace', mode: 'tui' });
    const pending = (context.ui as { select(title: string, options: string[]): Promise<string | undefined> }).select(
      'Pick',
      ['one'],
    );

    await active.invalidate();
    resolve('one');

    await expect(pending).rejects.toThrow(/stale/);
  });
});
