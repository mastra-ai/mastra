/**
 * Auth-mode selector component used between the provider selector and the login dialog
 * when an OAuth provider advertises more than one `authModes` entry. Lets the user pick
 * (for example) "Browser (local callback)" vs "Device code (headless)" without setting
 * an env var.
 */

import { Box, Container, getKeybindings, Spacer, Text } from '@earendil-works/pi-tui';
import type { TUI } from '@earendil-works/pi-tui';
import type { AuthMode } from '../../auth/types.js';
import { showModalOverlay } from '../overlay.js';
import { theme } from '../theme.js';

export class LoginModeSelectorComponent extends Box {
  private listContainer: Container;
  private modes: ReadonlyArray<AuthMode>;
  private selectedIndex = 0;
  private onSelectCallback: (modeId: string) => void;
  private onCancelCallback: () => void;

  constructor(
    providerName: string,
    modes: ReadonlyArray<AuthMode>,
    onSelect: (modeId: string) => void,
    onCancel: () => void,
  ) {
    super(2, 1, text => theme.bg('overlayBg', text));

    this.modes = modes;
    this.onSelectCallback = onSelect;
    this.onCancelCallback = onCancel;

    this.addChild(new Text(theme.fg('text', `How do you want to sign in to ${providerName}?`)));
    this.addChild(new Spacer(1));

    this.listContainer = new Container();
    this.addChild(this.listContainer);

    this.addChild(new Spacer(1));
    this.addChild(new Text(theme.fg('muted', 'Press Enter to select, Escape to cancel')));

    this.updateList();
  }

  private updateList(): void {
    this.listContainer.clear();

    for (let i = 0; i < this.modes.length; i++) {
      const mode = this.modes[i];
      if (!mode) continue;

      const isSelected = i === this.selectedIndex;
      const prefix = isSelected ? theme.fg('accent', '→ ') : '  ';
      const label = isSelected ? theme.fg('accent', mode.name) : mode.name;
      this.listContainer.addChild(new Text(`${prefix}${label}`));

      if (mode.description) {
        this.listContainer.addChild(new Text(theme.fg('muted', `    ${mode.description}`)));
      }
    }
  }

  handleInput(keyData: string): void {
    const kb = getKeybindings();

    if (kb.matches(keyData, 'tui.select.up')) {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.updateList();
    } else if (kb.matches(keyData, 'tui.select.down')) {
      this.selectedIndex = Math.min(this.modes.length - 1, this.selectedIndex + 1);
      this.updateList();
    } else if (kb.matches(keyData, 'tui.select.confirm')) {
      const selected = this.modes[this.selectedIndex];
      if (selected) {
        this.onSelectCallback(selected.id);
      }
    } else if (kb.matches(keyData, 'tui.select.cancel')) {
      this.onCancelCallback();
    }
  }
}

/**
 * Prompt the user to pick an auth mode if the provider advertises more than one.
 * Returns the chosen mode id, `undefined` when the provider has 0/1 modes (no prompt),
 * or `null` when the user cancelled.
 */
export async function promptAuthMode(
  tui: TUI,
  providerName: string,
  modes: ReadonlyArray<AuthMode> | undefined,
): Promise<string | undefined | null> {
  if (!modes || modes.length < 2) {
    return modes && modes.length === 1 ? modes[0]!.id : undefined;
  }

  return new Promise(resolve => {
    const selector = new LoginModeSelectorComponent(
      providerName,
      modes,
      modeId => {
        tui.hideOverlay();
        resolve(modeId);
      },
      () => {
        tui.hideOverlay();
        resolve(null);
      },
    );

    showModalOverlay(tui, selector, { widthPercent: 0.8, maxHeight: '60%' });
  });
}
