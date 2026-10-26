/**
 * Account manager component for providers with registered accounts —
 * opened by /login on an already-connected provider.
 *
 * Lists the provider's accounts (label + active marker) plus
 * Add another account / Back. Selecting an account opens a submenu for
 * it: Set as active / Re-authenticate… / Remove… / Back.
 */

import { Container, Text } from '@earendil-works/pi-tui';
import { theme } from '../theme.js';
import type { MenuChrome } from './menu-chrome.js';
import { MenuList } from './menu-list.js';

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

type ManagerMode = 'menu' | 'account' | 'confirm-remove';

export class LoginAccountManagerComponent extends Container implements MenuChrome {
  private list!: MenuList;
  private mode: ManagerMode = 'menu';
  private accounts: ManagedAccount[];
  private selectedIndex = 0;
  private callbacks: LoginAccountManagerCallbacks;
  private selectedAccount?: ManagedAccount;
  private confirmTarget?: ManagedAccount;
  private readonly providerName: string;

  constructor(providerName: string, accounts: ManagedAccount[], callbacks: LoginAccountManagerCallbacks) {
    super();

    this.providerName = providerName;
    this.accounts = accounts;
    this.callbacks = callbacks;

    this.updateList();
  }

  /** Accounts may have changed (e.g. after an in-place re-auth); refresh rows. */
  setAccounts(accounts: ManagedAccount[]): void {
    this.accounts = accounts;
    if (this.selectedAccount && !accounts.some(account => account.id === this.selectedAccount?.id)) {
      this.selectedAccount = undefined;
      this.mode = 'menu';
      this.selectedIndex = 0;
    }
    this.updateList();
  }

  private rows(): { label: string; description?: string; action: () => void }[] {
    if (this.mode === 'account') {
      const account = this.selectedAccount;
      if (!account) {
        return [{ label: 'Back', action: () => this.backToMenu() }];
      }
      const rows: { label: string; action: () => void }[] = [];
      if (!account.active) {
        rows.push({ label: 'Set as active', action: () => this.callbacks.onActivate(account.id) });
      }
      rows.push({ label: 'Re-authenticate…', action: () => this.callbacks.onReauthenticate(account.id) });
      rows.push({
        label: 'Remove…',
        action: () => {
          this.confirmTarget = account;
          this.mode = 'confirm-remove';
          this.selectedIndex = 0;
          this.updateList();
        },
      });
      rows.push({ label: 'Back', action: () => this.backToMenu() });
      return rows;
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
        label: account.label,
        description: account.active ? theme.fg('success', '✓ active') : undefined,
        action: () => {
          this.selectedAccount = account;
          this.mode = 'account';
          this.selectedIndex = 0;
          this.updateList();
        },
      })),
      { label: 'Add another account', action: () => this.callbacks.onAddAnother() },
      { label: 'Back', action: () => this.callbacks.onBack() },
    ];
  }

  private backToMenu(): void {
    this.mode = 'menu';
    this.selectedAccount = undefined;
    this.selectedIndex = 0;
    this.updateList();
  }

  /** "Anthropic accounts", or "Anthropic accounts › work" while an account's actions are open. */
  menuTitle(): string {
    const open = this.mode !== 'menu' && this.selectedAccount ? ` › ${this.selectedAccount.label}` : '';
    return `${this.providerName} accounts${open}`;
  }

  private updateList(): void {
    this.clear();
    const rows = this.rows();
    this.list = new MenuList(
      rows.map((row, index) => ({ value: String(index), label: row.label, description: row.description })),
      12,
    );
    this.list.setSelectedIndex(this.selectedIndex);
    this.list.onSelectionChange = item => {
      this.selectedIndex = Number(item.value);
    };
    this.list.onSelect = item => rows[Number(item.value)]?.action();
    this.list.onCancel = () => {
      if (this.mode === 'account' || this.mode === 'confirm-remove') this.backToMenu();
      else this.callbacks.onBack();
    };
    this.addChild(this.list);
    if (this.accounts.length === 0) {
      this.addChild(new Text(theme.fg('muted', 'No accounts registered.'), 2, 0));
    }
  }

  handleInput(keyData: string): void {
    this.list.handleInput(keyData);
  }
}
