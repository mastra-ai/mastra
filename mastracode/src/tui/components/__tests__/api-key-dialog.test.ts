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

  class Input extends MockNode {
    value = '';
    focused = false;
    onSubmit?: (value: string) => void;
    getValue() {
      return this.value;
    }
    handleInput(keyData: string) {
      if (keyData === '\r') {
        this.onSubmit?.(this.value);
        return;
      }
      if (keyData === '\u007f') {
        this.value = this.value.slice(0, -1);
        return;
      }
      if (keyData.length === 1) {
        this.value += keyData;
      }
    }
  }

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
    Input,
    Text,
    Spacer,
    getKeybindings: () => ({
      matches: (keyData: string, action: string) => {
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

import { ApiKeyDialogComponent } from '../api-key-dialog.js';

describe('ApiKeyDialogComponent keybindings', () => {
  it('calls onCancel on escape via tui.select.cancel', () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const dialog = new ApiKeyDialogComponent({
      providerName: 'OpenAI',
      onSubmit,
      onCancel,
    });

    dialog.handleInput('ESC');

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('passes non-escape input to the inner Input for typing', () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const dialog = new ApiKeyDialogComponent({
      providerName: 'OpenAI',
      onSubmit,
      onCancel,
    });

    // Type a key
    dialog.handleInput('s');
    dialog.handleInput('k');
    dialog.handleInput('-');

    // Neither callback should fire from typing
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('calls onSubmit with trimmed value when Enter is pressed via Input', () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const dialog = new ApiKeyDialogComponent({
      providerName: 'OpenAI',
      onSubmit,
      onCancel,
    });

    // Type an API key and submit
    for (const ch of 'sk-test-key') {
      dialog.handleInput(ch);
    }
    dialog.handleInput('\r');

    expect(onSubmit).toHaveBeenCalledWith('sk-test-key');
  });

  it('calls onCancel when Enter is pressed with empty input', () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const dialog = new ApiKeyDialogComponent({
      providerName: 'OpenAI',
      onSubmit,
      onCancel,
    });

    // Submit with empty input
    dialog.handleInput('\r');

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
