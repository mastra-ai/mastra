/**
 * Mouse support scoped to where Mastra Code owns the interaction: capturing
 * modal overlays and the slash autocomplete list. Mouse tracking is enabled
 * only while one of those is on screen, so the transcript keeps native wheel
 * scrollback and text selection the rest of the time.
 *
 * - Wheel events become ↑/↓ key input for whichever component has focus.
 * - Left clicks on a modal activate the target found by walking the component
 *   tree (locate). Pointer motion (hover) marks that same target's rows with an
 *   accent bar, so it shows what a click there would pick without changing the
 *   selection. The marker is recomputed on every render, so it stays under the
 *   pointer when the list scrolls.
 * - Every pointer event is mapped through a cursor position report: the
 *   terminal says where the hardware cursor really is, so rows line up with
 *   the rendered frame even when the screen is offset from pi-tui's model.
 *   Autocomplete rows are resolved relative to the cursor; modals are shifted
 *   by the measured offset.
 */
import type { Component, TUI } from '@earendil-works/pi-tui';

import type { CustomEditor } from '../components/custom-editor.js';
import { locate } from './hit-test.js';
import { markHoveredRows } from './hover-marker.js';
import { tuiInternals } from './pi-tui-internals.js';
import type { OverlayEntry } from './pi-tui-internals.js';
import type { TerminalMouseEvent } from './sgr.js';
import { isMouseReport, parseCursorPositionReport, parseSgrMouse } from './sgr.js';

// 1000: press/release and wheel; 1003: also pointer motion (for hover); 1006: SGR encoding.
export const ENABLE_MOUSE_TRACKING = '\x1b[?1000h\x1b[?1003h\x1b[?1006h';
export const DISABLE_MOUSE_TRACKING = '\x1b[?1003l\x1b[?1000l\x1b[?1006l';
export const REQUEST_CURSOR_POSITION = '\x1b[6n';

const WHEEL_UP_KEY = '\x1b[A';
const WHEEL_DOWN_KEY = '\x1b[B';
const CURSOR_POSITION_TIMEOUT_MS = 200;

type MouseAction = 'click' | 'hover';

export class MouseController {
  private tracking = false;
  /** Pointer event waiting for the cursor position reply that maps it to a frame row (one query at a time). */
  private pendingPointer:
    | { event: TerminalMouseEvent; action: MouseAction; timer: ReturnType<typeof setTimeout> }
    | undefined;
  private lastHoverCell: string | undefined;
  /** Pointer position local to the hovered overlay component. */
  private overlayHover: { component: Component; row: number; col: number } | undefined;
  private readonly decoratedRenders = new Map<Component, Component['render']>();
  private readonly removeInputListener: () => void;
  private readonly originalDoRender: () => void;
  private readonly originalStop: () => void;
  private readonly onProcessExit = () => {
    // Synchronous last resort so a crash never leaves the shell receiving mouse reports.
    if (this.tracking) process.stdout.write(DISABLE_MOUSE_TRACKING);
  };

  constructor(
    private readonly ui: TUI,
    private readonly editor: CustomEditor,
  ) {
    this.removeInputListener = ui.addInputListener(data => this.handleInput(data));

    const internals = tuiInternals(ui);
    this.originalDoRender = internals.doRender;
    internals.doRender = () => {
      this.originalDoRender.call(ui);
      this.syncTracking();
    };

    // Covers app shutdown and Ctrl+Z suspend; tracking is re-armed by the next render after start().
    this.originalStop = ui.stop;
    ui.stop = () => {
      this.setTracking(false);
      this.originalStop.call(ui);
    };

    process.on('exit', this.onProcessExit);
  }

  dispose(): void {
    this.setTracking(false);
    this.clearPendingPointer();
    this.removeInputListener();
    for (const [component, render] of this.decoratedRenders) component.render = render;
    this.decoratedRenders.clear();
    tuiInternals(this.ui).doRender = this.originalDoRender;
    this.ui.stop = this.originalStop;
    process.off('exit', this.onProcessExit);
  }

  private wantsTracking(): boolean {
    return tuiInternals(this.ui).getTopmostVisibleOverlay() !== undefined || this.editor.isShowingAutocomplete();
  }

  private syncTracking(): void {
    this.setTracking(this.wantsTracking());
  }

  private setTracking(enabled: boolean): void {
    if (this.tracking === enabled) return;
    this.tracking = enabled;
    this.lastHoverCell = undefined;
    this.overlayHover = undefined;
    this.ui.terminal.write(enabled ? ENABLE_MOUSE_TRACKING : DISABLE_MOUSE_TRACKING);
  }

  private handleInput(data: string): { consume?: boolean; data?: string } | undefined {
    if (this.pendingPointer) {
      const position = parseCursorPositionReport(data);
      if (position) {
        const { event, action } = this.pendingPointer;
        this.clearPendingPointer();
        this.resolvePointer(event, action, position.row);
        return { consume: true };
      }
    }

    if (!isMouseReport(data)) return undefined;
    const event = parseSgrMouse(data);
    if (!event) return { consume: true };

    if (event.kind === 'wheelUp') return { data: WHEEL_UP_KEY };
    if (event.kind === 'wheelDown') return { data: WHEEL_DOWN_KEY };
    if (event.kind === 'press' && event.button === 0) this.handlePointer(event, 'click');
    if (event.kind === 'move') {
      // Terminals repeat motion reports within a cell; only act when the pointer changes cell.
      const cell = `${event.row}:${event.col}`;
      if (cell !== this.lastHoverCell) {
        this.lastHoverCell = cell;
        this.handlePointer(event, 'hover');
      }
    }
    return { consume: true };
  }

  /**
   * Pointer rows are mapped through a cursor position query: the terminal
   * reports where the cursor really is, which corrects for any offset between
   * pi-tui's model of the screen and the real one (for example a frame that no
   * longer reaches the bottom of the screen, or a multiplexer pane offset).
   */
  private handlePointer(event: TerminalMouseEvent, action: MouseAction): void {
    const overlay = tuiInternals(this.ui).getTopmostVisibleOverlay();
    if (!overlay && !this.editor.isShowingAutocomplete()) return;

    const pending = this.pendingPointer;
    if (pending) {
      // One cursor query at a time: a newer hover replaces the queued one, a click wins over hover.
      if (action === 'click' || pending.action === 'hover') this.pendingPointer = { ...pending, event, action };
      return;
    }
    const timer = setTimeout(() => {
      const timedOut = this.pendingPointer;
      this.clearPendingPointer();
      // Without a reply, modals fall back to assuming the frame is bottom-aligned with the screen.
      if (timedOut) this.resolvePointer(timedOut.event, timedOut.action, undefined);
    }, CURSOR_POSITION_TIMEOUT_MS);
    this.pendingPointer = { event, action, timer };
    this.ui.terminal.write(REQUEST_CURSOR_POSITION);
  }

  private resolvePointer(event: TerminalMouseEvent, action: MouseAction, cursorRow: number | undefined): void {
    const overlay = tuiInternals(this.ui).getTopmostVisibleOverlay();
    if (overlay) {
      const shifted = { ...event, row: event.row - (cursorRow === undefined ? 0 : this.overlayRowShift(cursorRow)) };
      // Pointer events outside the modal are ignored; the modal stays in control.
      if (action === 'click') {
        const target = this.locateInOverlay(overlay, shifted)?.target;
        if (target) {
          target.activate();
          this.ui.requestRender();
        }
      } else {
        this.hoverOverlay(overlay, shifted);
      }
      return;
    }
    if (cursorRow === undefined || !this.editor.isShowingAutocomplete()) return;
    if (this.editor.pointAutocompleteRow(event.row - cursorRow, action)) this.ui.requestRender();
  }

  /**
   * How far the real screen is offset from where TUI.compositeOverlays places
   * overlays (it assumes the last frame line is the bottom screen row).
   */
  private overlayRowShift(cursorRow: number): number {
    const internals = tuiInternals(this.ui);
    const viewportStart = Math.max(0, internals.previousLines.length - this.ui.terminal.rows);
    const expectedCursorRow = internals.hardwareCursorRow - viewportStart + 1;
    return cursorRow - expectedCursorRow;
  }

  /**
   * Converts a screen position to a position inside the overlay. Mirrors
   * TUI.compositeOverlays: overlays are placed at screen-relative rows in the
   * visible viewport.
   */
  private locateInOverlay(overlay: OverlayEntry, event: TerminalMouseEvent) {
    const internals = tuiInternals(this.ui);
    const { columns, rows } = this.ui.terminal;
    const { width, maxHeight } = internals.resolveOverlayLayout(overlay.options, 0, columns, rows);
    let height = overlay.component.render(width).length;
    if (maxHeight !== undefined) height = Math.min(height, maxHeight);
    const { row, col } = internals.resolveOverlayLayout(overlay.options, height, columns, rows);

    const point = { row: event.row - 1 - row, col: event.col - 1 - col, width };
    if (point.row >= height) return undefined;
    return { point, target: locate(overlay.component, point) };
  }

  private hoverOverlay(overlay: OverlayEntry, event: TerminalMouseEvent): void {
    const located = this.locateInOverlay(overlay, event);
    const previous = this.overlayHover;
    this.overlayHover = located && { component: overlay.component, row: located.point.row, col: located.point.col };
    if (this.overlayHover) this.decorateRender(overlay.component);
    if (previous || this.overlayHover) this.ui.requestRender();
  }

  /** Wraps an overlay's render once so the hover marker is redrawn from the current pointer position every frame. */
  private decorateRender(component: Component): void {
    if (this.decoratedRenders.has(component)) return;
    const render = component.render;
    this.decoratedRenders.set(component, render);
    component.render = (width: number) => {
      const lines = render.call(component, width);
      const hover = this.overlayHover;
      if (hover?.component !== component) return lines;
      const target = locate(component, { row: hover.row, col: hover.col, width });
      return target ? markHoveredRows(lines, target.top, target.height) : lines;
    };
  }

  private clearPendingPointer(): void {
    if (!this.pendingPointer) return;
    clearTimeout(this.pendingPointer.timer);
    this.pendingPointer = undefined;
  }
}
