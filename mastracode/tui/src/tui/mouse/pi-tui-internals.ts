/**
 * Typed access to the pi-tui private state mouse support depends on. pi-tui is
 * pinned to an exact version; `pi-tui-internals.test.ts` fails if these shapes
 * move on upgrade.
 */
import type {
  Box,
  Component,
  Editor,
  Input,
  OverlayOptions,
  SelectItem,
  SelectList,
  SettingItem,
  SettingsList,
  TUI,
} from '@earendil-works/pi-tui';

export interface OverlayEntry {
  component: Component;
  options?: OverlayOptions;
}

interface TuiInternals {
  doRender(): void;
  /** Lines of the last rendered frame, overlays composited (padded to at least the terminal height). */
  previousLines: string[];
  /** Frame line the hardware cursor is on. */
  hardwareCursorRow: number;
  getTopmostVisibleOverlay(): OverlayEntry | undefined;
  resolveOverlayLayout(
    options: OverlayOptions | undefined,
    overlayHeight: number,
    termWidth: number,
    termHeight: number,
  ): { width: number; row: number; col: number; maxHeight: number | undefined };
}

interface BoxInternals {
  paddingX: number;
  paddingY: number;
}

interface SelectListInternals {
  filteredItems: SelectItem[];
  selectedIndex: number;
  maxVisible: number;
}

interface SettingsListInternals {
  items: SettingItem[];
  filteredItems: SettingItem[];
  selectedIndex: number;
  maxVisible: number;
  searchEnabled: boolean;
  searchInput: Input | undefined;
  submenuComponent: Component | null;
  activateItem(): void;
}

/** One wrapped row of the editor's layout: a slice of a logical line. */
export interface EditorVisualLine {
  logicalLine: number;
  startCol: number;
  length: number;
}

interface EditorInternals {
  state: { lines: string[]; cursorLine: number; cursorCol: number };
  /** First visible layout row; updated by render() to keep the cursor in view. */
  scrollOffset: number;
  /** Width render() last wrapped the text at. */
  lastWidth: number;
  lastAction: string | null;
  onChange?: (text: string) => void;
  buildVisualLineMap(width: number): EditorVisualLine[];
  /** Grapheme segmentation that keeps paste markers as one segment. */
  segment(text: string, mode: 'grapheme' | 'word'): Iterable<{ segment: string; index: number }>;
  setCursorCol(col: number): void;
  /** Cursor movement the editor's own ↑↓←→, Home/End and word keys use. */
  moveCursor(deltaLine: number, deltaCol: number): void;
  moveToLineStart(): void;
  moveToLineEnd(): void;
  moveWordBackwards(): void;
  moveWordForwards(): void;
  isOnFirstVisualLine(): boolean;
  isOnLastVisualLine(): boolean;
  pushUndoSnapshot(): void;
  expandPasteMarkers(text: string): string;
}

export function tuiInternals(ui: TUI): TuiInternals {
  return ui as unknown as TuiInternals;
}

export function boxPadding(box: Box): BoxInternals {
  return box as unknown as BoxInternals;
}

export function selectListInternals(list: SelectList): SelectListInternals {
  return list as unknown as SelectListInternals;
}

export function settingsListInternals(list: SettingsList): SettingsListInternals {
  return list as unknown as SettingsListInternals;
}

export function editorInternals(editor: Editor): EditorInternals {
  return editor as unknown as EditorInternals;
}
