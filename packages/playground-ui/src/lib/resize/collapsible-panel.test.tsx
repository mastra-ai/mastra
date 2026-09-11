// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps, CSSProperties, ReactNode, RefObject } from 'react';
import { createRef } from 'react';
import type { PanelImperativeHandle } from 'react-resizable-panels';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CollapsiblePanelHandle } from './collapsible-panel';
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

type HarnessProps = Partial<ComponentProps<typeof CollapsiblePanel>>;

const Harness = ({ children, ...props }: HarnessProps) => (
  <CollapsiblePanel collapsedSize={0} direction="left" {...props}>
    {children ?? <div data-testid="panel-content">Panel content</div>}
  </CollapsiblePanel>
);

const renderPanel = (direction: 'left' | 'right' = 'left') => render(<Harness direction={direction} minSize={280} />);

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

  it('shows collapsed affordances once the panel reports itself collapsed', () => {
    renderPanel();

    fireEvent.click(screen.getByTestId('resize-collapsed'));

    const contentWrapper = screen.getByTestId('panel-content').parentElement;
    expect(screen.getByTestId('panel').style.overflow).toBe('visible');
    expect(contentWrapper?.getAttribute('hidden')).toBe('');
  });

  it("drives the caller's panelRef when one is provided", () => {
    const externalResize = vi.fn();
    const externalRef = {
      current: { resize: externalResize, getSize: () => ({ inPixels: 300 }) },
    } as unknown as RefObject<PanelImperativeHandle | null>;

    render(<Harness minSize={280} defaultSize={300} panelRef={externalRef} />);
    fireEvent.click(screen.getByTestId('resize-collapsed'));

    fireEvent.click(screen.getByRole('button', { name: 'Expand panel' }));

    expect(externalResize).toHaveBeenCalledWith(300);
    expect(panelMocks.handle.resize).not.toHaveBeenCalled();
  });

  describe('expand button', () => {
    it('opens at the default size when the panel mounted collapsed (e.g. after a reload)', () => {
      render(<Harness minSize={280} defaultSize={300} />);
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

  describe('handle', () => {
    const renderWithHandle = (props: HarnessProps = {}) => {
      const handle = createRef<CollapsiblePanelHandle>();
      render(<Harness ref={handle} minSize={280} defaultSize={300} {...props} />);
      return handle;
    };

    it('collapses the panel, remembering its width first', () => {
      const handle = renderWithHandle();
      panelMocks.state.size = 280; // user dragged the panel narrower than the default

      act(() => handle.current?.collapse());

      expect(panelMocks.handle.collapse).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByTestId('resize-shrinking')); // the collapse animation streams widths
      fireEvent.click(screen.getByTestId('resize-collapsed'));

      act(() => handle.current?.expand());

      expect(panelMocks.handle.resize).toHaveBeenCalledWith(280);
      expect(panelMocks.handle.expand).not.toHaveBeenCalled();
    });

    it('reopens at the default size when the collapse came from the panel itself (persisted layout, drag)', () => {
      const handle = renderWithHandle();
      fireEvent.click(screen.getByTestId('resize-collapsed'));

      act(() => handle.current?.expand());

      expect(panelMocks.handle.resize).toHaveBeenCalledWith(300);
    });

    it('falls back to the library expand when nothing better is known', () => {
      const handle = renderWithHandle({ defaultSize: undefined });
      fireEvent.click(screen.getByTestId('resize-collapsed'));

      act(() => handle.current?.expand());

      expect(panelMocks.handle.expand).toHaveBeenCalledTimes(1);
      expect(panelMocks.handle.resize).not.toHaveBeenCalled();
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
    render(<Harness />);

    expect(screen.getByTestId('panel').style.getPropertyValue('--panel-min-w')).toBe('');
  });

  it('keeps a caller style and class alongside its own', () => {
    render(<Harness className="my-own-class" style={{ zIndex: 5 }} />);

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
    render(<Harness onResize={onResize} />);

    collapse();

    expect(onResize).toHaveBeenCalledWith({ inPixels: 0 }, undefined, undefined);
  });

  it('never collapses when no collapsed size was set', () => {
    render(<Harness collapsedSize={undefined} />);

    collapse();

    expect(screen.queryByRole('button', { name: 'Expand panel' })).toBeNull();
  });

  it('collapses at exactly the collapsed size', () => {
    render(<Harness />);

    collapse();

    expect(screen.getByRole('button', { name: 'Expand panel' })).toBeTruthy();
  });
});
