import { describe, expect, it, vi } from 'vitest';

vi.mock('@mariozechner/pi-tui', () => {
  class MockNode {
    children: any[] = [];
    addChild(child: any) {
      this.children.push(child);
      return child;
    }
    clear() {
      this.children = [];
    }
  }

  class Box extends MockNode {
    constructor(..._args: any[]) {
      super();
    }
  }

  class Container extends MockNode {}

  class Text {
    constructor(
      public text: string,
      public x = 0,
      public y = 0,
    ) {}
  }

  class Spacer {
    constructor(public size: number) {}
  }

  return {
    Box,
    Container,
    Text,
    Spacer,
    getKeybindings: () => ({
      matches: (keyData: string, action: string) => {
        if (action === 'tui.select.up') return keyData === 'UP';
        if (action === 'tui.select.down') return keyData === 'DOWN';
        if (action === 'tui.select.confirm') return keyData === '\r';
        if (action === 'tui.select.cancel') return keyData === 'ESC';
        return false;
      },
    }),
  };
});

vi.mock('../../theme.js', () => ({
  theme: {
    bg: (_token: string, text: string) => text,
    bold: (text: string) => text,
    fg: (_token: string, text: string) => text,
  },
}));

import type { AuthProviderSource } from '../login-selector.js';
import { LoginSelectorComponent } from '../login-selector.js';

function createAuthSource(
  providers: { id: string; name: string }[],
  loggedIn: Set<string> = new Set(),
): AuthProviderSource {
  return {
    getOAuthProviders: () => providers.map(p => ({ id: p.id, name: p.name }) as any),
    isLoggedIn: (id: string) => loggedIn.has(id),
  };
}

describe('LoginSelectorComponent keybindings', () => {
  const providers = [
    { id: 'github', name: 'GitHub' },
    { id: 'google', name: 'Google' },
    { id: 'gitlab', name: 'GitLab' },
  ];

  it('navigates down through providers', () => {
    const onSelect = vi.fn();
    const onCancel = vi.fn();
    const selector = new LoginSelectorComponent('login', createAuthSource(providers), onSelect, onCancel);

    // Navigate down twice, then confirm — should select 'google' (index 2)
    selector.handleInput('DOWN');
    selector.handleInput('DOWN');
    selector.handleInput('\r');

    expect(onSelect).toHaveBeenCalledWith('gitlab');
  });

  it('navigates up through providers', () => {
    const onSelect = vi.fn();
    const onCancel = vi.fn();
    const selector = new LoginSelectorComponent('login', createAuthSource(providers), onSelect, onCancel);

    // Navigate down then back up, confirm — should select first provider
    selector.handleInput('DOWN');
    selector.handleInput('UP');
    selector.handleInput('\r');

    expect(onSelect).toHaveBeenCalledWith('github');
  });

  it('clamps at top when pressing up at start', () => {
    const onSelect = vi.fn();
    const onCancel = vi.fn();
    const selector = new LoginSelectorComponent('login', createAuthSource(providers), onSelect, onCancel);

    // Press up at start, should stay at index 0
    selector.handleInput('UP');
    selector.handleInput('\r');

    expect(onSelect).toHaveBeenCalledWith('github');
  });

  it('clamps at bottom when pressing down past last', () => {
    const onSelect = vi.fn();
    const onCancel = vi.fn();
    const selector = new LoginSelectorComponent('login', createAuthSource(providers), onSelect, onCancel);

    // Press down 10 times, should clamp at last provider
    for (let i = 0; i < 10; i++) selector.handleInput('DOWN');
    selector.handleInput('\r');

    expect(onSelect).toHaveBeenCalledWith('gitlab');
  });

  it('calls onCancel on escape', () => {
    const onSelect = vi.fn();
    const onCancel = vi.fn();
    const selector = new LoginSelectorComponent('login', createAuthSource(providers), onSelect, onCancel);

    selector.handleInput('ESC');

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('selects correct provider after navigating', () => {
    const onSelect = vi.fn();
    const onCancel = vi.fn();
    const selector = new LoginSelectorComponent('login', createAuthSource(providers), onSelect, onCancel);

    selector.handleInput('DOWN');
    selector.handleInput('\r');

    expect(onSelect).toHaveBeenCalledWith('google');
  });
});
