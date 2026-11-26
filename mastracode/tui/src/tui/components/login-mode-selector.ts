/**
 * Auth-mode selector component used between the provider selector and the login dialog
 * when an OAuth provider advertises more than one `authModes` entry. Lets the user pick
 * (for example) "Browser (local callback)" vs "Device code (headless)" without setting
 * an env var.
 */

import { Container } from '@earendil-works/pi-tui';
import type { TUI } from '@earendil-works/pi-tui';
import type { AuthMode } from '@mastra/code-sdk/auth/types';
import { showModalOverlay } from '../overlay.js';
import type { MenuChrome } from './menu-chrome.js';
import { MenuList } from './menu-list.js';

export class LoginModeSelectorComponent extends Container implements MenuChrome {
  private readonly list: MenuList;

  constructor(
    private readonly providerName: string,
    modes: ReadonlyArray<AuthMode>,
    onSelect: (modeId: string) => void,
    onCancel: () => void,
  ) {
    super();
    this.list = new MenuList(
      modes.map(mode => ({ value: mode.id, label: mode.name, description: mode.description })),
      12,
    );
    this.list.onSelect = item => onSelect(item.value);
    this.list.onCancel = onCancel;
    this.addChild(this.list);
  }

  menuTitle(): string {
    return `How do you want to sign in to ${this.providerName}?`;
  }

  handleInput(keyData: string): void {
    this.list.handleInput(keyData);
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

    showModalOverlay(tui, selector);
  });
}
