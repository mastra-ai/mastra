// @vitest-environment jsdom
import { KeyboardShortcutsProvider } from '@mastra/playground-ui/keyboard/keyboard-shortcuts-context';
import type { CollapsiblePanelHandle } from '@mastra/playground-ui/resize/collapsible-panel';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useImperativeHandle } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OverviewPanelShortcuts } from '@/domains/agents/components/overview-panel-shortcuts';
import { RouteSidePanelProvider, useRouteSidePanel } from '@/lib/route-side-panel';

/** Stands in for the layout's CollapsiblePanel: binds the shared handle to a spy. */
function FakePanel({ handle }: { handle: CollapsiblePanelHandle }) {
  const { panelHandle } = useRouteSidePanel();
  useImperativeHandle(panelHandle, () => handle);
  return null;
}

const fakePanel = (): CollapsiblePanelHandle => ({ collapse: vi.fn(), expand: vi.fn(), toggle: vi.fn() });

const renderWithPanel = (panel: CollapsiblePanelHandle | null) => {
  render(
    <KeyboardShortcutsProvider>
      <RouteSidePanelProvider>
        {panel && <FakePanel handle={panel} />}
        <OverviewPanelShortcuts />
        <textarea data-testid="composer" />
      </RouteSidePanelProvider>
    </KeyboardShortcutsProvider>,
  );
};

afterEach(() => cleanup());

describe('OverviewPanelShortcuts', () => {
  it('pressing ] toggles the overview panel', () => {
    const panel = fakePanel();
    renderWithPanel(panel);

    fireEvent.keyDown(window, { key: ']' });

    expect(panel.toggle).toHaveBeenCalledTimes(1);
  });

  it('] typed inside a textarea is ignored', () => {
    const panel = fakePanel();
    renderWithPanel(panel);

    fireEvent.keyDown(screen.getByTestId('composer'), { key: ']' });

    expect(panel.toggle).not.toHaveBeenCalled();
  });

  it('[ does not toggle the overview panel', () => {
    const panel = fakePanel();
    renderWithPanel(panel);

    fireEvent.keyDown(window, { key: '[' });

    expect(panel.toggle).not.toHaveBeenCalled();
  });

  it('does nothing when the panel is not mounted (mobile drawer)', () => {
    renderWithPanel(null);

    expect(() => fireEvent.keyDown(window, { key: ']' })).not.toThrow();
  });
});
