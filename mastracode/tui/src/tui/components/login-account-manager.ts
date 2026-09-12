/**
 * Account manager component for providers with registered accounts —
 * opened by /login on an already-connected provider.
 *
 * Lists the provider's accounts (label + active marker) and offers:
 * Add another account / Re-authenticate… / Remove… / Back. Selecting an
 * account row activates that account.
 */

import { Box, Container, getKeybindings, Spacer, Text } from '@earendil-works/pi-tui';
import { theme } from '../theme.js';

export interface ManagedAccount {
  id: string;
  label: string;
  active: boolean;
}

export interface LoginAccountManagerCallbacks {
  onAddAnother(): void;
  onReauthenticate(accountId: string): void;
  onRemove(accountId: string): void;
  onActivate(accountId: string): void;
  onBack(): void;
}

type ManagerMode = 'menu' | 'pick-reauth' | 'pick-remove' | 'confirm-remove';

export class LoginAccountManagerComponent extends Box {
  private listContainer: Container;
  private mode: ManagerMode = 'menu';
  private accounts: ManagedAccount[];
  private selectedIndex = 0;
  private callbacks: LoginAccountManagerCallbacks;
  private confirmTarget?: ManagedAccount;
  private readonly providerName: string;

  constructor(providerName: string, accounts: ManagedAccount[], callbacks: LoginAccountManagerCallbacks) {
    super(2, 1, text => theme.bg('overlayBg', text));

    this.providerName = providerName;
    this.accounts = accounts;
    this.callbacks = callbacks;

    this.addChild(new Text(theme.fg('warning', `${providerName} accounts`)));
    this.addChild(new Spacer(1));

    this.listContainer = new Container();
    this.addChild(this.listContainer);

    this.addChild(new Spacer(1));
    this.addChild(new Text(theme.fg('muted', 'Press Enter to select, Escape to cancel')));

    this.updateList();
  }

  /** Accounts may have changed (e.g. after an in-place re-auth); refresh rows. */
  setAccounts(accounts: ManagedAccount[]): void {
    this.accounts = accounts;
    this.updateList();
  }

  private rows(): { label: string; action: () => void }[] {
    if (this.mode === 'pick-reauth' || this.mode === 'pick-remove') {
      return [
        ...this.accounts.map(account => ({
          label: `${account.label}${account.active ? theme.fg('success', ' ✓ active') : ''}`,
          action: () => {
            if (this.mode === 'pick-reauth') {
              this.callbacks.onReauthenticate(account.id);
            } else {
              this.confirmTarget = account;
              this.mode = 'confirm-remove';
              this.selectedIndex = 0;
              this.updateList();
            }
          },
        })),
        { label: 'Back', action: () => this.backToMenu() },
      ];
    }
    if (this.mode === 'confirm-remove') {
      const target = this.confirmTarget;
      return [
        {
          label: `Remove "${target?.label ?? ''}"? Enter to confirm, Escape to cancel`,
          action: () => {
            if (target) this.callbacks.onRemove(target.id);
          },
        },
      ];
    }
    return [
      ...this.accounts.map(account => ({
        label: `${account.label}${account.active ? theme.fg('success', ' ✓ active') : ''}`,
        action: () => this.callbacks.onActivate(account.id),
      })),
      { label: 'Add another account', action: () => this.callbacks.onAddAnother() },
      { label: 'Re-authenticate…', action: () => this.enterPicker('pick-reauth') },
      { label: 'Remove…', action: () => this.enterPicker('pick-remove') },
      { label: 'Back', action: () => this.callbacks.onBack() },
    ];
  }

  private enterPicker(mode: 'pick-reauth' | 'pick-remove'): void {
    this.mode = mode;
    this.selectedIndex = 0;
    this.updateList();
  }

  private backToMenu(): void {
    this.mode = 'menu';
    this.selectedIndex = 0;
    this.updateList();
  }

  private updateList(): void {
    this.listContainer.clear();

    if (this.mode === 'pick-reauth' || this.mode === 'pick-remove') {
      const verb = this.mode === 'pick-reauth' ? 're-authenticate' : 'remove';
      this.listContainer.addChild(new Text(theme.fg('text', `Select the account to ${verb}:`)));
      this.listContainer.addChild(new Spacer(1));
    }

    const rows = this.rows();
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      const isSelected = i === this.selectedIndex;
      const isActionRow = i >= this.accounts.length && this.mode === 'menu';
      const text = isSelected
        ? theme.fg('accent', `→ ${row.label}`)
        : isActionRow
          ? theme.fg('text', `  ${row.label}`)
          : `  ${row.label}`;
      this.listContainer.addChild(new Text(text));
    }

    if (this.accounts.length === 0) {
      this.listContainer.addChild(new Text(theme.fg('muted', 'No accounts registered.')));
    }
  }

  handleInput(keyData: string): void {
    const kb = getKeybindings();
    const rows = this.rows();

    if (kb.matches(keyData, 'tui.select.up')) {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.updateList();
    } else if (kb.matches(keyData, 'tui.select.down')) {
      this.selectedIndex = Math.min(rows.length - 1, this.selectedIndex + 1);
      this.updateList();
    } else if (kb.matches(keyData, 'tui.select.confirm')) {
      rows[this.selectedIndex]?.action();
    } else if (kb.matches(keyData, 'tui.select.cancel')) {
      if (this.mode === 'confirm-remove' || this.mode === 'pick-reauth' || this.mode === 'pick-remove') {
        this.backToMenu();
      } else {
        this.callbacks.onBack();
      }
    }
  }
}
