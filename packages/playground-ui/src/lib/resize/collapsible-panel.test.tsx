// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import type { PanelImperativeHandle } from 'react-resizable-panels';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CollapsiblePanel } from './collapsible-panel';

const panelMocks = vi.hoisted(() => {
  const state = { size: 300, collapsed: false };
  return {
    state,
    handle: {
      expand: vi.fn(),
      collapse: vi.fn(),
      resize: vi.fn(),
      getSize: vi.fn(() => ({ inPixels: state.size, asPercentage: 0 })),
      isCollapsed: vi.fn(() => state.collapsed),
    },
  };
});

type MockPanelSize = { inPixels: number };

vi.mock('react-resizable-panels', () => ({
  usePanelRef: () => ({ current: panelMocks.handle }),
  Panel: ({
    children,
    className,
    collapsedSize,
    onResize,
    style,
  }: {
    children: ReactNode;
    className?: string;
    collapsedSize?: number;
    onResize?: (size: MockPanelSize, id: string | number | undefined, previousSize: MockPanelSize | undefined) => void;
    style?: CSSProperties;
  }) => {
    return (
      <section data-panel data-testid="panel" className={className} style={style}>
        <button
          type="button"
          data-testid="resize-collapsed"
          onClick={() => onResize?.({ inPixels: collapsedSize ?? 0 }, undefined, undefined)}
        />
        <button
          type="button"
          data-testid="resize-open"
          onClick={() => onResize?.({ inPixels: 320 }, undefined, { inPixels: collapsedSize ?? 0 })}
        />
        <button
          type="button"
          data-testid="resize-shrinking"
          onClick={() => onResize?.({ inPixels: 290 }, undefined, { inPixels: 320 })}
        />
        {children}
      </section>
    );
  },
}));

const renderPanel = (direction: 'left' | 'right' = 'left') =>
  render(
    <CollapsiblePanel collapsedSize={0} direction={direction} minSize={280}>
      <div data-testid="panel-content">Panel content</div>
    </CollapsiblePanel>,
  );

describe('CollapsiblePanel', () => {
  beforeEach(() => {
    panelMocks.state.size = 300;
    panelMocks.state.collapsed = false;
    panelMocks.handle.expand.mockClear();
    panelMocks.handle.collapse.mockClear();
    panelMocks.handle.resize.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders expanded content without collapsed affordances before resize', () => {
    renderPanel();

    expect(screen.getByTestId('panel').style.overflow).toBe('hidden');
    expect(screen.getByTestId('panel-content').parentElement?.hasAttribute('hidden')).toBe(false);
    expect(screen.queryByRole('button', { name: 'Expand panel' })).toBeNull();
  });

  it('shows collapsed affordances and expands through the panel ref', () => {
    renderPanel();

    fireEvent.click(screen.getByTestId('resize-collapsed'));

    const contentWrapper = screen.getByTestId('panel-content').parentElement;
    expect(screen.getByTestId('panel').style.overflow).toBe('visible');
    expect(contentWrapper?.getAttribute('hidden')).toBe('');

    fireEvent.click(screen.getByRole('button', { name: 'Expand panel' }));

    expect(panelMocks.handle.expand).toHaveBeenCalledTimes(1);
  });

  it("expands through the caller's panelRef when one is provided", () => {
    const externalExpand = vi.fn();
    const externalRef = { current: { expand: externalExpand } } as unknown as RefObject<PanelImperativeHandle | null>;

    render(
      <CollapsiblePanel collapsedSize={0} direction="left" minSize={280} panelRef={externalRef}>
        <div data-testid="panel-content">Panel content</div>
      </CollapsiblePanel>,
    );
    fireEvent.click(screen.getByTestId('resize-collapsed'));

    fireEvent.click(screen.getByRole('button', { name: 'Expand panel' }));

    expect(externalExpand).toHaveBeenCalledTimes(1);
    expect(panelMocks.handle.expand).not.toHaveBeenCalled();
  });

  describe('uncontrolled expand button', () => {
    it('opens at the default size when the panel mounted collapsed (e.g. after a reload)', () => {
      render(
        <CollapsiblePanel collapsedSize={0} direction="left" minSize={280} defaultSize={300}>
          <div />
        </CollapsiblePanel>,
      );
      fireEvent.click(screen.getByTestId('resize-collapsed'));

      fireEvent.click(screen.getByRole('button', { name: 'Expand panel' }));

      expect(panelMocks.handle.resize).toHaveBeenCalledWith(300);
      expect(panelMocks.handle.expand).not.toHaveBeenCalled();
    });

    it('falls back to the library expand when no default size is configured', () => {
      renderPanel();
      fireEvent.click(screen.getByTestId('resize-collapsed'));

      fireEvent.click(screen.getByRole('button', { name: 'Expand panel' }));

      expect(panelMocks.handle.expand).toHaveBeenCalledTimes(1);
      expect(panelMocks.handle.resize).not.toHaveBeenCalled();
    });
  });

  describe('controlled `collapsed`', () => {
    const renderControlled = (collapsed: boolean, onCollapsedChange = vi.fn()) => {
      const ui = (value: boolean) => (
        <CollapsiblePanel
          collapsedSize={0}
          direction="left"
          minSize={280}
          defaultSize={300}
          collapsed={value}
          onCollapsedChange={onCollapsedChange}
        >
          <div data-testid="panel-content">Panel content</div>
        </CollapsiblePanel>
      );
      const view = render(ui(collapsed));
      return { onCollapsedChange, setCollapsed: (value: boolean) => view.rerender(ui(value)) };
    };

    it('collapses the panel when asked to, remembering its width first', () => {
      const { setCollapsed } = renderControlled(false);
      panelMocks.state.size = 280; // user dragged the panel narrower than the default

      setCollapsed(true);

      expect(panelMocks.handle.collapse).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByTestId('resize-shrinking')); // the collapse animation streams widths
      fireEvent.click(screen.getByTestId('resize-collapsed'));

      setCollapsed(false);

      expect(panelMocks.handle.resize).toHaveBeenCalledWith(280);
      expect(panelMocks.handle.expand).not.toHaveBeenCalled();
    });

    it('asks the owner to expand instead of touching the panel itself', () => {
      const { onCollapsedChange } = renderControlled(true);
      fireEvent.click(screen.getByTestId('resize-collapsed'));
      onCollapsedChange.mockClear();

      fireEvent.click(screen.getByRole('button', { name: 'Expand panel' }));

      expect(onCollapsedChange).toHaveBeenCalledWith(false);
      expect(panelMocks.handle.resize).not.toHaveBeenCalled();
      expect(panelMocks.handle.expand).not.toHaveBeenCalled();
    });

    it('reports a collapse that came from the panel itself (persisted layout, drag)', () => {
      const { onCollapsedChange, setCollapsed } = renderControlled(false);

      fireEvent.click(screen.getByTestId('resize-collapsed'));

      expect(onCollapsedChange).toHaveBeenCalledWith(true);
      expect(panelMocks.handle.collapse).not.toHaveBeenCalled();

      // Once the owner syncs, nothing is re-applied and reopening uses the default size.
      setCollapsed(true);
      expect(panelMocks.handle.collapse).not.toHaveBeenCalled();
      setCollapsed(false);
      expect(panelMocks.handle.resize).toHaveBeenCalledWith(300);
    });

    it('reports an expand that came from the panel itself', () => {
      const { onCollapsedChange } = renderControlled(true);
      fireEvent.click(screen.getByTestId('resize-collapsed'));
      onCollapsedChange.mockClear();

      fireEvent.click(screen.getByTestId('resize-open'));

      expect(onCollapsedChange).toHaveBeenCalledWith(false);
    });

    it('does not report when the panel already matches', () => {
      const { onCollapsedChange } = renderControlled(false);

      fireEvent.click(screen.getByTestId('resize-open'));

      expect(onCollapsedChange).not.toHaveBeenCalled();
    });
  });
});

const collapse = () => fireEvent.click(screen.getByTestId('resize-collapsed'));

// The suite above scopes its own cleanup to its describe block.
afterEach(cleanup);

describe('CollapsiblePanel — which edge it sits on', () => {
  it('puts a left panel’s content and controls on the left', () => {
    renderPanel('left');
    const content = screen.getByTestId('panel-content').parentElement;
    expect(content?.classList.contains('left-0')).toBe(true);
    expect(content?.classList.contains('right-0')).toBe(false);

    collapse();

    expect(screen.getByRole('button', { name: 'Expand panel' }).classList.contains('left-2')).toBe(true);
  });

  it('puts a right panel’s content and controls on the right', () => {
    renderPanel('right');
    const content = screen.getByTestId('panel-content').parentElement;
    expect(content?.classList.contains('right-0')).toBe(true);
    expect(content?.classList.contains('left-0')).toBe(false);

    collapse();

    expect(screen.getByRole('button', { name: 'Expand panel' }).classList.contains('right-2')).toBe(true);
  });
});

describe('CollapsiblePanel — the panel box', () => {
  it('clips its content while open and lets the expand button out once collapsed', () => {
    renderPanel();
    const panel = screen.getByTestId('panel');
    expect(panel.style.overflow).toBe('hidden');

    collapse();

    expect(screen.getByTestId('panel').style.overflow).toBe('visible');
  });

  it('opens back up when the panel is dragged past the collapsed size', () => {
    renderPanel();
    collapse();
    expect(screen.getByRole('button', { name: 'Expand panel' })).toBeTruthy();

    fireEvent.click(screen.getByTestId('resize-open'));

    expect(screen.queryByRole('button', { name: 'Expand panel' })).toBeNull();
    expect(screen.getByTestId('panel').style.overflow).toBe('hidden');
  });

  it('holds the content at its minimum width while the panel narrows', () => {
    renderPanel();

    expect(screen.getByTestId('panel').style.getPropertyValue('--panel-min-w')).toBe('280px');
    expect(screen.getByTestId('panel-content').parentElement?.style.minWidth).toBe('var(--panel-min-w)');
  });

  it('sets no minimum width when the caller gave none in pixels', () => {
    render(
      <CollapsiblePanel collapsedSize={0} direction="left">
        <div data-testid="panel-content">Panel content</div>
      </CollapsiblePanel>,
    );

    expect(screen.getByTestId('panel').style.getPropertyValue('--panel-min-w')).toBe('');
  });

  it('keeps a caller style and class alongside its own', () => {
    render(
      <CollapsiblePanel collapsedSize={0} direction="left" className="my-own-class" style={{ zIndex: 5 }}>
        <div data-testid="panel-content">Panel content</div>
      </CollapsiblePanel>,
    );

    const panel = screen.getByTestId('panel');
    expect(panel.classList.contains('my-own-class')).toBe(true);
    expect(panel.classList.contains('relative')).toBe(true);
    expect(panel.style.zIndex).toBe('5');
  });

  it('hides the content from a screen reader while collapsed', () => {
    renderPanel();
    const content = screen.getByTestId('panel-content').parentElement;
    expect(content?.hasAttribute('hidden')).toBe(false);

    collapse();

    expect(screen.getByTestId('panel-content').parentElement?.hasAttribute('hidden')).toBe(true);
  });
});

describe('CollapsiblePanel — collapsing', () => {
  it('tells the caller about a resize before deciding anything itself', () => {
    const onResize = vi.fn();
    render(
      <CollapsiblePanel collapsedSize={0} direction="left" onResize={onResize}>
        <div data-testid="panel-content">Panel content</div>
      </CollapsiblePanel>,
    );

    collapse();

    expect(onResize).toHaveBeenCalledWith({ inPixels: 0 }, undefined, undefined);
  });

  it('never collapses when no collapsed size was set', () => {
    render(
      <CollapsiblePanel direction="left">
        <div data-testid="panel-content">Panel content</div>
      </CollapsiblePanel>,
    );

    collapse();

    expect(screen.queryByRole('button', { name: 'Expand panel' })).toBeNull();
  });

  it('collapses at exactly the collapsed size', () => {
    render(
      <CollapsiblePanel collapsedSize={0} direction="left">
        <div data-testid="panel-content">Panel content</div>
      </CollapsiblePanel>,
    );

    collapse();

    expect(screen.getByRole('button', { name: 'Expand panel' })).toBeTruthy();
  });
});

const stripElement = () => screen.getByRole('button', { name: 'Expand panel' }).nextElementSibling as HTMLElement;
const pillElement = () => stripElement().firstElementChild as HTMLElement;
