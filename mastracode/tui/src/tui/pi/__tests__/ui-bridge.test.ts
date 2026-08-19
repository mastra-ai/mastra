import { Container, Text } from '@earendil-works/pi-tui';
import { MastraPiExtensionGeneration } from '@mastra/code-sdk/plugins/pi/runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as display from '../../display.js';
import * as modal from '../../modal-question.js';
import type { TUIState } from '../../state.js';
import { PiTuiBridge } from '../ui-bridge.js';

vi.mock('../../display.js', () => ({ showInfo: vi.fn(), showError: vi.fn() }));
vi.mock('../../modal-question.js', () => ({ askModalQuestion: vi.fn() }));

function generation() {
  return new MastraPiExtensionGeneration('plugin.test', 'extension.test', '/tmp/extension.ts');
}

function fixture() {
  const listeners = new Set<(generations: MastraPiExtensionGeneration[]) => void | Promise<void>>();
  const generations = [generation()];
  const manager = {
    getPiGenerations: vi.fn(() => generations),
    setPiUiHost: vi.fn(async () => undefined),
    onPiGenerationsReconcile: vi.fn((listener: (next: MastraPiExtensionGeneration[]) => void | Promise<void>) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
  };
  const state = {
    ui: {
      requestRender: vi.fn(),
      hideOverlay: vi.fn(),
    },
    editor: {
      getText: vi.fn(() => 'draft'),
      setText: vi.fn(),
    },
    piUiStatusLine: new Text('', 0, 0),
    piUiWidgets: new Container(),
  } as unknown as TUIState;
  return { bridge: new PiTuiBridge(state, manager as never), generations, listeners, manager, state };
}

describe('Pi TUI bridge', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders owned status, text widgets, notifications, and editor access', async () => {
    const { bridge, generations, state } = fixture();
    const active = generations[0]!;
    await bridge.start();

    bridge.setStatus(active, 'sync', 'working');
    bridge.setWidget(active, 'summary', ['line one', 'line two']);
    bridge.notify(active, 'ready', 'info');
    bridge.setEditorText('next');

    expect(state.piUiStatusLine!.render(80)[0]).toContain('extension.test: working');
    expect(state.piUiWidgets!.render(80).join('\n')).toContain('[extension.test] line one');
    expect(display.showInfo).toHaveBeenCalledWith(state, '[extension.test] ready');
    expect(state.editor.setText).toHaveBeenCalledWith('next');
    expect(bridge.getEditorText()).toBe('draft');
    expect(bridge.getTheme()).toMatchObject({ accent: expect.any(String), text: expect.any(String) });
  });

  it('brokers dialogs through the host overlay and passes the generation abort signal', async () => {
    const { bridge, generations } = fixture();
    const active = generations[0]!;
    await bridge.start();
    vi.mocked(modal.askModalQuestion).mockResolvedValueOnce('two').mockResolvedValueOnce('Yes');

    await expect(bridge.select(active, 'Pick', ['one', 'two'], active.staleSignal)).resolves.toBe('two');
    await expect(bridge.confirm(active, 'Confirm', 'Proceed?', active.staleSignal)).resolves.toBe(true);

    expect(modal.askModalQuestion).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        question: 'Pick',
        options: [{ label: 'one' }, { label: 'two' }],
        signal: active.staleSignal,
      }),
    );
  });

  it('clears only retired-generation slots and diagnoses unsupported surfaces', async () => {
    const { bridge, generations, listeners, state } = fixture();
    const retired = generations[0]!;
    await bridge.start();
    bridge.setStatus(retired, 'sync', 'old');
    expect(bridge.setWidget(retired, 'rich', { render: () => 'unsafe' })).toBe(false);
    retired.registrations.shortcuts.set('ctrl+x', { handler: vi.fn() });

    const replacement = generation();
    for (const listener of listeners) await listener([replacement]);

    expect(state.piUiStatusLine!.render(80).join('')).not.toContain('old');

    for (const listener of listeners) await listener([retired]);
    expect(retired.compatibility.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ capability: 'registerShortcut' })]),
    );
  });

  it('removes all UI ownership on stop', async () => {
    const { bridge, generations, listeners, state } = fixture();
    await bridge.start();
    bridge.setStatus(generations[0]!, 'sync', 'working');

    await bridge.stop();

    expect(listeners.size).toBe(0);
    expect(state.piUiStatusLine!.render(80).join('')).not.toContain('working');
  });
});
