import type { CollapsiblePanelHandle } from '@mastra/playground-ui/resize/collapsible-panel';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useImperativeHandle } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouteSidePanel, RouteSidePanelDrawer, RouteSidePanelProvider, RouteSidePanelSlot } from '../route-side-panel';
import { useRouteSidePanel } from '../use-route-side-panel';

function PanelProbe() {
  const { hasPanel, isCollapsed, toggle, onPanelResize } = useRouteSidePanel();
  return (
    <div>
      <span data-testid="has-panel">{String(hasPanel)}</span>
      <span data-testid="is-collapsed">{String(isCollapsed)}</span>
      <button type="button" onClick={toggle}>
        toggle
      </button>
      <button type="button" onClick={() => onPanelResize(380)}>
        report-expanded
      </button>
    </div>
  );
}

/** Stands in for the layout's CollapsiblePanel: binds the shared handle to a spy. */
function FakePanel({ handle }: { handle: CollapsiblePanelHandle }) {
  const { panelHandle } = useRouteSidePanel();
  useImperativeHandle(panelHandle, () => handle);
  return null;
}

describe('RouteSidePanel', () => {
  it('portals the active owner content into the slot and reports hasPanel', async () => {
    render(
      <RouteSidePanelProvider>
        <PanelProbe />
        <RouteSidePanelSlot data-testid="slot" />
        <RouteSidePanel owner="agent-detail">Agent panel</RouteSidePanel>
      </RouteSidePanelProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('slot').textContent).toBe('Agent panel'));
    expect(screen.getByTestId('has-panel').textContent).toBe('true');
  });

  it('reports no panel when nothing is registered', () => {
    render(
      <RouteSidePanelProvider>
        <PanelProbe />
        <RouteSidePanelSlot data-testid="slot" />
      </RouteSidePanelProvider>,
    );

    expect(screen.getByTestId('has-panel').textContent).toBe('false');
    expect(screen.getByTestId('slot').textContent).toBe('');
  });

  it('renders only the highest-priority owner', async () => {
    render(
      <RouteSidePanelProvider>
        <PanelProbe />
        <RouteSidePanelSlot data-testid="slot" />
        <RouteSidePanel owner="parent">Parent panel</RouteSidePanel>
        <RouteSidePanel owner="child" priority={1}>
          Child panel
        </RouteSidePanel>
      </RouteSidePanelProvider>,
    );

    await waitFor(() => expect(screen.queryByText('Parent panel')).toBeNull());
    expect(screen.getByText('Child panel')).toBeTruthy();
  });

  it('unregisters the owner on unmount', async () => {
    const { rerender } = render(
      <RouteSidePanelProvider>
        <PanelProbe />
        <RouteSidePanelSlot data-testid="slot" />
        <RouteSidePanel owner="agent-detail">Agent panel</RouteSidePanel>
      </RouteSidePanelProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('has-panel').textContent).toBe('true'));

    rerender(
      <RouteSidePanelProvider>
        <PanelProbe />
        <RouteSidePanelSlot data-testid="slot" />
      </RouteSidePanelProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('has-panel').textContent).toBe('false'));
    expect(screen.queryByText('Agent panel')).toBeNull();
  });

  it('starts collapsed and reflects the physical state reported by the layout', () => {
    render(
      <RouteSidePanelProvider>
        <PanelProbe />
      </RouteSidePanelProvider>,
    );

    expect(screen.getByTestId('is-collapsed').textContent).toBe('true');

    fireEvent.click(screen.getByText('report-expanded'));
    expect(screen.getByTestId('is-collapsed').textContent).toBe('false');
  });

  it('drives the layout panel handle from toggle()', () => {
    const handle: CollapsiblePanelHandle = { collapse: vi.fn(), expand: vi.fn(), toggle: vi.fn() };
    render(
      <RouteSidePanelProvider>
        <PanelProbe />
        <FakePanel handle={handle} />
      </RouteSidePanelProvider>,
    );

    fireEvent.click(screen.getByText('toggle'));
    expect(handle.toggle).toHaveBeenCalledTimes(1);
  });

  it('is a no-op outside the provider', () => {
    render(<PanelProbe />);

    expect(screen.getByTestId('has-panel').textContent).toBe('false');
    expect(screen.getByTestId('is-collapsed').textContent).toBe('true');
    fireEvent.click(screen.getByText('toggle'));
  });
});

describe('RouteSidePanelDrawer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('when the screen is narrow', () => {
    function ConfigToggle() {
      const { isOpen, toggle } = useRouteSidePanel();
      return (
        <button type="button" aria-pressed={isOpen} onClick={toggle}>
          Config
        </button>
      );
    }

    it('reports the drawer closed again after the real drawer is dismissed', async () => {
      vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
        matches: true,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: () => false,
      }));
      render(
        <RouteSidePanelProvider>
          <ConfigToggle />
          <RouteSidePanelDrawer label="Open details panel" />
          <RouteSidePanel owner="agent-detail">Agent panel</RouteSidePanel>
        </RouteSidePanelProvider>,
      );
      const toggle = screen.getByRole('button', { name: 'Config' });

      fireEvent.click(toggle);
      const dialog = await screen.findByRole('dialog');
      await waitFor(() => expect(dialog.textContent).toContain('Agent panel'));
      expect(toggle.getAttribute('aria-pressed')).toBe('true');

      fireEvent.keyDown(dialog, { key: 'Escape' });

      await waitFor(() => expect(toggle.getAttribute('aria-pressed')).toBe('false'));
    });
  });
});
