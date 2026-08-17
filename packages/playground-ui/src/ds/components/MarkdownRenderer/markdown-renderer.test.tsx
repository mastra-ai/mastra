// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
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
  vi.useRealTimers();
});

/** All three need fake timers, which stand in for the frame clock. */
const frames = (until: () => boolean) => {
  for (let frame = 0; frame < 400 && !until(); frame++) {
    act(() => void vi.advanceTimersByTime(16));
  }
};

const settle = () => frames(() => false);
const arrive = (container: HTMLElement, text: string) => frames(() => !!container.textContent?.endsWith(text));

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

  it('renders a reply that is not streaming whole, with nothing left to animate', () => {
    const { container } = render(<MarkdownRenderer>{'Two words'}</MarkdownRenderer>);

    expect(container.textContent).toBe('Two words');
    expect(container.querySelectorAll('.mastra-markdown-arriving')).toHaveLength(0);
  });

  it('reveals a streamed reply a word at a time', () => {
    vi.useFakeTimers();
    const { container } = render(<MarkdownRenderer streaming>{'Two **bold** words here'}</MarkdownRenderer>);

    expect(container.textContent).toBe('');

    arrive(container, 'Two');
    expect(container.textContent).toBe('Two');

    arrive(container, 'bold');
    expect(container.textContent).toBe('Two bold');
  });

  it('never remounts a word that has landed, however far the reply runs past it', () => {
    vi.useFakeTimers();
    const reply = Array.from({ length: 60 }, (_, index) => `word${index}`).join(' ');
    const { container, rerender } = render(<MarkdownRenderer streaming>{'word0'}</MarkdownRenderer>);
    const held = (text: string) => [...container.querySelectorAll('span')].find(node => node.textContent === text);

    rerender(<MarkdownRenderer streaming>{reply}</MarkdownRenderer>);
    arrive(container, 'word2');
    const early = held('word1');

    arrive(container, 'word45');

    expect(early?.textContent).toBe('word1');
    expect(held('word1')).toBe(early);
  });

  it('animates only what lands after it joined a reply already under way', () => {
    vi.useFakeTimers();
    const word = (index: number) => `word${index}`;
    const { container } = render(
      <MarkdownRenderer streaming>{Array.from({ length: 40 }, (_, index) => word(index)).join(' ')}</MarkdownRenderer>,
    );

    const joined = container.textContent ?? '';

    expect(joined).toBe(Array.from({ length: 28 }, (_, index) => word(index)).join(' '));
    expect(container.querySelectorAll('.mastra-markdown-arriving')).toHaveLength(0);

    arrive(container, word(39));

    const animated = [...container.querySelectorAll('.mastra-markdown-arriving')].map(node => node.textContent);

    expect(animated).toEqual(Array.from({ length: 12 }, (_, index) => word(index + 28)));
  });

  it('fades inline code in whole rather than a letter at a time', () => {
    vi.useFakeTimers();
    const { container } = render(<MarkdownRenderer streaming>{'Run `npm i` now'}</MarkdownRenderer>);

    arrive(container, 'now');

    const code = container.querySelector('code');

    expect(code?.textContent).toBe('npm i');
    expect(code?.classList.contains('mastra-markdown-arriving')).toBe(true);
    expect(code?.querySelector('span')).toBeNull();
  });

  it('fades a code block in whole, background and all', () => {
    vi.useFakeTimers();
    const { container } = render(
      <TooltipProvider>
        <MarkdownRenderer streaming>{'```ts\nconst ok = true;\n```'}</MarkdownRenderer>
      </TooltipProvider>,
    );

    settle();

    const block = container.querySelector('figure');

    expect(block?.classList.contains('mastra-markdown-arriving')).toBe(true);
    expect(block?.querySelector('.mastra-markdown-arriving')).toBeNull();
  });

  it('remounts no block as the reply grows past it', () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<MarkdownRenderer streaming>{'First para.\n\nSecond'}</MarkdownRenderer>);

    arrive(container, 'Second');
    const paragraphs = [...container.querySelectorAll('p')];

    rerender(<MarkdownRenderer streaming>{'First para.\n\nSecond para.'}</MarkdownRenderer>);
    arrive(container, 'para.');

    expect([...container.querySelectorAll('p')]).toEqual(paragraphs);
  });

  it('keeps every element on screen when a reply stops streaming', () => {
    vi.useFakeTimers();
    const reply = 'Intro para.\n\nSecond para.\n\n```ts\nconst ok = true;\n```\n';
    const { container, rerender } = render(
      <TooltipProvider>
        <MarkdownRenderer streaming>{reply}</MarkdownRenderer>
      </TooltipProvider>,
    );

    settle();
    const before = [...container.querySelectorAll('p, figure')];

    rerender(
      <TooltipProvider>
        <MarkdownRenderer>{reply}</MarkdownRenderer>
      </TooltipProvider>,
    );

    expect([...container.querySelectorAll('p, figure')]).toEqual(before);
  });

  it('closes a marker the stream has not caught up with', () => {
    vi.useFakeTimers();
    const { container } = render(<MarkdownRenderer streaming>{'A **bold wo'}</MarkdownRenderer>);

    arrive(container, 'wo');

    expect(container.querySelector('strong')?.textContent).toBe('bold wo');
  });

  it('renders a half-written link as its text rather than a dead anchor', () => {
    vi.useFakeTimers();
    const { container } = render(<MarkdownRenderer streaming>{'See [the docs](https://mastra'}</MarkdownRenderer>);

    arrive(container, 'docs');

    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toContain('the docs');
  });

  it('never sets a text-wrap style that re-breaks lines already on screen', () => {
    const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'markdown-renderer.css'), 'utf8');

    expect(css).toContain('.mastra-markdown {');
    expect(css).not.toMatch(/text-wrap(-style)?:\s*(pretty|balance)/);
  });
});
