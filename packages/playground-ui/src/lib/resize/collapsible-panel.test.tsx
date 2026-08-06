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
});
