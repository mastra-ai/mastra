import type { CollapsiblePanelHandle } from '@mastra/playground-ui/resize/collapsible-panel';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode, Ref } from 'react';
import { useImperativeHandle } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StudioFrame } from '../layout';
import { RouteSidePanel, RouteSidePanelProvider, useRouteSidePanel } from '@/lib/route-side-panel';

const mobileState = vi.hoisted(() => ({ value: false }));
const lastResize = vi.hoisted(() => ({ fn: null as null | ((size: { inPixels: number }) => void) }));
const handleSpy = vi.hoisted(() => ({ collapse: vi.fn(), expand: vi.fn(), toggle: vi.fn() }));
const lastGroup = vi.hoisted(() => ({ defaultLayout: undefined as Record<string, number> | undefined }));

vi.mock('react-resizable-panels', () => ({
  Group: ({
    className,
    children,
    defaultLayout,
  }: {
    className?: string;
    children: ReactNode;
    defaultLayout?: Record<string, number>;
  }) => {
    lastGroup.defaultLayout = defaultLayout;
    return (
      <div data-testid="panel-group" className={className}>
        {children}
      </div>
    );
  },
  Panel: ({ id, className, children }: { id?: string; className?: string; children: ReactNode }) => (
    <section data-testid={`panel-${id}`} className={className}>
      {children}
    </section>
  ),
  useDefaultLayout: () => ({ defaultLayout: undefined, onLayoutChange: vi.fn() }),
}));

vi.mock('@mastra/playground-ui/resize/collapsible-panel', () => ({
  CollapsiblePanel: ({
    id,
    children,
    hideExpandButton,
    onResize,
    ref,
  }: {
    id: string;
    children: ReactNode;
    hideExpandButton?: boolean;
    onResize?: (size: { inPixels: number }) => void;
    ref?: Ref<CollapsiblePanelHandle>;
  }) => {
    lastResize.fn = onResize ?? null;
    useImperativeHandle(ref, () => handleSpy);
    return (
      <section data-testid={`collapsible-${id}`} data-hide-expand={String(Boolean(hideExpandButton))}>
        {children}
      </section>
    );
  },
}));

vi.mock('@mastra/playground-ui/resize/separator', () => ({
  PanelSeparator: () => <div data-testid="panel-separator" />,
}));

vi.mock('@mastra/playground-ui/resize/panel-drawer', () => ({
  PanelDrawer: ({ label, children }: { label: string; children: ReactNode }) => (
    <aside data-testid="panel-drawer" aria-label={label}>
      {children}
    </aside>
  ),
}));

vi.mock('@mastra/playground-ui/hooks/use-is-mobile', () => ({
  useIsMobile: () => mobileState.value,
}));

function Toggle() {
  const { toggle, isCollapsed } = useRouteSidePanel();
  return (
    <button type="button" aria-pressed={!isCollapsed} onClick={toggle}>
      toggle
    </button>
  );
}

function renderFrame({ withPanel }: { withPanel: boolean }) {
  return render(
    <RouteSidePanelProvider>
      <Toggle />
      <StudioFrame>
        <div data-testid="frame-content">page</div>
      </StudioFrame>
      {withPanel && <RouteSidePanel owner="agent-detail">Panel content</RouteSidePanel>}
    </RouteSidePanelProvider>,
  );
}

afterEach(() => {
  mobileState.value = false;
  lastResize.fn = null;
  lastGroup.defaultLayout = undefined;
  vi.clearAllMocks();
  localStorage.clear();
});

describe('StudioFrame side panel', () => {
  it('renders only the frame panel when no page registered a side panel', () => {
    renderFrame({ withPanel: false });

    expect(screen.getByTestId('panel-studio-frame')).toBeTruthy();
    expect(screen.getByTestId('frame-content')).toBeTruthy();
    expect(screen.queryByTestId('panel-separator')).toBeNull();
    expect(screen.queryByTestId('collapsible-route-side-panel')).toBeNull();
  });

  it('mounts the resizable side panel next to the frame, collapsed by default, with the content portaled into it', async () => {
    renderFrame({ withPanel: true });

    const panel = await screen.findByTestId('collapsible-route-side-panel');
    expect(panel.getAttribute('data-hide-expand')).toBe('true');
    expect(screen.getByTestId('panel-separator')).toBeTruthy();
    expect(lastGroup.defaultLayout).toEqual({ 'studio-frame': 100, 'route-side-panel': 0 });
    expect(screen.getByText('toggle').getAttribute('aria-pressed')).toBe('false');
    await waitFor(() => expect(panel.textContent).toContain('Panel content'));
    expect(screen.getByTestId('panel-studio-frame').textContent).not.toContain('Panel content');
  });

  it('drives the collapsible panel handle from the shared toggle', async () => {
    renderFrame({ withPanel: true });
    await screen.findByTestId('collapsible-route-side-panel');

    fireEvent.click(screen.getByText('toggle'));

    expect(handleSpy.toggle).toHaveBeenCalledTimes(1);
  });

  it('reflects the physical panel size in the shared collapsed state', async () => {
    renderFrame({ withPanel: true });
    await screen.findByTestId('collapsible-route-side-panel');

    act(() => lastResize.fn?.({ inPixels: 380 }));
    expect(screen.getByText('toggle').getAttribute('aria-pressed')).toBe('true');

    act(() => lastResize.fn?.({ inPixels: 0 }));
    expect(screen.getByText('toggle').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTestId('collapsible-route-side-panel')).toBeTruthy();
  });

  it('uses an edge drawer instead of a resizable panel on mobile', async () => {
    mobileState.value = true;
    renderFrame({ withPanel: true });

    const drawer = await screen.findByTestId('panel-drawer');
    await waitFor(() => expect(drawer.textContent).toContain('Panel content'));
    // The page stays under the same panel so crossing the breakpoint never remounts it.
    expect(screen.getByTestId('panel-studio-frame')).toBeTruthy();
    expect(screen.queryByTestId('collapsible-route-side-panel')).toBeNull();
    expect(screen.queryByTestId('panel-separator')).toBeNull();
  });

  it('keeps the page mounted when crossing the mobile breakpoint', async () => {
    const { rerender } = renderFrame({ withPanel: true });
    const before = screen.getByTestId('frame-content');

    mobileState.value = true;
    rerender(
      <RouteSidePanelProvider>
        <Toggle />
        <StudioFrame>
          <div data-testid="frame-content">page</div>
        </StudioFrame>
        <RouteSidePanel owner="agent-detail">Panel content</RouteSidePanel>
      </RouteSidePanelProvider>,
    );

    await screen.findByTestId('panel-drawer');
    expect(screen.getByTestId('frame-content')).toBe(before);
  });
});
