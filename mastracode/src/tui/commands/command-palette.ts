/**
 * Command palette handler — opens the fuzzy-searchable command overlay.
 * Returns the selected command string (e.g. "/threads") or undefined if cancelled.
 */

import { CommandPaletteComponent, type PaletteItem } from '../components/command-palette.js';
import type { TUIState } from '../state.js';

export async function openCommandPalette(state: TUIState): Promise<string | undefined> {
  // Don't open if an overlay is already showing
  if (state.ui.hasOverlay()) return undefined;

  const modes = state.harness.listModes();

  return new Promise(resolve => {
    const palette = new CommandPaletteComponent({
      tui: state.ui,
      modes: modes.length,
      customSlashCommands: state.customSlashCommands,
      onSelect: (item: PaletteItem) => {
        state.ui.hideOverlay();

        if (item.command) {
          resolve(item.command);
        } else {
          // Shortcut items are informational only
          resolve(undefined);
        }
      },
      onCancel: () => {
        state.ui.hideOverlay();
        resolve(undefined);
      },
    });

    state.ui.showOverlay(palette, {
      width: '70%',
      maxHeight: '60%',
      anchor: 'center',
    });
    palette.focused = true;
  });
}
