// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { highlight } from '../CodeEditor/highlight';
import { Code } from './code';

const singleToken = vi.hoisted(() => async () => [
  [
    {
      content: 'const',
      htmlStyle: {
        '--shiki-light': '#24292f',
        '--shiki-dark': '#c9d1d9',
      },
    },
  ],
]);

vi.mock('../CodeEditor/highlight', () => ({ highlight: vi.fn() }));

/** One token per line, so the rendered tokens spell out exactly the code they came from. */
function lineTokens(code: string) {
  return code.split('\n').map(line => [{ content: line }]);
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
    expect(pre.querySelector('.shiki-token')).toBeNull();
  });

  it('renders tokens with theme CSS variables instead of resolved colors', async () => {
    render(<Code code="const ok = true;" lang="typescript" />);

    const token = await screen.findByText('const');

    expect(token.classList.contains('shiki-token')).toBe(true);
    expect(token.style.getPropertyValue('--shiki-light')).toBe('#24292f');
    expect(token.style.getPropertyValue('--shiki-dark')).toBe('#c9d1d9');
    expect(token.style.color).toBe('');
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

    expect(pre?.querySelector('.shiki-token')?.textContent).toBe('const a');
    expect(pre?.textContent).toBe('const a = 1');
  });

  it('falls back to plain text when the code is rewritten rather than appended to', async () => {
    const settle = deferredHighlight();

    const { container, rerender } = render(<Code code="const a" lang="typescript" />);
    await settle();

    rerender(<Code code="let b" lang="typescript" />);

    const pre = container.querySelector('pre');

    expect(pre?.querySelector('.shiki-token')).toBeNull();
    expect(pre?.textContent).toBe('let b');
  });

  it('drops the colors when the language changes under unchanged code', async () => {
    const settle = deferredHighlight();

    const { container, rerender } = render(<Code code="const a" lang="typescript" />);
    await settle();

    rerender(<Code code="const a" lang="python" />);

    const pre = container.querySelector('pre');

    expect(pre?.querySelector('.shiki-token')).toBeNull();
    expect(pre?.textContent).toBe('const a');
  });
});
