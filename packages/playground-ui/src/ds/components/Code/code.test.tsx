// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Code } from './code';

vi.mock('../CodeEditor/highlight', () => ({
  highlight: vi.fn(async () => [
    [
      {
        content: 'const',
        htmlStyle: {
          '--shiki-light': '#24292f',
          '--shiki-dark': '#c9d1d9',
        },
      },
    ],
  ]),
}));

afterEach(() => {
  cleanup();
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
});
