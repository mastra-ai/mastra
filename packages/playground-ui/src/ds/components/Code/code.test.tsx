// @vitest-environment jsdom
import { Tree } from '@lezer/common';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { highlight } from '../CodeEditor/highlight';
import type { HighlightToken } from '../CodeEditor/highlight';
import { Code } from './code';

vi.mock('../CodeEditor/highlight', () => ({ highlight: vi.fn() }));

const TOKEN = '[class^="syntax-"]';

const result = (code: string, tokens: HighlightToken[][]) => ({ code, tokens, tree: Tree.empty });

const singleToken = async (code: string) => result(code, [[{ content: 'const', className: 'syntax-keyword' }]]);

/** One token per line, so the rendered tokens spell out exactly the code they came from. */
function lineTokens(code: string) {
  return result(
    code,
    code.split('\n').map(line => [{ content: line, className: 'syntax-name' }]),
  );
}

/** Highlighting that only lands when the test says so, like a pass trailing the streamed text. */
function deferredHighlight() {
  const pending: Array<() => void> = [];
  vi.mocked(highlight).mockImplementation(
    code => new Promise(resolve => pending.push(() => resolve(lineTokens(code)))),
  );

  return () => act(async () => pending.shift()?.());
}

beforeEach(() => {
  vi.mocked(highlight).mockImplementation(singleToken);
});

afterEach(() => {
  cleanup();
  vi.mocked(highlight).mockReset();
});

describe('Code', () => {
  it('renders plain text when no language is given', () => {
    render(<Code code="plain text content" />);

    const pre = screen.getByText('plain text content');

    expect(pre.tagName).toBe('PRE');
    expect(pre.querySelector(TOKEN)).toBeNull();
  });

  it('renders tokens with their syntax role class and no inline colors', async () => {
    render(<Code code="const ok = true;" lang="typescript" />);

    const token = await screen.findByText('const');

    expect(token.className).toBe('syntax-keyword');
    expect(token.getAttribute('style')).toBeNull();
  });

  describe('when lineClassName is given', () => {
    it('applies the class to matching highlighted lines', async () => {
      vi.mocked(highlight).mockImplementation(async code => lineTokens(code));
      const { container } = render(
        <Code code={'a\nb\nc'} lang="json" lineClassName={i => (i === 1 ? 'hit' : undefined)} />,
      );

      await screen.findByText('b');
      const lines = container.querySelectorAll('[data-line]');
      expect(lines).toHaveLength(3);
      expect(lines[1]?.classList.contains('hit')).toBe(true);
      expect(lines[0]?.classList.contains('hit')).toBe(false);
    });

    it('applies the class to plain-text lines while highlighting is pending', () => {
      deferredHighlight();
      const { container } = render(
        <Code code={'a\nb'} lang="json" lineClassName={(_, text) => (text === 'a' ? 'hit' : undefined)} />,
      );

      const lines = container.querySelectorAll('[data-line]');
      expect(lines).toHaveLength(2);
      expect(lines[0]?.classList.contains('hit')).toBe(true);
    });
  });

  it('passes className through to the pre element', () => {
    render(<Code code="x" className="custom-class" />);

    expect(screen.getByText('x').classList.contains('custom-class')).toBe(true);
  });

  it('keeps the settled colors and the full text while a streamed tail is still highlighting', async () => {
    const settle = deferredHighlight();

    const { container, rerender } = render(<Code code="const a" lang="typescript" />);
    await settle();

    rerender(<Code code="const a = 1" lang="typescript" />);

    const pre = container.querySelector('pre');

    expect(pre?.querySelector(TOKEN)?.textContent).toBe('const a');
    expect(pre?.textContent).toBe('const a = 1');
  });

  it('falls back to plain text when the code is rewritten rather than appended to', async () => {
    const settle = deferredHighlight();

    const { container, rerender } = render(<Code code="const a" lang="typescript" />);
    await settle();

    rerender(<Code code="let b" lang="typescript" />);

    const pre = container.querySelector('pre');

    expect(pre?.querySelector(TOKEN)).toBeNull();
    expect(pre?.textContent).toBe('let b');
  });

  it('drops the colors when the language changes under unchanged code', async () => {
    const settle = deferredHighlight();

    const { container, rerender } = render(<Code code="const a" lang="typescript" />);
    await settle();

    rerender(<Code code="const a" lang="python" />);

    const pre = container.querySelector('pre');

    expect(pre?.querySelector(TOKEN)).toBeNull();
    expect(pre?.textContent).toBe('const a');
  });

  it('renders an unclassed token without a class', async () => {
    vi.mocked(highlight).mockImplementation(async code => result(code, [[{ content: 'plain' }]]));

    const { container } = render(<Code code="plain" lang="typescript" />);
    await act(async () => {});

    const token = container.querySelector('pre span span');
    expect(token?.textContent).toBe('plain');
    expect(token?.hasAttribute('class')).toBe(false);
  });

  it('puts a newline between lines but not after the last one', async () => {
    const settle = deferredHighlight();

    const { container } = render(<Code code={'a\nb\nc'} lang="typescript" />);
    await settle();

    // Exactly the code it was given — no trailing newline of its own.
    expect(container.querySelector('pre')?.textContent).toBe('a\nb\nc');
    expect(container.querySelectorAll(TOKEN)).toHaveLength(3);
  });

  it('keeps rendering plain text while the first pass is still running', () => {
    deferredHighlight();

    const { container } = render(<Code code="const a" lang="typescript" />);

    expect(container.querySelector(TOKEN)).toBeNull();
    expect(container.querySelector('pre')?.textContent).toBe('const a');
  });

  it('stays plain when highlighting comes back empty', async () => {
    vi.mocked(highlight).mockImplementation(async code => result(code, []));

    const { container } = render(<Code code="const a" lang="typescript" />);
    await act(async () => {});

    expect(container.querySelector(TOKEN)).toBeNull();
    expect(container.querySelector('pre')?.textContent).toBe('const a');
  });

  it('stays plain when highlighting fails', async () => {
    vi.mocked(highlight).mockImplementation(async () => {
      throw new Error('no grammar for that language');
    });

    const { container } = render(<Code code="const a" lang="typescript" />);
    await act(async () => {});

    expect(container.querySelector(TOKEN)).toBeNull();
    expect(container.querySelector('pre')?.textContent).toBe('const a');
  });

  it('does not highlight at all without a language', () => {
    render(<Code code="plain text content" />);

    expect(vi.mocked(highlight)).not.toHaveBeenCalled();
  });

  it('drops the colors when the language is taken away', async () => {
    const settle = deferredHighlight();

    const { container, rerender } = render(<Code code="const a" lang="typescript" />);
    await settle();
    expect(container.querySelector(TOKEN)).not.toBeNull();

    rerender(<Code code="const a" />);
    await act(async () => {});

    expect(container.querySelector(TOKEN)).toBeNull();
  });

  it('does not let a superseded pass roll the colors back to an earlier prefix', async () => {
    const pending: Array<() => void> = [];
    vi.mocked(highlight).mockImplementation(
      code => new Promise(resolve => pending.push(() => resolve(lineTokens(code)))),
    );

    const { container, rerender } = render(<Code code="const a" lang="typescript" />);
    rerender(<Code code="const a = 1" lang="typescript" />);

    // The pass for the current code lands first; the stale one for the shorter
    // prefix lands after, and would otherwise uncolor the tail it already had.
    await act(async () => pending.pop()?.());
    await act(async () => pending.pop()?.());

    expect(container.querySelector(TOKEN)?.textContent).toBe('const a = 1');
  });

  it('ignores a pass that lands after the code moved on', async () => {
    const pending: Array<() => void> = [];
    vi.mocked(highlight).mockImplementation(
      code => new Promise(resolve => pending.push(() => resolve(lineTokens(code)))),
    );

    const { container, rerender } = render(<Code code="const a" lang="typescript" />);
    rerender(<Code code="let b" lang="typescript" />);

    // The first pass finishes last; its tokens belong to code that is gone.
    await act(async () => pending.pop()?.());
    await act(async () => pending.pop()?.());

    expect(container.querySelector('pre')?.textContent).toBe('let b');
  });
});
