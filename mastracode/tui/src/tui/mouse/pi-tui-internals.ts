/**
 * Typed access to the pi-tui private state mouse support depends on. pi-tui is
 * pinned to an exact version; `pi-tui-internals.test.ts` fails if these shapes
 * move on upgrade.
 */
import type {
  Box,
  Component,
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
