// @vitest-environment jsdom
import { KeyboardShortcutsProvider } from '@mastra/playground-ui/keyboard/keyboard-shortcuts-context';
import type { CollapsiblePanelHandle } from '@mastra/playground-ui/resize/collapsible-panel';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ThreadsPanelShortcuts } from '@/domains/agents/components/threads-panel-shortcuts';
import { ThreadsPanelProvider } from '@/domains/agents/context/threads-panel-context';
import { useThreadsPanel } from '@/domains/agents/context/use-threads-panel';

const RegisterPanel = ({ panel }: { panel: CollapsiblePanelHandle | null }) => {
  const threadsPanel = useThreadsPanel();
  return <div ref={() => threadsPanel?.registerPanel(panel)} />;
};

const renderWithPanel = (panel: CollapsiblePanelHandle | null) => {
  render(
    <KeyboardShortcutsProvider>
      <ThreadsPanelProvider>
        <RegisterPanel panel={panel} />
        <ThreadsPanelShortcuts />
        <textarea data-testid="composer" />
      </ThreadsPanelProvider>
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
