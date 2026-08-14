// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

  it('leaves settled text as plain prose', () => {
    const { container } = render(<MarkdownRenderer>{'Two words'}</MarkdownRenderer>);

    expect(container.querySelectorAll('.mastra-markdown-word')).toHaveLength(0);
  });

  it('splits streamed text into one span per word', () => {
    const { container } = render(<MarkdownRenderer streaming>{'Two **bold** words'}</MarkdownRenderer>);

    const words = [...container.querySelectorAll('.mastra-markdown-word')].map(node => node.textContent);

    expect(words).toEqual(['Two', 'bold']);
    expect(container.querySelector('.mastra-markdown-word-pending')?.textContent).toBe('words');
  });

  it('fades a word once it is whole rather than as its characters land', () => {
    const { container, rerender } = render(<MarkdownRenderer streaming>{'Hello wor'}</MarkdownRenderer>);

    const growing = container.querySelector('.mastra-markdown-word-pending');

    expect(growing?.textContent).toBe('wor');

    rerender(<MarkdownRenderer streaming>{'Hello world a'}</MarkdownRenderer>);

    expect(growing?.textContent).toBe('world');
    expect(growing?.className).toBe('mastra-markdown-word');
    expect(container.querySelector('.mastra-markdown-word-pending')?.textContent).toBe('a');
  });

  it('holds back a trailing word that markup splits in two', () => {
    const { container } = render(<MarkdownRenderer streaming>{'Say Hel**lo**'}</MarkdownRenderer>);

    const held = [...container.querySelectorAll('.mastra-markdown-word-pending')].map(node => node.textContent);
    const landed = [...container.querySelectorAll('.mastra-markdown-word')].map(node => node.textContent);

    expect(held).toEqual(['Hel', 'lo']);
    expect(landed).toEqual(['Say']);
  });

  it('marks only the freshly landed tail of a long reply', () => {
    const reply = Array.from({ length: 60 }, (_, index) => `word${index}`).join(' ');

    const { container } = render(<MarkdownRenderer streaming>{reply}</MarkdownRenderer>);

    const marked = [...container.querySelectorAll('.mastra-markdown-word')].map(node => node.textContent);
    const landed = reply.split(' ').slice(0, -1);

    expect(marked.length).toBeGreaterThan(0);
    expect(marked.length).toBeLessThan(landed.length);
    expect(marked).toEqual(landed.slice(-marked.length));
  });

  it('leaves a streamed code fence whole', () => {
    const { container } = render(
      <TooltipProvider>
        <MarkdownRenderer streaming>{'```ts\nconst ok = true;\n```'}</MarkdownRenderer>
      </TooltipProvider>,
    );

    expect(screen.getByText('const ok = true;')).toBeDefined();
    expect(container.querySelectorAll('.mastra-markdown-word, .mastra-markdown-word-pending')).toHaveLength(0);
  });

  it('leaves the words already on screen in place when more text arrives', () => {
    const { container, rerender } = render(<MarkdownRenderer streaming>{'Hello there'}</MarkdownRenderer>);

    const [hello] = container.querySelectorAll('.mastra-markdown-word');
    const there = container.querySelector('.mastra-markdown-word-pending');

    rerender(<MarkdownRenderer streaming>{'Hello there, friend'}</MarkdownRenderer>);

    const words = container.querySelectorAll('.mastra-markdown-word');

    expect(words[0]).toBe(hello);
    expect(words[1]).toBe(there);
    expect([...words].map(node => node.textContent)).toEqual(['Hello', 'there,']);
  });

  it('remounts no block as the reply grows past it', () => {
    const { container, rerender } = render(<MarkdownRenderer streaming>{'First para.\n\nSecond'}</MarkdownRenderer>);

    const paragraphs = [...container.querySelectorAll('p')];

    rerender(<MarkdownRenderer streaming>{'First para.\n\nSecond para.'}</MarkdownRenderer>);

    expect([...container.querySelectorAll('p')]).toEqual(paragraphs);
  });

  it('keeps every element on screen when a reply stops streaming', () => {
    const reply = 'Intro para.\n\nSecond para.\n\n```ts\nconst ok = true;\n```\n';
    const { container, rerender } = render(
      <TooltipProvider>
        <MarkdownRenderer streaming>{reply}</MarkdownRenderer>
      </TooltipProvider>,
    );

    const before = [...container.querySelectorAll('p, figure')];

    rerender(
      <TooltipProvider>
        <MarkdownRenderer>{reply}</MarkdownRenderer>
      </TooltipProvider>,
    );

    expect([...container.querySelectorAll('p, figure')]).toEqual(before);
    expect(container.querySelectorAll('.mastra-markdown-word')).toHaveLength(0);
  });

  it('fades the word a block was holding once the reply moves past it', () => {
    const { container, rerender } = render(<MarkdownRenderer streaming>{'First'}</MarkdownRenderer>);

    const first = container.querySelector('.mastra-markdown-word-pending');

    rerender(<MarkdownRenderer streaming>{'First\n\nSecond'}</MarkdownRenderer>);

    const held = [...container.querySelectorAll('.mastra-markdown-word-pending')].map(node => node.textContent);

    expect(first?.className).toBe('mastra-markdown-word');
    expect(held).toEqual(['Second']);
  });

  it('closes a marker the stream has not caught up with', () => {
    const { container } = render(<MarkdownRenderer streaming>{'A **bold wo'}</MarkdownRenderer>);

    expect(container.querySelector('strong')?.textContent).toBe('bold wo');
  });

  it('renders a half-written link as its text rather than a dead anchor', () => {
    const { container } = render(<MarkdownRenderer streaming>{'See [the docs](https://mastra'}</MarkdownRenderer>);

    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toContain('the docs');
  });

  it('never sets a text-wrap style that re-breaks lines already on screen', () => {
    const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'markdown-renderer.css'), 'utf8');

    expect(css).toContain('.mastra-markdown {');
    expect(css).not.toMatch(/text-wrap(-style)?:\s*(pretty|balance)/);
  });
});
