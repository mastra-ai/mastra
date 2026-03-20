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
    getTheme: () => ({ dim: '#888888', text: '#ffffff' }),
  },
}));

vi.mock('chalk', () => {
  const passthrough = (text: string) => text;
  const chainable = new Proxy(passthrough, {
    get: () => chainable,
    apply: (_target, _thisArg, args) => args[0],
  });
  return {
    default: new Proxy({} as any, {
      get:
        () =>
        (..._args: any[]) =>
          chainable,
    }),
  };
});

import { ToolApprovalDialogComponent } from '../tool-approval-dialog.js';

describe('ToolApprovalDialogComponent keybindings', () => {
  function createDialog(onAction = vi.fn()) {
    return {
      dialog: new ToolApprovalDialogComponent({
        toolCallId: 'call-1',
        toolName: 'write_file',
        args: { path: '/tmp/test.txt', content: 'hello' },
        onAction,
      }),
      onAction,
    };
  }

  it('approves on "y"', () => {
    const { dialog, onAction } = createDialog();
    dialog.handleInput('y');
    expect(onAction).toHaveBeenCalledWith({ type: 'approve' });
  });

  it('declines on "n"', () => {
    const { dialog, onAction } = createDialog();
    dialog.handleInput('n');
    expect(onAction).toHaveBeenCalledWith({ type: 'decline' });
  });

  it('declines on escape via tui.select.cancel', () => {
    const { dialog, onAction } = createDialog();
    dialog.handleInput('ESC');
    expect(onAction).toHaveBeenCalledWith({ type: 'decline' });
  });

  it('always allows category on "a"', () => {
    const { dialog, onAction } = createDialog();
    dialog.handleInput('a');
    expect(onAction).toHaveBeenCalledWith({ type: 'always_allow_category' });
  });

  it('enters yolo mode on "Y"', () => {
    const { dialog, onAction } = createDialog();
    dialog.handleInput('Y');
    expect(onAction).toHaveBeenCalledWith({ type: 'yolo' });
  });

  it('ignores unrecognized keys', () => {
    const { dialog, onAction } = createDialog();
    dialog.handleInput('z');
    dialog.handleInput('1');
    dialog.handleInput(' ');
    expect(onAction).not.toHaveBeenCalled();
  });
});
