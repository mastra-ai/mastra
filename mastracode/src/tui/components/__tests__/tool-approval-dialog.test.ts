import type * as PiTui from '@mariozechner/pi-tui';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@mariozechner/pi-tui', async () => {
  const actual = await vi.importActual<typeof PiTui>('@mariozechner/pi-tui');

  class MockNode {
    children: any[] = [];
    addChild(child: any) {
      this.children.push(child);
      return child;
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
    render() {
      return [this.text];
    }
  }

  class Spacer {
    constructor(public size: number) {}
  }

  return {
    ...actual,
    Box,
    Text,
    Spacer,
    getKeybindings: () => ({
      matches: (data: string, action: string) => {
        if (action === 'tui.select.cancel') return data === '\x1b' || data === 'ESC';
        return false;
      },
    }),
  };
});

vi.mock('../../theme.js', () => ({
  theme: {
    bg: (_token: string, text: string) => text,
    fg: (_token: string, text: string) => text,
    getTheme: () => ({ dim: '#888888', text: '#ffffff' }),
  },
}));

import { ToolApprovalDialogComponent } from '../tool-approval-dialog.js';

function makeDialog(onAction = vi.fn()) {
  const dialog = new ToolApprovalDialogComponent({
    toolCallId: 'call-1',
    toolName: 'shell',
    args: { command: 'ls' },
    categoryLabel: 'Execute',
    onAction,
  });
  return { dialog, onAction };
}

describe('ToolApprovalDialogComponent.handleInput', () => {
  describe('literal byte input (Apple Terminal.app and friends)', () => {
    it('approves on y', () => {
      const { dialog, onAction } = makeDialog();
      dialog.handleInput('y');
      expect(onAction).toHaveBeenCalledExactlyOnceWith({ type: 'approve' });
    });

    it('declines on n', () => {
      const { dialog, onAction } = makeDialog();
      dialog.handleInput('n');
      expect(onAction).toHaveBeenCalledExactlyOnceWith({ type: 'decline' });
    });

    it('always-allows-category on a', () => {
      const { dialog, onAction } = makeDialog();
      dialog.handleInput('a');
      expect(onAction).toHaveBeenCalledExactlyOnceWith({ type: 'always_allow_category' });
    });

    it('switches to yolo on Y, not approve', () => {
      const { dialog, onAction } = makeDialog();
      dialog.handleInput('Y');
      expect(onAction).toHaveBeenCalledExactlyOnceWith({ type: 'yolo' });
    });

    it('declines on Escape', () => {
      const { dialog, onAction } = makeDialog();
      dialog.handleInput('\x1b');
      expect(onAction).toHaveBeenCalledExactlyOnceWith({ type: 'decline' });
    });
  });

  describe('Kitty CSI-u input (iTerm2 / Ghostty / WezTerm / kitty)', () => {
    it('approves on CSI-u y', () => {
      const { dialog, onAction } = makeDialog();
      dialog.handleInput('\x1b[121u');
      expect(onAction).toHaveBeenCalledExactlyOnceWith({ type: 'approve' });
    });

    it('declines on CSI-u n', () => {
      const { dialog, onAction } = makeDialog();
      dialog.handleInput('\x1b[110u');
      expect(onAction).toHaveBeenCalledExactlyOnceWith({ type: 'decline' });
    });

    it('always-allows-category on CSI-u a', () => {
      const { dialog, onAction } = makeDialog();
      dialog.handleInput('\x1b[97u');
      expect(onAction).toHaveBeenCalledExactlyOnceWith({ type: 'always_allow_category' });
    });

    it.each([
      ['\x1b[121;2u', 'Shift+y base codepoint'],
      ['\x1b[89;2u', 'Shift+y shifted codepoint'],
      ['\x1b[121:89:121;2u', 'Shift+y alternate-keys form'],
    ])('switches to yolo on %j (%s)', input => {
      const { dialog, onAction } = makeDialog();
      dialog.handleInput(input);
      expect(onAction).toHaveBeenCalledExactlyOnceWith({ type: 'yolo' });
    });
  });

  describe('modifyOtherKeys input (xterm fallback)', () => {
    it('approves on modifyOtherKeys y', () => {
      const { dialog, onAction } = makeDialog();
      dialog.handleInput('\x1b[27;1;121~');
      expect(onAction).toHaveBeenCalledExactlyOnceWith({ type: 'approve' });
    });

    it('switches to yolo on modifyOtherKeys Shift+y', () => {
      const { dialog, onAction } = makeDialog();
      dialog.handleInput('\x1b[27;2;121~');
      expect(onAction).toHaveBeenCalledExactlyOnceWith({ type: 'yolo' });
    });
  });

  describe('modifier rejection', () => {
    it.each([
      ['\x1b[121;5u', 'Ctrl+y'],
      ['\x1b[121;3u', 'Alt+y'],
      ['\x1b[27;5;121~', 'modifyOtherKeys Ctrl+y'],
      ['\x1b[27;3;121~', 'modifyOtherKeys Alt+y'],
    ])('does not fire onAction for %s (%j)', input => {
      const { dialog, onAction } = makeDialog();
      dialog.handleInput(input);
      expect(onAction).not.toHaveBeenCalled();
    });

    it('ignores raw Ctrl+C (no escape-equivalent mapping)', () => {
      const { dialog, onAction } = makeDialog();
      dialog.handleInput('\x03');
      expect(onAction).not.toHaveBeenCalled();
    });
  });

  describe('one-shot guard', () => {
    it('fires onAction at most once across repeated presses', () => {
      const { dialog, onAction } = makeDialog();
      dialog.handleInput('y');
      dialog.handleInput('y');
      dialog.handleInput('Y');
      dialog.handleInput('n');
      expect(onAction).toHaveBeenCalledExactlyOnceWith({ type: 'approve' });
    });
  });

  describe('unrelated input', () => {
    it.each([['\t'], ['\x1b[A'], ['x'], ['1'], ['']])('ignores %j', input => {
      const { dialog, onAction } = makeDialog();
      dialog.handleInput(input);
      expect(onAction).not.toHaveBeenCalled();
    });
  });
});
