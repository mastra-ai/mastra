import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkflowLayout, WorkflowPanelResizeHandle } from '../workflow-layout';

const STORAGE_KEY = 'workflow-canvas-left-panel-width';

function renderLayout() {
  return render(
    <WorkflowLayout
      leftSlot={
        <div>
          runs
          <WorkflowPanelResizeHandle />
        </div>
      }
    >
      <div>canvas</div>
    </WorkflowLayout>,
  );
}

function canvasInsetOf(container: HTMLElement) {
  return container.firstElementChild?.getAttribute('style');
}

function dragHandleTo(handle: HTMLElement, clientX: number) {
  handle.setPointerCapture = vi.fn();
  handle.hasPointerCapture = vi.fn(() => true);
  fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 380 });
  fireEvent.pointerMove(handle, { pointerId: 1, clientX });
}

describe('WorkflowLayout', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      width: 1200,
      top: 0,
      right: 1200,
      bottom: 800,
      height: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('opens at the stored width and offsets the canvas by the panel edge', () => {
    localStorage.setItem(STORAGE_KEY, '500');
    const { container } = renderLayout();

    expect(screen.getByText('runs').parentElement?.style.width).toBe('500px');
    expect(canvasInsetOf(container)).toContain('--workflow-left-panel-width: 492px');
  });

  it('resizes the panel from its own handle and remembers the width', () => {
    renderLayout();
    const handle = screen.getByRole('separator', { name: 'Resize panel' });

    dragHandleTo(handle, 450);

    expect(handle.getAttribute('aria-valuenow')).toBe('450');
    expect(screen.getByText('runs').parentElement?.style.width).toBe('450px');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('450');
  });

  it('keeps the panel between its minimum width and half the canvas', () => {
    renderLayout();
    const handle = screen.getByRole('separator', { name: 'Resize panel' });

    dragHandleTo(handle, 100);
    expect(handle.getAttribute('aria-valuenow')).toBe('380');

    dragHandleTo(handle, 900);
    expect(handle.getAttribute('aria-valuenow')).toBe('600');
  });

  it('nudges the width with the arrow keys', () => {
    renderLayout();
    const handle = screen.getByRole('separator', { name: 'Resize panel' });

    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(handle.getAttribute('aria-valuenow')).toBe('396');

    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    expect(handle.getAttribute('aria-valuenow')).toBe('380');
  });
});
