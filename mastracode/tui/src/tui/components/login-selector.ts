/**
 * OAuth provider selector component for /login and /logout commands
 */

import { Container, getKeybindings, Text } from '@earendil-works/pi-tui';
import type { OAuthProviderInterface } from '@mastra/code-sdk/auth/types';
import { theme } from '../theme.js';
import type { MenuChrome } from './menu-chrome.js';
import { MenuList } from './menu-list.js';

/**
 * Interface for auth provider that the selector needs.
 * Can be satisfied by AgentController or AuthStorage.
 */
export interface AuthProviderSource {
  getOAuthProviders(): OAuthProviderInterface[];
  isLoggedIn(providerId: string): boolean;
  /** Number of registered accounts for the provider, when the source tracks them. */
  countAccounts?(providerId: string): number;
}

export class LoginSelectorComponent extends Container implements MenuChrome {
  private readonly list?: MenuList;

  constructor(
    private readonly mode: 'login' | 'logout',
    private readonly authSource: AuthProviderSource,
    onSelect: (providerId: string) => void,
    private readonly onCancel: () => void,
  ) {
    super();

    const providers = authSource.getOAuthProviders();
    if (providers.length === 0) {
      const message =
        mode === 'login' ? 'No OAuth providers available' : 'No OAuth providers logged in. Use /connect first.';
      this.addChild(new Text(theme.fg('muted', message), 2, 0));
      return;
    }

    this.list = new MenuList(
      providers.map(provider => ({ value: provider.id, label: provider.name, description: this.status(provider.id) })),
      12,
    );
    this.list.onSelect = item => onSelect(item.value);
    this.list.onCancel = onCancel;
    this.addChild(this.list);
  }

  menuTitle(): string {
    return this.mode === 'login' ? 'Select provider to login' : 'Select provider to logout';
  }

  /** "✓ stored (2 accounts)" when the provider has stored credentials, else "unconfigured". */
  private status(providerId: string): string {
    if (!this.authSource.isLoggedIn(providerId)) return theme.fg('muted', 'unconfigured');
    const count = this.authSource.countAccounts?.(providerId) ?? 0;
    const accounts = count > 0 ? theme.fg('muted', ` (${count} account${count === 1 ? '' : 's'})`) : '';
    return theme.fg('success', '✓ stored') + accounts;
  }

  handleInput(keyData: string): void {
    if (this.list) this.list.handleInput(keyData);
    else if (getKeybindings().matches(keyData, 'tui.select.cancel')) this.onCancel();
  }
}
