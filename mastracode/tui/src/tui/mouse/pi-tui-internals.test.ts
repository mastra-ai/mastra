import { Box, Editor, SelectList, SettingsList, Text, TUI } from '@earendil-works/pi-tui';
import type { Terminal } from '@earendil-works/pi-tui';
import { describe, expect, it } from 'vitest';

import { getEditorTheme, getSelectListTheme, getSettingsListTheme } from '../theme.js';
import {
  boxPadding,
  editorInternals,
  selectListInternals,
  settingsListInternals,
  tuiInternals,
} from './pi-tui-internals.js';

/**
 * Upgrade guard: mouse support reads pi-tui private state. These run against the real pinned pi-tui
 * classes, so a renamed field or changed method fails here instead of silently breaking the mouse.
 */

function fakeTerminal(): Terminal {
  return {
    start() {},
    stop() {},
    async drainInput() {},
    write() {},
    columns: 80,
    rows: 24,
    kittyProtocolActive: false,
    moveBy() {},
    hideCursor() {},
    showCursor() {},
    clearLine() {},
    clearFromCursor() {},
    clearScreen() {},
    setTitle() {},
    setProgress() {},
  };
}

function createEditor() {
  const ui = new TUI(fakeTerminal());
  const editor = new Editor(ui, getEditorTheme());
  editor.focused = true;
  return editor;
}

describe('pi-tui internals used by mouse support', () => {
  it('editor exposes the layout state used to map pointer positions to text', () => {
    const editor = createEditor();
    editor.setText('first line\n' + 'word '.repeat(12).trim());
    editor.render(24);

    const internals = editorInternals(editor);
    expect(internals.state.lines).toEqual(['first line', 'word '.repeat(12).trim()]);
    expect(internals.state.cursorLine).toBe(1);
    expect(internals.state.cursorCol).toBe(internals.state.lines[1]!.length);
    expect(typeof internals.scrollOffset).toBe('number');
    expect(internals.lastWidth).toBeGreaterThan(0);
    expect(internals.lastWidth).toBeLessThanOrEqual(24);

    const visual = internals.buildVisualLineMap(internals.lastWidth);
    expect(visual[0]).toEqual({ logicalLine: 0, startCol: 0, length: 'first line'.length });
    const wrapped = visual.filter(line => line.logicalLine === 1);
    expect(wrapped.length).toBeGreaterThan(1);
    expect(wrapped[0]!.startCol).toBe(0);
    expect(wrapped[1]!.startCol).toBeGreaterThan(0);
  });

  it('editor scrollOffset tracks the first visible row when the text is taller than the box', () => {
    const editor = createEditor();
    editor.setText(Array.from({ length: 40 }, (_, i) => `line-${i}`).join('\n'));
    editor.render(40);
    expect(editorInternals(editor).scrollOffset).toBeGreaterThan(0);
  });

  it('editor segments a paste marker as one unit and expands it back to the pasted text', () => {
    const editor = createEditor();
    const pasted = Array.from({ length: 20 }, (_, i) => `pasted ${i}`).join('\n');
    editor.handleInput(`\x1b[200~${pasted}\x1b[201~`);

    const internals = editorInternals(editor);
    const line = internals.state.lines[0]!;
    expect(line).toMatch(/^\[paste #1 [^\]]+\]$/);
    const segments = [...internals.segment(line, 'grapheme')].map(s => s.segment);
    expect(segments).toEqual([line]);
    expect(internals.expandPasteMarkers(line)).toBe(pasted);
    // Segments carry their offset in the line, which mouse positions snap to.
    expect([...internals.segment(`ab${line}😀c`, 'grapheme')].map(s => s.index)).toEqual([
      0,
      1,
      2,
      2 + line.length,
      4 + line.length,
    ]);
  });

  it('editor setCursorCol moves the cursor and pushUndoSnapshot makes a direct edit undoable', () => {
    const editor = createEditor();
    editor.setText('hello world');
    const internals = editorInternals(editor);

    internals.setCursorCol(5);
    expect(internals.state.cursorCol).toBe(5);

    internals.pushUndoSnapshot();
    internals.state.lines = ['hello'];
    internals.setCursorCol(5);
    editor.handleInput('\x1f');
    expect(editor.getText()).toBe('hello world');
  });

  it('editor keeps lastAction and onChange as writable fields', () => {
    const editor = createEditor();
    const internals = editorInternals(editor);
    const changes: string[] = [];
    internals.onChange = text => changes.push(text);
    editor.handleInput('a');
    expect(changes).toEqual(['a']);
    expect(internals.lastAction === null || typeof internals.lastAction === 'string').toBe(true);
  });

  it('TUI exposes the render and overlay state used to place pointer events', () => {
    const ui = new TUI(fakeTerminal());
    ui.addChild(new Text('frame', 0, 0));
    const internals = tuiInternals(ui);
    internals.doRender();
    expect(internals.previousLines.some(line => line.includes('frame'))).toBe(true);
    expect(typeof internals.hardwareCursorRow).toBe('number');
    expect(internals.getTopmostVisibleOverlay()).toBeUndefined();

    const overlay = new Text('modal', 0, 0);
    ui.showOverlay(overlay, { width: 20 });
    expect(internals.getTopmostVisibleOverlay()?.component).toBe(overlay);
    const layout = internals.resolveOverlayLayout({ width: 20 }, 3, 80, 24);
    expect(layout).toMatchObject({ width: 20 });
    expect(typeof layout.row).toBe('number');
    expect(typeof layout.col).toBe('number');
  });

  it('Box, SelectList and SettingsList expose the fields used for hit-testing', () => {
    expect(boxPadding(new Box(4, 2))).toMatchObject({ paddingX: 4, paddingY: 2 });

    const items = [
      { value: 'a', label: 'a' },
      { value: 'b', label: 'b' },
    ];
    const list = selectListInternals(new SelectList(items, 7, getSelectListTheme()));
    expect(list).toMatchObject({ filteredItems: items, selectedIndex: 0, maxVisible: 7 });

    const settings = settingsListInternals(
      new SettingsList(
        [{ id: 'mode', label: 'Mode', currentValue: 'x', values: ['x', 'y'] }],
        5,
        getSettingsListTheme(),
        () => {},
        () => {},
      ),
    );
    expect(settings).toMatchObject({ selectedIndex: 0, maxVisible: 5, searchEnabled: false, submenuComponent: null });
    expect(settings.items).toHaveLength(1);
    expect(settings.filteredItems).toHaveLength(1);
    settings.activateItem();
    expect(settings.items[0]!.currentValue).toBe('y');
  });
});
