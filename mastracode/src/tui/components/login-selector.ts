/**
 * OAuth provider selector component for /login and /logout commands
 */

import { Box, Container, getEditorKeybindings, Spacer, Text } from '@mariozechner/pi-tui';
import type { OAuthProviderInterface } from '../../auth/types.js';
import { theme } from '../theme.js';

/**
 * Interface for auth provider that the selector needs.
 * Can be satisfied by Harness or AuthStorage.
 */
export interface AuthProviderSource {
  getOAuthProviders(): OAuthProviderInterface[];
  isLoggedIn(providerId: string): boolean;
}

export class LoginSelectorComponent extends Box {
  private listContainer: Container;
  private allProviders: { id: string; name: string }[] = [];
  private selectedIndex: number = 0;
  private mode: 'login' | 'logout';
  private authSource: AuthProviderSource;
  private onSelectCallback: (providerId: string) => void;
  private onCancelCallback: () => void;

  constructor(
    mode: 'login' | 'logout',
    authSource: AuthProviderSource,
    onSelect: (providerId: string) => void,
    onCancel: () => void,
  ) {
    // Box with padding and background
    super(2, 1, text => theme.bg('overlayBg', text));

    this.mode = mode;
    this.authSource = authSource;
    this.onSelectCallback = onSelect;
    this.onCancelCallback = onCancel;

    // Load all OAuth providers
    this.loadProviders();

    // Add title
    const title = mode === 'login' ? 'Select provider to login:' : 'Select provider to logout:';
    this.addChild(new Text(theme.fg('text', title)));
    this.addChild(new Spacer(1));

    // Create list container
    this.listContainer = new Container();
    this.addChild(this.listContainer);

    this.addChild(new Spacer(1));
    this.addChild(new Text(theme.fg('muted', 'Press Enter to select, Escape to cancel')));

    // Initial render
    this.updateList();
  }

  private loadProviders(): void {
    this.allProviders = this.authSource.getOAuthProviders().map(p => ({ id: p.id, name: p.name }));
  }

  private updateList(): void {
    this.listContainer.clear();

    for (let i = 0; i < this.allProviders.length; i++) {
      const provider = this.allProviders[i];
      if (!provider) continue;

      const isSelected = i === this.selectedIndex;

      // Check if user is logged in for this provider
      const isLoggedIn = this.authSource.isLoggedIn(provider.id);
      const statusIndicator = isLoggedIn ? theme.fg('success', ' ✓ logged in') : '';

      let line = '';
      if (isSelected) {
        line = theme.fg('accent', '→ ' + provider.name) + statusIndicator;
      } else {
        line = '  ' + provider.name + statusIndicator;
      }

      this.listContainer.addChild(new Text(line));
    }

    // Show "no providers" if empty
    if (this.allProviders.length === 0) {
      const message =
        this.mode === 'login' ? 'No OAuth providers available' : 'No OAuth providers logged in. Use /login first.';
      this.listContainer.addChild(new Text(theme.fg('muted', message)));
    }
  }

  handleInput(keyData: string): void {
    const kb = getEditorKeybindings();

    // Up arrow
    if (kb.matches(keyData, 'selectUp')) {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.updateList();
    }
    // Down arrow
    else if (kb.matches(keyData, 'selectDown')) {
      this.selectedIndex = Math.min(this.allProviders.length - 1, this.selectedIndex + 1);
      this.updateList();
    }
    // Enter
    else if (kb.matches(keyData, 'selectConfirm')) {
      const selectedProvider = this.allProviders[this.selectedIndex];
      if (selectedProvider) {
        this.onSelectCallback(selectedProvider.id);
      }
    }
    // Escape or Ctrl+C
    else if (kb.matches(keyData, 'selectCancel')) {
      this.onCancelCallback();
    }
  }
}
