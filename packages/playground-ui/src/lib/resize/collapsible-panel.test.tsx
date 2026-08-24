// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { CSSProperties, MutableRefObject, ReactNode, Ref } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CollapsiblePanel } from './collapsible-panel';

const panelMocks = vi.hoisted(() => ({
  expand: vi.fn(),
}));

type MockPanelSize = { inPixels: number };

vi.mock('react-resizable-panels', () => ({
  usePanelRef: () => ({ current: { expand: panelMocks.expand } }),
  Panel: ({
    children,
    className,
    collapsedSize,
    elementRef,
    onResize,
    style,
  }: {
    children: ReactNode;
    className?: string;
    collapsedSize?: number;
    elementRef?: Ref<HTMLDivElement>;
    onResize?: (size: MockPanelSize, id: string | number | undefined, previousSize: MockPanelSize | undefined) => void;
    style?: CSSProperties;
  }) => {
    const assignRef = (node: HTMLDivElement | null) => {
      if (!elementRef) return;
      if (typeof elementRef === 'function') {
        elementRef(node);
        return;
      }

      (elementRef as MutableRefObject<HTMLDivElement | null>).current = node;
    };

    return (
      <section data-panel data-testid="panel" ref={assignRef} className={className} style={style}>
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
        {children}
      </section>
    );
  },
}));

const mockRect = (element: HTMLElement, rect: Partial<DOMRect>) => {
  element.getBoundingClientRect = vi.fn(
    () =>
      ({
        bottom: 100,
        height: 100,
        left: 0,
        right: 16,
        top: 0,
        width: 16,
        x: 0,
        y: 0,
        toJSON: () => {},
        ...rect,
      }) as DOMRect,
  );
};

// jsdom has no PointerEvent constructor; the production handlers only read
// MouseEvent fields, so a MouseEvent with a pointer event type is sufficient.
const pointerEvent = (type: string, init: MouseEventInit) => new MouseEvent(type, { bubbles: true, ...init });

const renderPanel = (direction: 'left' | 'right' = 'left') =>
  render(
    <div>
      {direction === 'right' && <div data-separator data-testid="separator" />}
      <CollapsiblePanel collapsedSize={0} direction={direction} minSize={280}>
        <div data-testid="panel-content">Panel content</div>
      </CollapsiblePanel>
      {direction === 'left' && <div data-separator data-testid="separator" />}
    </div>,
  );

describe('CollapsiblePanel', () => {
  beforeEach(() => {
    panelMocks.expand.mockReset();
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      writable: true,
      value: vi.fn((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      }),
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders expanded content without collapsed affordances before resize', () => {
    const { container } = renderPanel();

    expect(screen.getByTestId('panel').style.overflow).toBe('hidden');
    expect(screen.getByTestId('panel-content').parentElement?.hasAttribute('hidden')).toBe(false);
    expect(screen.queryByRole('button', { name: 'Expand panel' })).toBeNull();
    expect(container.querySelector('button[aria-hidden="true"]')).toBeNull();
  });

  it('shows collapsed affordances and expands through the panel ref', () => {
    renderPanel();

    fireEvent.click(screen.getByTestId('resize-collapsed'));

    const contentWrapper = screen.getByTestId('panel-content').parentElement;
    expect(screen.getByTestId('panel').style.overflow).toBe('visible');
    expect(contentWrapper?.getAttribute('hidden')).toBe('');

    fireEvent.click(screen.getByRole('button', { name: 'Expand panel' }));

    expect(panelMocks.expand).toHaveBeenCalledTimes(1);
  });

  it('clamps the expand pill position inside the collapsed strip', () => {
    const { container } = renderPanel();
    fireEvent.click(screen.getByTestId('resize-collapsed'));

    const strip = container.querySelector('button[aria-hidden="true"]');
    if (!(strip instanceof HTMLElement)) throw new Error('collapsed strip not rendered');
    mockRect(strip, { top: 10, height: 100 });

    fireEvent(strip, pointerEvent('pointermove', { clientY: 5 }));
    expect(strip.style.getPropertyValue('--pill-y')).toBe('22px');

    fireEvent(strip, pointerEvent('pointermove', { clientY: 200 }));
    expect(strip.style.getPropertyValue('--pill-y')).toBe('78px');
  });

  it('brings the pill to the pointer when it arrives on the strip itself', () => {
    const { container } = renderPanel();
    fireEvent.click(screen.getByTestId('resize-collapsed'));

    const strip = container.querySelector('button[aria-hidden="true"]');
    if (!(strip instanceof HTMLElement)) throw new Error('collapsed strip not rendered');
    mockRect(strip, { top: 10, height: 100 });

    // React turns a pointerover into the onPointerEnter the strip listens for.
    fireEvent(strip, pointerEvent('pointerover', { clientY: 44 }));

    expect(strip.style.getPropertyValue('--pill-y')).toBe('34px');
  });

  it('mirrors separator hover state onto the collapsed controls', () => {
    const { container } = renderPanel();
    fireEvent.click(screen.getByTestId('resize-collapsed'));

    const strip = container.querySelector('button[aria-hidden="true"]');
    if (!(strip instanceof HTMLElement)) throw new Error('collapsed strip not rendered');
    mockRect(strip, { top: 10, height: 100 });

    const separator = screen.getByTestId('separator');
    const expandButton = screen.getByRole('button', { name: 'Expand panel' });
    const pill = strip.querySelector('span');
    if (!(pill instanceof HTMLElement)) throw new Error('expand pill not rendered');

    fireEvent(separator, pointerEvent('pointerenter', { clientY: 44 }));

    expect(expandButton.dataset.edgeHovered).toBe('true');
    expect(pill.dataset.edgeHovered).toBe('true');
    expect(strip.style.getPropertyValue('--pill-y')).toBe('34px');

    fireEvent(separator, pointerEvent('pointerleave', {}));

    expect(expandButton.dataset.edgeHovered).toBe('false');
    expect(pill.dataset.edgeHovered).toBe('false');
  });

  it('follows the pointer along the separator', () => {
    const { container } = renderPanel();
    fireEvent.click(screen.getByTestId('resize-collapsed'));

    const strip = container.querySelector('button[aria-hidden="true"]');
    if (!(strip instanceof HTMLElement)) throw new Error('collapsed strip not rendered');
    mockRect(strip, { top: 10, height: 100 });

    const separator = screen.getByTestId('separator');
    fireEvent(separator, pointerEvent('pointerenter', { clientY: 44 }));
    expect(strip.style.getPropertyValue('--pill-y')).toBe('34px');

    fireEvent(separator, pointerEvent('pointermove', { clientY: 70 }));

    expect(strip.style.getPropertyValue('--pill-y')).toBe('60px');
  });

  it('measures the strip afresh the next time the pointer arrives', () => {
    const { container } = renderPanel();
    fireEvent.click(screen.getByTestId('resize-collapsed'));

    const strip = container.querySelector('button[aria-hidden="true"]');
    if (!(strip instanceof HTMLElement)) throw new Error('collapsed strip not rendered');
    const separator = screen.getByTestId('separator');

    mockRect(strip, { top: 10, height: 100 });
    fireEvent(separator, pointerEvent('pointerenter', { clientY: 44 }));
    fireEvent(separator, pointerEvent('pointerleave', {}));

    // The panel moved while the pointer was away.
    mockRect(strip, { top: 0, height: 100 });
    fireEvent(strip, pointerEvent('pointermove', { clientY: 44 }));

    expect(strip.style.getPropertyValue('--pill-y')).toBe('44px');
  });

  it('lets the pill appear where the pointer is, then travel with it', () => {
    const frames: FrameRequestCallback[] = [];
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      writable: true,
      value: (callback: FrameRequestCallback) => {
        frames.push(callback);
        return frames.length;
      },
    });

    const { container } = renderPanel();
    fireEvent.click(screen.getByTestId('resize-collapsed'));

    const strip = container.querySelector('button[aria-hidden="true"]');
    if (!(strip instanceof HTMLElement)) throw new Error('collapsed strip not rendered');
    const pill = strip.querySelector('span');
    if (!(pill instanceof HTMLElement)) throw new Error('expand pill not rendered');
    mockRect(strip, { top: 10, height: 100 });

    fireEvent(screen.getByTestId('separator'), pointerEvent('pointerenter', { clientY: 44 }));

    // It fades in where the pointer already is, rather than sliding over.
    expect(pill.style.transitionProperty).toBe('opacity, translate');

    frames.forEach(frame => frame(0));

    expect(pill.style.transitionProperty).toBe('');
  });

  it('lets go of the separator once the panel opens again', () => {
    renderPanel();
    fireEvent.click(screen.getByTestId('resize-collapsed'));

    const separator = screen.getByTestId('separator');
    const removeEventListener = vi.spyOn(separator, 'removeEventListener');

    fireEvent.click(screen.getByTestId('resize-open'));

    const events = removeEventListener.mock.calls.map(([type]) => type);
    expect(events).toEqual(expect.arrayContaining(['pointerenter', 'pointerleave', 'pointermove']));
  });

  it('forgets the edge it was watching when the panel changes sides', () => {
    const panelBetweenSeparators = (direction: 'left' | 'right') => (
      <div>
        <div data-separator data-testid="separator-before" />
        <CollapsiblePanel collapsedSize={0} direction={direction} minSize={280}>
          <div data-testid="panel-content">Panel content</div>
        </CollapsiblePanel>
        <div data-separator data-testid="separator-after" />
      </div>
    );

    const { rerender } = render(panelBetweenSeparators('left'));
    fireEvent.click(screen.getByTestId('resize-collapsed'));

    const strip = screen.getByRole('button', { name: 'Expand panel' }).nextElementSibling as HTMLElement;
    mockRect(strip, { top: 10, height: 100 });
    fireEvent(screen.getByTestId('separator-after'), pointerEvent('pointerenter', { clientY: 44 }));
    expect(screen.getByRole('button', { name: 'Expand panel' }).dataset.edgeHovered).toBe('true');

    rerender(panelBetweenSeparators('right'));

    expect(screen.getByRole('button', { name: 'Expand panel' }).dataset.edgeHovered).toBe('false');

    // And it takes a fresh measurement rather than trusting the old one.
    mockRect(strip, { top: 0, height: 100 });
    fireEvent(strip, pointerEvent('pointermove', { clientY: 44 }));
    expect(strip.style.getPropertyValue('--pill-y')).toBe('44px');
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

  it('watches the separator on the side it sits on', () => {
    const { container } = renderPanel('right');
    collapse();

    const strip = container.querySelector('button[aria-hidden="true"]');
    if (!(strip instanceof HTMLElement)) throw new Error('collapsed strip not rendered');
    mockRect(strip, { top: 10, height: 100 });

    fireEvent(screen.getByTestId('separator'), pointerEvent('pointerenter', { clientY: 44 }));

    expect(screen.getByRole('button', { name: 'Expand panel' }).dataset.edgeHovered).toBe('true');
    expect(strip.style.getPropertyValue('--pill-y')).toBe('34px');
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
  it('clips its content while open and lets the pill out once collapsed', () => {
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

describe('CollapsiblePanel — the collapsed strip', () => {
  it('keeps the strip out of the tab order and the accessibility tree', () => {
    renderPanel();
    collapse();

    const strip = screen.getByRole('button', { name: 'Expand panel' }).nextElementSibling as HTMLElement;
    expect(strip.getAttribute('tabindex')).toBe('-1');
    expect(strip.getAttribute('aria-hidden')).toBe('true');
  });

  it('opens the panel from the strip as well as the button', () => {
    renderPanel();
    collapse();

    const strip = screen.getByRole('button', { name: 'Expand panel' }).nextElementSibling as HTMLElement;
    fireEvent.click(strip);

    expect(panelMocks.expand).toHaveBeenCalledTimes(1);
  });

  it('parks the pill mid-strip until the pointer says otherwise', () => {
    renderPanel();
    collapse();

    const strip = screen.getByRole('button', { name: 'Expand panel' }).nextElementSibling as HTMLElement;
    expect(strip.style.getPropertyValue('--pill-y')).toBe('50%');
  });

  it('points the pill back towards the content it would reveal', () => {
    renderPanel('left');
    collapse();
    const leftStrip = stripElement();
    expect(leftStrip.firstElementChild?.classList.contains('left-0.5')).toBe(true);
    // The strip hugs the same edge as the panel it opens.
    expect(leftStrip.classList.contains('left-1')).toBe(true);
    expect(leftStrip.querySelector('svg')?.classList.contains('lucide-chevron-right')).toBe(true);

    cleanup();

    renderPanel('right');
    collapse();
    const rightStrip = stripElement();
    expect(rightStrip.firstElementChild?.classList.contains('right-0.5')).toBe(true);
    expect(rightStrip.classList.contains('right-1')).toBe(true);
    expect(rightStrip.querySelector('svg')?.classList.contains('lucide-chevron-left')).toBe(true);
  });

  it('rides the pill up and down on a custom property', () => {
    renderPanel();
    collapse();

    expect(pillElement().style.top).toBe('var(--pill-y)');
  });
});
