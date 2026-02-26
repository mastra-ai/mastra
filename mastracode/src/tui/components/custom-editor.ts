/**
 * Custom editor that handles app-level keybindings for Mastra Code.
 */

import { Editor, matchesKey } from '@mariozechner/pi-tui';
import type { EditorTheme, TUI } from '@mariozechner/pi-tui';
import { getClipboardImage } from '../../clipboard/index.js';
import type { ClipboardImage } from '../../clipboard/index.js';

const PASTE_START = '\x1b[200~';
const PASTE_END = '\x1b[201~';
export type AppAction =
  | 'clear' // Ctrl+C or Escape - interrupt
  | 'exit' // Ctrl+D - exit when empty
  | 'undo' // Ctrl+Z - undo last clear
  | 'toggleThinking' // Ctrl+T
  | 'expandTools' // Ctrl+E
  | 'followUp' // Alt+Enter - queue follow-up while streaming
  | 'cycleMode' // Shift+Tab - cycle harness modes
  | 'toggleYolo'; // Ctrl+Y - toggle YOLO mode

export class CustomEditor extends Editor {
  private actionHandlers: Map<AppAction, () => void> = new Map();

  /** Handler for Ctrl+D when editor is empty */
  public onCtrlD?: () => void;

  /** Whether Escape triggers clear (default true) */
  public escapeEnabled = true;

  /** Called when clipboard image data is pasted */
  public onImagePaste?: (image: ClipboardImage) => void;

  /** Tracks when we're swallowing paste content that was intercepted as an image */
  private _imagePasteIntercepted = false;

  constructor(tui: TUI, theme: EditorTheme) {
    super(tui, theme);
  }

  /**
   * Register a handler for an app action.
   */
  onAction(action: AppAction, handler: () => void): void {
    this.actionHandlers.set(action, handler);
  }

  handleInput(data: string): void {
    // If we intercepted a paste as image, swallow remaining paste data
    if (this._imagePasteIntercepted) {
      if (data.includes(PASTE_END)) {
        this._imagePasteIntercepted = false;
        const afterPaste = data.substring(data.indexOf(PASTE_END) + PASTE_END.length);
        if (afterPaste.length > 0) {
          this.handleInput(afterPaste);
        }
      }
      return;
    }

    // Detect paste start → check clipboard for image
    if (data.includes(PASTE_START) && this.onImagePaste) {
      const clipboardImage = getClipboardImage();
      if (clipboardImage) {
        this.onImagePaste(clipboardImage);
        // Swallow the paste text content
        if (data.includes(PASTE_END)) {
          const afterPaste = data.substring(data.indexOf(PASTE_END) + PASTE_END.length);
          if (afterPaste.length > 0) {
            this.handleInput(afterPaste);
          }
        } else {
          this._imagePasteIntercepted = true;
        }
        return;
      }
    }

    // Ctrl+C - interrupt
    if (matchesKey(data, 'ctrl+c')) {
      const handler = this.actionHandlers.get('clear');
      if (handler) {
        handler();
        return;
      }
    }
    // Escape - same as Ctrl+C (abort generation) if enabled
    if (matchesKey(data, 'escape') && this.escapeEnabled) {
      const handler = this.actionHandlers.get('clear');
      if (handler) {
        handler();
        return;
      }
    }

    // Ctrl+D - exit when editor is empty
    if (matchesKey(data, 'ctrl+d')) {
      if (this.getText().length === 0) {
        const handler = this.onCtrlD ?? this.actionHandlers.get('exit');
        if (handler) handler();
      }
      return; // Always consume
    }
    // Ctrl+Z - undo last clear
    if (matchesKey(data, 'ctrl+z')) {
      const handler = this.actionHandlers.get('undo');
      if (handler) {
        handler();
        return;
      }
    }

    // Ctrl+T - toggle thinking
    if (matchesKey(data, 'ctrl+t')) {
      const handler = this.actionHandlers.get('toggleThinking');
      if (handler) {
        handler();
        return;
      }
    }

    // Ctrl+E - expand tools
    if (matchesKey(data, 'ctrl+e')) {
      const handler = this.actionHandlers.get('expandTools');
      if (handler) {
        handler();
        return;
      }
    }

    // Ctrl+F - follow-up (queue message while streaming)
    if (matchesKey(data, 'ctrl+f')) {
      // Accept autocomplete suggestion if one is showing, so the resolved
      // text (e.g. "/review" instead of "/rev") is read by the handler.
      if (this.isShowingAutocomplete()) {
        super.handleInput('\t');
      }
      const handler = this.actionHandlers.get('followUp');
      if (handler) {
        handler();
        return;
      }
    }
    // Shift+Tab - cycle harness modes
    if (matchesKey(data, 'shift+tab')) {
      const handler = this.actionHandlers.get('cycleMode');
      if (handler) {
        handler();
        return;
      }
    }

    // Ctrl+Y - toggle YOLO mode
    if (matchesKey(data, 'ctrl+y')) {
      const handler = this.actionHandlers.get('toggleYolo');
      if (handler) {
        handler();
        return;
      }
    }

    // Pass to parent for editor handling
    super.handleInput(data);
  }
}
