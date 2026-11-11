/**
 * Mouse support scoped to where Mastra Code owns the interaction: capturing
 * modal overlays and the slash autocomplete list (opt-in through the
 * `mouseDialogs` setting). Mouse tracking is enabled only while one of those
 * is on screen, so the transcript keeps native wheel scrollback and text
 * selection the rest of the time.
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
 *
 * Input mouse mode (opt-in through the `mouseInput` setting) also
 * captures the mouse while no dialog is open, for the input box: a press
 * places the cursor, a drag selects, and the release copies the selection
 * through OSC 52. It turns on when you type or edit in the input box and off
 * on submit, on the first wheel tick, on a click outside the input box, or on
 * a mouse report we can't decode, so the terminal gets its wheel scrollback
 * and text selection back as soon as you reach for them. The terminal can't
 * report clicks without also taking the wheel, so the tick or click that turns
 * it off is used up.
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
/** After this many unanswered queries in a row, stop expecting replies (the terminal doesn't answer). */
const MAX_UNANSWERED_CURSOR_QUERIES = 3;

type MouseAction = 'click' | 'hover' | 'inputPress';

function osc52Copy(text: string): string {
  return `\x1b]52;c;${Buffer.from(text, 'utf8').toString('base64')}\x07`;
}

export class MouseController {
  private tracking = false;
  /** Pointer event waiting for the cursor position reply that maps it to a frame row (one query at a time). */
  private pendingPointer:
    | {
        event: TerminalMouseEvent;
        action: MouseAction;
        timer: ReturnType<typeof setTimeout>;
        /** The dialog on top when the event arrived; the event is dropped if another replaces it. */
        overlay: Component | undefined;
        /** Where pi-tui expected the cursor when the query went out; the reply describes that frame. */
        expectedCursorRow: number;
      }
    | undefined;
  private lastHoverCell: string | undefined;
  /** Whether the user opted in to mouse support for dialogs and slash suggestions in /settings. */
  private dialogMouseEnabled: boolean;
  /** Whether the user opted in to input mouse mode in /settings. */
  private inputMouseModeEnabled: boolean;
  /** Whether input mouse mode is currently capturing the mouse. */
  private inputMouseMode = false;
  /**
   * Input box drag: 'pending' while the press waits for its cursor position
   * reply (drag/release reports are queued until then), 'active' once placed.
   */
  private inputDrag: 'pending' | 'active' | undefined;
  private queuedDrag: TerminalMouseEvent | undefined;
  private queuedRelease: TerminalMouseEvent | undefined;
  /** Called when mouse mode turns on or off, or the setting changes (for the status line). */
  onInputMouseModeChange?: () => void;
  /** Pointer position local to the hovered overlay component. */
  private overlayHover: { component: Component; row: number; col: number } | undefined;
  private readonly decoratedRenders = new Map<Component, Component['render']>();
  private outstandingCursorQueries = 0;
  private unansweredCursorQueries = 0;
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
    options: { dialogMouseEnabled?: boolean; inputMouseModeEnabled?: boolean } = {},
  ) {
    this.dialogMouseEnabled = options.dialogMouseEnabled ?? false;
    this.inputMouseModeEnabled = options.inputMouseModeEnabled ?? false;
    this.removeInputListener = ui.addInputListener(data => this.handleInput(data));
    editor.onAction('editInput', () => {
      this.setInputMouseMode(true);
    });

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

  isInputMouseMode(): boolean {
    return this.inputMouseMode;
  }

  isInputMouseModeEnabled(): boolean {
    return this.inputMouseModeEnabled;
  }

  /** Applies the /settings opt-in; turning it off also releases the mouse. */
  setInputMouseModeEnabled(enabled: boolean): void {
    if (this.inputMouseModeEnabled === enabled) return;
    this.inputMouseModeEnabled = enabled;
    if (!enabled) this.setInputMouseMode(false);
    this.onInputMouseModeChange?.();
  }

  /** Applies the /settings opt-in for dialogs and slash suggestions. */
  setDialogMouseEnabled(enabled: boolean): void {
    if (this.dialogMouseEnabled === enabled) return;
    this.dialogMouseEnabled = enabled;
    // The render re-syncs tracking for whatever is on screen.
    this.ui.requestRender();
  }

  setInputMouseMode(enabled: boolean): void {
    if (enabled && !this.inputMouseModeEnabled) return;
    if (this.inputMouseMode === enabled) return;
    this.inputMouseMode = enabled;
    if (!enabled) {
      this.endInputDrag();
      this.editor.clearInputSelection();
    }
    this.syncTracking();
    this.onInputMouseModeChange?.();
    this.ui.requestRender();
  }

  private wantsTracking(): boolean {
    return this.inputOwnsPointer() || this.dialogOverlay() !== undefined || this.suggestionsOwnPointer();
  }

  /** The topmost dialog, when dialogs are opted in to mouse support. */
  private dialogOverlay(): OverlayEntry | undefined {
    return this.dialogMouseEnabled ? tuiInternals(this.ui).getTopmostVisibleOverlay() : undefined;
  }

  /** True when the slash suggestion list is open and opted in to mouse support. */
  private suggestionsOwnPointer(): boolean {
    return this.dialogMouseEnabled && this.editor.isShowingAutocomplete();
  }

  private topOverlayComponent(): Component | undefined {
    return tuiInternals(this.ui).getTopmostVisibleOverlay()?.component;
  }

  /** True when pointer events belong to the input box rather than a dialog or suggestion list. */
  private inputOwnsPointer(): boolean {
    return this.inputMouseMode && tuiInternals(this.ui).getTopmostVisibleOverlay() === undefined;
  }

  private endInputDrag(): void {
    this.inputDrag = undefined;
    this.queuedDrag = undefined;
    this.queuedRelease = undefined;
  }

  private dragInput(event: TerminalMouseEvent): void {
    if (this.editor.pointerDrag(event.row, event.col)) this.ui.requestRender();
  }

  private releaseInput(event: TerminalMouseEvent): void {
    this.endInputDrag();
    const selected = this.editor.pointerRelease(event.row, event.col);
    if (selected) this.ui.terminal.write(osc52Copy(selected));
    this.ui.requestRender();
  }

  private syncTracking(): void {
    // Closed dialogs would otherwise stay referenced (with all their data) until exit.
    const top = tuiInternals(this.ui).getTopmostVisibleOverlay()?.component;
    for (const [component, render] of this.decoratedRenders) {
      if (component === top) continue;
      component.render = render;
      this.decoratedRenders.delete(component);
    }
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
    if (this.outstandingCursorQueries > 0) {
      const position = parseCursorPositionReport(data);
      if (position) {
        // Swallow every reply we asked for, including ones that arrive after the timeout:
        // left unconsumed they reach the focused component as keys (row 1 looks like a modified F3).
        this.outstandingCursorQueries--;
        this.unansweredCursorQueries = 0;
        const pending = this.pendingPointer;
        if (pending) {
          this.clearPendingPointer();
          this.resolvePointer(pending, position.row);
        }
        return { consume: true };
      }
    }

    // Reports we didn't ask for (e.g. another program left tracking on) pass through untouched;
    // pi-tui ignores them, so Mouse set to Off behaves exactly as if this controller weren't here.
    if (!this.tracking || !isMouseReport(data)) return undefined;
    const event = parseSgrMouse(data);
    if (!event) {
      // A report we can't decode (e.g. a terminal without SGR mouse support) would leave
      // the input box capturing a mouse that does nothing, so hand it back to the terminal.
      if (this.inputOwnsPointer()) this.setInputMouseMode(false);
      return { consume: true };
    }

    const inputOwnsPointer = this.inputOwnsPointer();
    if (event.kind === 'wheelUp' || event.kind === 'wheelDown') {
      // Outside dialogs and suggestions, the first tick hands the wheel back to the terminal.
      if (inputOwnsPointer && !this.suggestionsOwnPointer()) {
        this.setInputMouseMode(false);
        return { consume: true };
      }
      return { data: event.kind === 'wheelUp' ? WHEEL_UP_KEY : WHEEL_DOWN_KEY };
    }
    if (event.kind === 'press' && event.button === 0) {
      if (inputOwnsPointer) {
        this.endInputDrag();
        this.inputDrag = 'pending';
        this.handlePointer(event, 'inputPress');
      } else {
        this.handlePointer(event, 'click');
      }
    }
    if (inputOwnsPointer && event.button === 0 && (event.kind === 'drag' || event.kind === 'release')) {
      if (this.inputDrag === 'pending') {
        if (event.kind === 'drag') this.queuedDrag = event;
        else this.queuedRelease = event;
      } else if (this.inputDrag === 'active') {
        if (event.kind === 'drag') this.dragInput(event);
        else this.releaseInput(event);
      }
    }
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
    if (!this.dialogOverlay() && !this.suggestionsOwnPointer() && action !== 'inputPress') return;

    const pending = this.pendingPointer;
    if (pending) {
      // One cursor query at a time: a newer hover replaces the queued one, a click wins over hover.
      if (action !== 'hover' || pending.action === 'hover') {
        this.pendingPointer = { ...pending, event, action, overlay: this.topOverlayComponent() };
      }
      return;
    }
    const timer = setTimeout(() => {
      const timedOut = this.pendingPointer;
      this.clearPendingPointer();
      // Otherwise a terminal that never answers leaves us eating keys shaped like replies (Shift+F3).
      if (++this.unansweredCursorQueries >= MAX_UNANSWERED_CURSOR_QUERIES) this.outstandingCursorQueries = 0;
      // Without a reply, modals fall back to assuming the frame is bottom-aligned with the screen.
      if (timedOut) this.resolvePointer(timedOut, undefined);
    }, CURSOR_POSITION_TIMEOUT_MS);
    this.pendingPointer = {
      event,
      action,
      timer,
      overlay: this.topOverlayComponent(),
      expectedCursorRow: this.expectedCursorRow(),
    };
    this.outstandingCursorQueries++;
    this.ui.terminal.write(REQUEST_CURSOR_POSITION);
  }

  private resolvePointer(
    {
      event,
      action,
      overlay: origin,
      expectedCursorRow,
    }: { event: TerminalMouseEvent; action: MouseAction; overlay: Component | undefined; expectedCursorRow: number },
    cursorRow: number | undefined,
  ): void {
    // Keys aren't held up by the cursor query, so a dialog can close or open while it's in flight
    // (e.g. Esc); applying the event then would hit whatever is now on screen at that spot.
    if (this.topOverlayComponent() !== origin) {
      if (action === 'inputPress') this.endInputDrag();
      return;
    }
    if (action === 'inputPress') {
      this.resolveInputPress(event, cursorRow);
      return;
    }
    const overlay = this.dialogOverlay();
    if (overlay) {
      const shifted = { ...event, row: event.row - (cursorRow === undefined ? 0 : cursorRow - expectedCursorRow) };
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
    if (cursorRow === undefined || !this.suggestionsOwnPointer()) return;
    if (this.editor.pointAutocompleteRow(event.row - cursorRow, action)) this.ui.requestRender();
  }

  private resolveInputPress(event: TerminalMouseEvent, cursorRow: number | undefined): void {
    // Input positions are relative to the cursor, so without a reply (or with a dialog opened since) drop the press.
    if (cursorRow === undefined || !this.inputOwnsPointer() || this.inputDrag !== 'pending') {
      this.endInputDrag();
      return;
    }
    if (this.suggestionsOwnPointer() && this.editor.pointAutocompleteRow(event.row - cursorRow, 'click')) {
      this.endInputDrag();
      this.ui.requestRender();
      return;
    }
    const hit = this.editor.pointerPress(cursorRow, event.row, event.col, event.shift);
    if (hit !== 'text') {
      this.endInputDrag();
      // A click outside the input box hands the mouse back to the terminal.
      if (hit === 'outside') this.setInputMouseMode(false);
      return;
    }
    const { queuedDrag, queuedRelease } = this;
    this.inputDrag = 'active';
    this.queuedDrag = undefined;
    this.queuedRelease = undefined;
    if (queuedDrag) this.dragInput(queuedDrag);
    if (queuedRelease) this.releaseInput(queuedRelease);
    this.ui.requestRender();
  }

  /**
   * The screen row pi-tui believes the cursor is on, assuming the last frame line is the
   * bottom screen row as TUI.compositeOverlays does. A cursor reply minus this is how far the
   * real screen is offset from where overlays are drawn.
   */
  private expectedCursorRow(): number {
    const internals = tuiInternals(this.ui);
    const viewportStart = Math.max(0, internals.previousLines.length - this.ui.terminal.rows);
    return internals.hardwareCursorRow - viewportStart + 1;
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
