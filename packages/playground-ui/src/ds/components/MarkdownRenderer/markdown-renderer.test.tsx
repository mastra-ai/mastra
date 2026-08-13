// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
  vi.restoreAllMocks();
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

  it('opens external links in a new tab without granting opener access', () => {
    render(<MarkdownRenderer>{'[Authorize Gmail](https://connect.composio.dev/link)'}</MarkdownRenderer>);

    const link = screen.getByRole<HTMLAnchorElement>('link', { name: 'Authorize Gmail' });

    expect(link.target).toBe('_blank');
    expect(link.rel).toBe('noopener noreferrer');
    expect(link.hasAttribute('node')).toBe(false);
  });

  it('drops link schemes that can execute, and keeps the visible text', () => {
    render(
      <MarkdownRenderer>
        {'[Claim your run](javascript:alert(1)) and [export](data:text/html,<script/>)'}
      </MarkdownRenderer>,
    );

    for (const text of ['Claim your run', 'export']) {
      expect(screen.getByText(text).getAttribute('href')).toBe('');
    }
  });

  it('renders raw HTML in the source as text instead of markup', () => {
    render(<MarkdownRenderer>{'<img src=x onerror="alert(1)"> done'}</MarkdownRenderer>);

    expect(document.querySelector('img')).toBeNull();
    expect(document.body.textContent).toContain('<img src=x onerror="alert(1)">');
  });

  it('keeps escaped newlines inside a fenced block that already has real ones', () => {
    render(
      <TooltipProvider>
        <MarkdownRenderer>{'```js\nconst s = "a\\nb";\n```'}</MarkdownRenderer>
      </TooltipProvider>,
    );

    expect(screen.getByText('const s = "a\\nb";')).toBeTruthy();
  });

  it('requests a separate browser window for external links when configured', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(window);
    render(
      <MarkdownRenderer externalLinkTarget="window">
        {'[Authorize Gmail](https://connect.composio.dev/link)'}
      </MarkdownRenderer>,
    );

    fireEvent.click(screen.getByRole('link', { name: 'Authorize Gmail' }));

    expect(openSpy).toHaveBeenCalledWith(
      'https://connect.composio.dev/link',
      '_blank',
      expect.stringContaining('popup=yes'),
    );
  });

  it('falls back to a new tab when the browser blocks the requested window', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    render(
      <MarkdownRenderer externalLinkTarget="window">
        {'[Authorize Gmail](https://connect.composio.dev/link)'}
      </MarkdownRenderer>,
    );

    const link = screen.getByRole<HTMLAnchorElement>('link', { name: 'Authorize Gmail' });
    const defaultAllowed = fireEvent.click(link);

    expect(openSpy).toHaveBeenCalledOnce();
    expect(defaultAllowed).toBe(true);
    expect(link.target).toBe('_blank');
    expect(link.rel).toBe('noopener noreferrer');
  });

  it('keeps internal links in the current tab', () => {
    render(<MarkdownRenderer>{'[Agent settings](/agents/settings)'}</MarkdownRenderer>);

    const link = screen.getByRole<HTMLAnchorElement>('link', { name: 'Agent settings' });

    expect(link.target).toBe('');
    expect(link.rel).toBe('');
  });
});
