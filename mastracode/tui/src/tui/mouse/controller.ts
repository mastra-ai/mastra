/**
 * Mouse support scoped to where Mastra Code owns the interaction: capturing
 * modal overlays and the slash autocomplete list. Mouse tracking is enabled
 * only while one of those is on screen, so the transcript keeps native wheel
 * scrollback and text selection the rest of the time.
 *
 * - Wheel events become ↑/↓ key input for whichever component has focus.
 * - Left clicks on a modal are routed through the component tree (dispatchClick).
 * - Left clicks on autocomplete rows are resolved relative to the hardware
 *   cursor, whose screen row is learned with a cursor position report.
 */
import type { TUI } from '@earendil-works/pi-tui';

import type { CustomEditor } from '../components/custom-editor.js';
import { dispatchClick } from './hit-test.js';
import { tuiInternals } from './pi-tui-internals.js';
import type { OverlayEntry } from './pi-tui-internals.js';
import type { TerminalMouseEvent } from './sgr.js';
import { isMouseReport, parseCursorPositionReport, parseSgrMouse } from './sgr.js';

// 1000: report button press/release and wheel (no motion); 1006: SGR encoding.
export const ENABLE_MOUSE_TRACKING = '\x1b[?1000h\x1b[?1006h';
export const DISABLE_MOUSE_TRACKING = '\x1b[?1000l\x1b[?1006l';
export const REQUEST_CURSOR_POSITION = '\x1b[6n';

const WHEEL_UP_KEY = '\x1b[A';
const WHEEL_DOWN_KEY = '\x1b[B';
const CURSOR_POSITION_TIMEOUT_MS = 200;

export class MouseController {
  private tracking = false;
  private pendingAutocompleteClick: { event: TerminalMouseEvent; timer: ReturnType<typeof setTimeout> } | undefined;
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
    this.clearPendingClick();
    this.removeInputListener();
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
    this.ui.terminal.write(enabled ? ENABLE_MOUSE_TRACKING : DISABLE_MOUSE_TRACKING);
  }

  private handleInput(data: string): { consume?: boolean; data?: string } | undefined {
    if (this.pendingAutocompleteClick) {
      const position = parseCursorPositionReport(data);
      if (position) {
        const { event } = this.pendingAutocompleteClick;
        this.clearPendingClick();
        if (this.editor.clickAutocompleteRow(event.row - position.row)) this.ui.requestRender();
        return { consume: true };
      }
    }

    if (!isMouseReport(data)) return undefined;
    const event = parseSgrMouse(data);
    if (!event) return { consume: true };

    if (event.kind === 'wheelUp') return { data: WHEEL_UP_KEY };
    if (event.kind === 'wheelDown') return { data: WHEEL_DOWN_KEY };
    if (event.kind === 'press' && event.button === 0) this.handleClick(event);
    return { consume: true };
  }

  private handleClick(event: TerminalMouseEvent): void {
    const overlay = tuiInternals(this.ui).getTopmostVisibleOverlay();
    if (overlay) {
      // Clicks outside the modal are ignored; the modal stays in control.
      if (this.clickOverlay(overlay, event)) this.ui.requestRender();
      return;
    }
    if (!this.editor.isShowingAutocomplete()) return;

    this.clearPendingClick();
    const timer = setTimeout(() => this.clearPendingClick(), CURSOR_POSITION_TIMEOUT_MS);
    this.pendingAutocompleteClick = { event, timer };
    this.ui.terminal.write(REQUEST_CURSOR_POSITION);
  }

  /** Mirrors TUI.compositeOverlays: overlays are placed at screen-relative rows in the visible viewport. */
  private clickOverlay(overlay: OverlayEntry, event: TerminalMouseEvent): boolean {
    const internals = tuiInternals(this.ui);
    const { columns, rows } = this.ui.terminal;
    const { width, maxHeight } = internals.resolveOverlayLayout(overlay.options, 0, columns, rows);
    let height = overlay.component.render(width).length;
    if (maxHeight !== undefined) height = Math.min(height, maxHeight);
    const { row, col } = internals.resolveOverlayLayout(overlay.options, height, columns, rows);

    const localRow = event.row - 1 - row;
    if (localRow >= height) return false;
    return dispatchClick(overlay.component, { event, row: localRow, col: event.col - 1 - col, width });
  }

  private clearPendingClick(): void {
    if (!this.pendingAutocompleteClick) return;
    clearTimeout(this.pendingAutocompleteClick.timer);
    this.pendingAutocompleteClick = undefined;
  }
}
