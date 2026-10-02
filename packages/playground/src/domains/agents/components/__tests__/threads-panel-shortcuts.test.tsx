// @vitest-environment jsdom
import { KeyboardShortcutsProvider } from '@mastra/playground-ui/keyboard/keyboard-shortcuts-context';
import type { CollapsiblePanelHandle } from '@mastra/playground-ui/resize/collapsible-panel';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ThreadsPanelShortcuts } from '@/domains/agents/components/threads-panel-shortcuts';

const renderWithPanel = (panel: CollapsiblePanelHandle | null) => {
  const ref = createRef<CollapsiblePanelHandle>();
  ref.current = panel;
  render(
    <KeyboardShortcutsProvider>
      <ThreadsPanelShortcuts panel={ref} />
      <textarea data-testid="composer" />
    </KeyboardShortcutsProvider>,
  );
};

const fakePanel = (): CollapsiblePanelHandle => ({ collapse: vi.fn(), expand: vi.fn(), toggle: vi.fn() });

afterEach(() => cleanup());

describe('ThreadsPanelShortcuts', () => {
  it('pressing { toggles the threads panel', () => {
    const panel = fakePanel();
    renderWithPanel(panel);

    fireEvent.keyDown(window, { key: '{', shiftKey: true });

    expect(panel.toggle).toHaveBeenCalledTimes(1);
  });

  it('{ typed inside a textarea is ignored', () => {
    const panel = fakePanel();
    renderWithPanel(panel);

    fireEvent.keyDown(screen.getByTestId('composer'), { key: '{', shiftKey: true });

    expect(panel.toggle).not.toHaveBeenCalled();
  });

  it('[ does not toggle the threads panel', () => {
    const panel = fakePanel();
    renderWithPanel(panel);

    fireEvent.keyDown(window, { key: '[' });

    expect(panel.toggle).not.toHaveBeenCalled();
  });

  it('does nothing when the panel is not mounted (mobile drawer)', () => {
    renderWithPanel(null);

    expect(() => fireEvent.keyDown(window, { key: '{', shiftKey: true })).not.toThrow();
  });
});
