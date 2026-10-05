import type * as PiTui from '@earendil-works/pi-tui';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@earendil-works/pi-tui', async () => {
  const actual = await vi.importActual<typeof PiTui>('@earendil-works/pi-tui');

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
    bold: (text: string) => text,
    getTheme: () => ({ dim: '#888888', text: '#ffffff', warning: '#f59e0b', secondary: '#d9d9dc' }),
  },
  surfaceShade: () => '#252538',
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

describe('ToolApprovalDialogComponent.render', () => {
  it('renders one inline row with the four key choices', () => {
    const { dialog } = makeDialog();
    const lines = dialog.render(120).map(line => line.replace(/\x1b\[[0-9;]*m/g, ''));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe('▎ Allow?   y yes  ·  a always allow Execute  ·  Y YOLO  ·  n no');
  });

  it('wraps the choices under the question on narrow terminals', () => {
    const { dialog } = makeDialog();
    const lines = dialog.render(40).map(line => line.replace(/\x1b\[[0-9;]*m/g, ''));
    expect(lines).toEqual(['▎ Allow?', '▎ y yes  ·  a always allow Execute', '▎ Y YOLO  ·  n no']);
  });

  it('names the tool and lists its arguments when showTarget is set', () => {
    const dialog = new ToolApprovalDialogComponent({
      toolCallId: 'call-1',
      toolName: 'write_file',
      args: { path: 'src/auth.ts', overwrite: true },
      categoryLabel: 'Edit',
      showTarget: true,
      onAction: vi.fn(),
    });
    const lines = dialog.render(120).map(line => line.replace(/\x1b\[[0-9;]*m/g, ''));
    expect(lines).toEqual([
      '▎ Allow write_file?',
      '▎   path: src/auth.ts',
      '▎   overwrite: true',
      '▎ y yes  ·  a always allow Edit  ·  Y YOLO  ·  n no',
    ]);
  });

  it('shows long and multi-line arguments in full, wrapped, when showTarget is set', () => {
    const command = `node -e "${'x'.repeat(150)}"\necho done`;
    const dialog = new ToolApprovalDialogComponent({
      toolCallId: 'call-1',
      toolName: 'execute_command',
      args: { command, cwd: null },
      categoryLabel: 'Execute',
      showTarget: true,
      onAction: vi.fn(),
    });
    const lines = dialog.render(60).map(line => line.replace(/\x1b\[[0-9;]*m/g, ''));
    const shown = lines
      .slice(1, -2)
      .map(line => line.replace(/^▎ {3}/, ''))
      .join('');
    expect(shown).toContain('x'.repeat(150));
    expect(lines.some(line => line.includes('echo done'))).toBe(true);
    expect(lines.join('\n')).not.toContain('cwd');
    expect(lines.every(line => line.length <= 60)).toBe(true);
  });

  it('cuts very long arguments with a count and shows them in full on Ctrl+E', () => {
    const content = Array.from({ length: 60 }, (_, i) => `line ${i + 1}`).join('\n');
    const requestRender = vi.fn();
    const onAction = vi.fn();
    const dialog = new ToolApprovalDialogComponent({
      toolCallId: 'call-1',
      toolName: 'write_file',
      args: { path: 'notes.md', content },
      showTarget: true,
      onAction,
      requestRender,
    });
    const visible = () =>
      dialog
        .render(100)
        .map(line => line.replace(/\x1b\[[0-9;]*m/g, ''))
        .join('\n');

    expect(visible()).toContain('… 20 more lines · ctrl+e to show all');
    expect(visible()).not.toContain('line 60');

    dialog.handleInput('\x05');
    expect(requestRender).toHaveBeenCalled();
    expect(visible()).toContain('line 60');
    expect(visible()).not.toContain('more lines');
    expect(onAction).not.toHaveBeenCalled();
  });

  it('never renders wider than the terminal', () => {
    const { dialog } = makeDialog();
    for (const line of dialog.render(20)) {
      expect(line.replace(/\x1b\[[0-9;]*m/g, '').length).toBeLessThanOrEqual(20);
    }
  });
});
