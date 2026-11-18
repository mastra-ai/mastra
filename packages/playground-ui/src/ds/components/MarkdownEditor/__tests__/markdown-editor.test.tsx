// @vitest-environment jsdom
import { EditorSelection } from '@codemirror/state';
import type { SelectionRange } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { MarkdownEditor } from '../markdown-editor';
import { TooltipProvider } from '@/ds/components/Tooltip';

const open = (initial: string, { editable = true } = {}) => {
  const onChange = vi.fn<(value: string) => void>();
  render(
    <TooltipProvider>
      <MarkdownEditor aria-label="Instructions" value={initial} onChange={onChange} editable={editable} />
    </TooltipProvider>,
  );
  const textbox = screen.getByRole('textbox', { name: 'Instructions' });
  const view = EditorView.findFromDOM(textbox);
  if (!view) throw new Error('No editor view');
  return { textbox, view, saved: () => onChange.mock.lastCall?.[0] };
};

const shownLines = (textbox: HTMLElement) => [...textbox.querySelectorAll('.cm-line')].map(line => line.textContent);

const setSelection = (view: EditorView, selection: SelectionRange) => {
  act(() => {
    view.focus();
    view.dispatch({ selection });
  });
};

const select = (view: EditorView, text: string) => {
  const from = view.state.doc.toString().indexOf(text);
  setSelection(view, EditorSelection.range(from, from + text.length));
};

const placeCaret = (view: EditorView, pos: number) => setSelection(view, EditorSelection.cursor(pos));

describe('MarkdownEditor — what it shows', () => {
  it('reads like the rendered page while nobody is editing it', () => {
    const { textbox } = open(
      '# Review\n\nRead the **whole** diff, run `pnpm test`, see [docs](https://mastra.ai).\n- one\n> careful',
    );

    expect(shownLines(textbox)).toEqual([
      'Review',
      '',
      'Read the whole diff, run pnpm test, see docs.',
      '• one',
      'careful',
    ]);
  });

  it("shows a block's markdown once the caret is on its line", () => {
    const { textbox, view } = open('# Review\n\n- one\n- two');

    placeCaret(view, view.state.doc.line(3).to);

    expect(view.hasFocus).toBe(true);
    expect(shownLines(textbox)).toEqual(['Review', '', '- one', '• two']);
  });

  it("shows an inline span's markdown only while the caret is inside it", () => {
    const { textbox, view } = open('Read **all** of [it](https://mastra.ai)');

    placeCaret(view, 'Read **a'.length);
    expect(shownLines(textbox)).toEqual(['Read **all** of it']);

    placeCaret(view, 'Read **all** of [i'.length);
    expect(shownLines(textbox)).toEqual(['Read all of [it](https://mastra.ai)']);
  });

  it('opens a link whose title sits on the next line', () => {
    const { textbox } = open('See [docs](https://mastra.ai\n"Mastra docs") first');

    expect(shownLines(textbox)).toEqual(['See [docs](https://mastra.ai', '"Mastra docs") first']);
  });
});

describe('MarkdownEditor — formatting', () => {
  it('bolds the selected words', async () => {
    const { view, saved } = open('Keep notes specific');
    const user = userEvent.setup();

    select(view, 'specific');
    await user.keyboard('{Control>}b{/Control}');

    expect(saved()).toBe('Keep notes **specific**');
  });

  it('takes the formatting off text that already has it', async () => {
    const { view, saved } = open('Keep notes **specific**');
    const user = userEvent.setup();

    select(view, 'specific');
    await user.keyboard('{Control>}b{/Control}');

    expect(saved()).toBe('Keep notes specific');
  });

  it('formats each selected list item without breaking the list', async () => {
    const { view, saved } = open('- one\n- two');
    const user = userEvent.setup();

    select(view, 'one\n- two');
    await user.keyboard('{Control>}i{/Control}');

    expect(saved()).toBe('- *one*\n- *two*');
  });

  it('bolds the prose around a code block and a divider without touching either', async () => {
    const { view, saved } = open('Intro\n```ts\nconst a = 1\n```\n***\nOutro');
    const user = userEvent.setup();

    select(view, view.state.doc.toString());
    await user.keyboard('{Control>}b{/Control}');

    expect(saved()).toBe('**Intro**\n```ts\nconst a = 1\n```\n***\n**Outro**');
  });

  it('bolds a word inside a table cell', async () => {
    const { view, saved } = open('| Step | Owner |\n| --- | --- |\n| Lint | Bot |');
    const user = userEvent.setup();

    select(view, 'Lint');
    await user.keyboard('{Control>}b{/Control}');

    expect(saved()).toBe('| Step | Owner |\n| --- | --- |\n| **Lint** | Bot |');
  });

  it('leaves a selection that crosses table cells alone so the cells keep their pipes', async () => {
    const { view, saved } = open('| Step | Owner |\n| --- | --- |\n| Lint | Bot |');
    const user = userEvent.setup();

    select(view, 'Lint | Bot');
    await user.keyboard('{Control>}b{/Control}');

    expect(saved()).toBeUndefined();
  });

  it('leaves whole table rows alone so the cells keep their pipes', async () => {
    const { view, saved } = open('| Step | Owner |\n| --- | --- |\n| Lint | Bot |');
    const user = userEvent.setup();

    select(view, view.state.doc.toString());
    await user.keyboard('{Control>}b{/Control}');

    expect(saved()).toBeUndefined();
  });

  it('types bold text from a shortcut at the caret, and the same shortcut ends it', async () => {
    const { view, saved } = open('Say ');
    const user = userEvent.setup();

    placeCaret(view, view.state.doc.length);
    await user.keyboard('{Control>}b{/Control}loud{Control>}b{/Control} quiet');

    expect(saved()).toBe('Say **loud** quiet');
  });

  it('types bold italic text from both shortcuts at the caret', async () => {
    const { view, saved } = open('Say ');
    const user = userEvent.setup();

    placeCaret(view, view.state.doc.length);
    await user.keyboard('{Control>}b{/Control}{Control>}i{/Control}loud');

    expect(saved()).toBe('Say ***loud***');
  });

  it('leaves code alone when a shortcut is pressed inside a code block', async () => {
    const { view, saved } = open('```\nconst a = 1\n```');
    const user = userEvent.setup();

    placeCaret(view, '```\nconst'.length);
    await user.keyboard('{Control>}b{/Control}{Control>}k{/Control}');

    expect(saved()).toBeUndefined();
    expect(view.state.doc.toString()).toBe('```\nconst a = 1\n```');
  });

  it('offers formatting for selected text and marks what the selection already has', async () => {
    const { textbox, view, saved } = open('Keep notes **specific**');
    const user = userEvent.setup();

    expect(screen.queryByRole('toolbar', { name: 'Formatting' })).toBeNull();

    select(view, 'specific');
    const toolbar = await screen.findByRole('toolbar', { name: 'Formatting' });
    const pressed = (name: string) => within(toolbar).getByRole('button', { name }).getAttribute('aria-pressed');
    expect(pressed('Bold')).toBe('true');
    expect(pressed('Italic')).toBe('false');

    await user.click(within(toolbar).getByRole('button', { name: 'Italic' }));

    expect(saved()).toBe('Keep notes ***specific***');
    expect(document.activeElement).toBe(textbox);
    expect(pressed('Italic')).toBe('true');
  });

  it('puts the formatting away once the selection collapses', async () => {
    const { view } = open('Keep notes specific');

    select(view, 'specific');
    await screen.findByRole('toolbar', { name: 'Formatting' });

    placeCaret(view, 0);
    await waitFor(() => expect(screen.queryByRole('toolbar', { name: 'Formatting' })).toBeNull());
  });

  it('links the selected words to a pasted URL', async () => {
    const { view, saved } = open('See the docs first');
    const user = userEvent.setup();

    select(view, 'docs');
    await user.paste('https://mastra.ai/docs');

    expect(saved()).toBe('See the [docs](https://mastra.ai/docs) first');
  });

  it('leaves read-only text alone when a URL is pasted over it', () => {
    const { view, saved } = open('See the docs first', { editable: false });

    select(view, 'docs');
    fireEvent.paste(view.contentDOM, { clipboardData: { getData: () => 'https://mastra.ai/docs' } });

    expect(saved()).toBeUndefined();
    expect(view.state.doc.toString()).toBe('See the docs first');
  });

  it('links the selected words to a URL typed after the shortcut', async () => {
    const { view, saved } = open('See the docs first');
    const user = userEvent.setup();

    select(view, 'docs');
    await user.keyboard('{Control>}k{/Control}https://mastra.ai/docs');

    expect(saved()).toBe('See the [docs](https://mastra.ai/docs) first');
  });
});

describe('MarkdownEditor — slash menu', () => {
  it('turns a line into the block picked after a slash', async () => {
    const { view, saved } = open('');
    const user = userEvent.setup();

    placeCaret(view, 0);
    await user.keyboard('/bul');
    await user.click(await screen.findByRole('option', { name: /Bulleted list/ }));
    await user.keyboard('First step');

    expect(saved()).toBe('- First step');
  });

  it('adds a divider under a paragraph without turning the paragraph into a heading', async () => {
    const { view, saved } = open('Intro\n');
    const user = userEvent.setup();

    placeCaret(view, view.state.doc.length);
    await user.keyboard('/div');
    await user.click(await screen.findByRole('option', { name: /Divider/ }));

    expect(saved()).toBe('Intro\n***\n');
  });

  it('keeps a slash typed inside a sentence as plain text', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    onTestFinished(() => vi.useRealTimers());
    const { view, saved } = open('either');
    const user = userEvent.setup({
      advanceTimers: ms => {
        vi.advanceTimersByTime(ms);
      },
    });

    placeCaret(view, view.state.doc.length);
    await user.keyboard('/h');
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(saved()).toBe('either/h');
  });
});
