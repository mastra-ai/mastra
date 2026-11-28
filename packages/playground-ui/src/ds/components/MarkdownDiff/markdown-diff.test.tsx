// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { diffMarkdown } from './diff-markdown';
import { MarkdownDiff } from './markdown-diff';

afterEach(cleanup);

const changes = (container: HTMLElement, tag: 'ins' | 'del') =>
  [...container.querySelectorAll(tag)].map(node => node.textContent?.replace(/^(Added|Removed): /, ''));

describe('MarkdownDiff', () => {
  it('marks the words that changed inside a sentence and keeps the spaces around them', () => {
    const { container } = render(
      <MarkdownDiff before="Write like a friendly vendor who knows." after="Write like a colleague who knows." />,
    );

    expect(changes(container, 'del')).toEqual(['friendly vendor']);
    expect(changes(container, 'ins')).toEqual(['colleague']);
    expect(container.textContent?.replace(/(Added|Removed): /g, '')).toBe(
      'Write like a friendly vendor colleague who knows.',
    );
  });

  it('leaves punctuation next to a change unmarked', () => {
    const { container } = render(
      <MarkdownDiff before="Use the customer’s first name." after="Use the customer’s first name and plain words." />,
    );

    expect(changes(container, 'ins')).toEqual(['and plain words']);
    expect(container.querySelector('del')).toBeNull();
  });

  it('keeps an added list item a list item', () => {
    const { container } = render(<MarkdownDiff before={'- one\n- two'} after={'- one\n- two\n- three'} />);

    expect(container.querySelectorAll('li')).toHaveLength(3);
    expect(container.querySelector('li:last-child ins')?.textContent).toBe('Added: three');
  });

  it('keeps a removed heading a heading', () => {
    const { container } = render(<MarkdownDiff before={'## Do\n\nText'} after="Text" />);

    expect(container.querySelector('h2 del')?.textContent).toBe('Removed: Do');
  });

  it('shows no changes when the two texts match', () => {
    const { container } = render(<MarkdownDiff before="Same **text**" after="Same **text**" />);

    expect(container.querySelector('ins, del')).toBeNull();
    expect(container.querySelector('strong')?.textContent).toBe('text');
  });

  it('wraps formatted words without breaking their formatting', () => {
    const { container } = render(<MarkdownDiff before="Use the tool." after="Use the `search_records` tool." />);

    expect(container.querySelector('ins code')?.textContent).toBe('search_records');
  });

  it('leaves code blocks unmarked', () => {
    const before = '```sh\nnpm i\n```';
    const after = '```sh\nnpm ci\n```';
    const { container } = render(<MarkdownDiff before={before} after={after} />);

    expect(container.querySelector('ins, del')).toBeNull();
    expect(container.textContent).toContain('npm ci');
    expect(container.textContent).not.toMatch(/[\uE000-\uE003]/);
  });
});

describe('diffMarkdown', () => {
  it('counts changed lines as additions and deletions, ignoring blank lines', () => {
    const result = diffMarkdown('a\n\nb\nc', 'a\n\nb changed\nc\nd\n');

    expect(result.additions).toBe(2);
    expect(result.deletions).toBe(1);
  });
});
