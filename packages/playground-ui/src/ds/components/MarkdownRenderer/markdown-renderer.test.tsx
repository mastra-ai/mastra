// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TooltipProvider } from '../Tooltip';
import { MarkdownRenderer } from './markdown-renderer';

vi.mock('@/ds/components/CodeEditor/highlight', () => ({
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

describe('MarkdownRenderer', () => {
  it('renders fenced code blocks through the shared Code renderer', async () => {
    render(
      <TooltipProvider>
        <MarkdownRenderer>{'```typescript\nconst ok = true;\n```'}</MarkdownRenderer>
      </TooltipProvider>,
    );

    const token = await screen.findByText('const');

    expect(token.classList.contains('shiki-token')).toBe(true);
    expect(token.style.getPropertyValue('--shiki-light')).toBe('#24292f');
    expect(token.style.getPropertyValue('--shiki-dark')).toBe('#c9d1d9');
    expect(token.closest('pre')).not.toBeNull();
    expect(token.closest('pre')?.classList.contains('whitespace-pre-wrap')).toBe(true);
    expect(token.closest('pre')?.classList.contains('break-words')).toBe(true);
  });

  it('renders inline code as a plain non-copyable <code> element', () => {
    render(
      <TooltipProvider>
        <MarkdownRenderer>{'Use the `MASTRA_API_KEY` env var.'}</MarkdownRenderer>
      </TooltipProvider>,
    );

    const inline = screen.getByText('MASTRA_API_KEY');

    expect(inline.tagName).toBe('CODE');
    expect(inline.closest('pre')).toBeNull();
    expect(inline.querySelector('.shiki-token')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Copy to clipboard' })).toBeNull();
  });
});
