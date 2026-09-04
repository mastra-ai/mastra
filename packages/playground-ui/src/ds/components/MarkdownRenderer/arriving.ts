import type { ExtraProps } from 'react-markdown';

import { ARRIVING_CLASS } from '@/ds/tokens';

import '@/ds/components/Arrival/arrival.css';

type MarkdownElement = NonNullable<ExtraProps['node']>;
type MarkdownChild = MarkdownElement['children'][number];

/** Fades whole: a fence renders through `CodeBlock`, and inline code carries a background. */
const UNBROKEN = new Set(['pre', 'code']);

const wrap = (value: string, arriving: boolean): MarkdownChild => ({
  type: 'element',
  tagName: 'span',
  properties: arriving ? { className: [ARRIVING_CLASS] } : {},
  children: [{ type: 'text', value }],
});

function markArriving(node: MarkdownElement): void {
  const classes = node.properties.className;

  node.properties.className = Array.isArray(classes) ? [...classes, ARRIVING_CLASS] : [ARRIVING_CLASS];
}

function rebuild(nodes: MarkdownChild[], arriving: () => boolean): MarkdownChild[] {
  const out: MarkdownChild[] = [];

  for (const node of nodes) {
    if (node.type === 'text') {
      for (const piece of node.value.match(/\S+|\s+/g) ?? []) {
        if (/\S/.test(piece)) out.push(wrap(piece, arriving()));
        else out.push({ type: 'text', value: piece });
      }

      continue;
    }

    out.push(node);

    if (node.type !== 'element') continue;

    if (!UNBROKEN.has(node.tagName)) node.children = rebuild(node.children, arriving);
    else if (arriving()) markArriving(node);
  }

  return out;
}

/**
 * Gives every word of a block an element of its own, and the entrance class to
 * those past the first `settled` — the words that were not on screen yet when
 * the reader joined this reply.
 *
 * Every word, not just the arriving ones: react-markdown parses afresh on each
 * landing and React matches the children it already mounted by position, so a
 * wrapper that came and went would land where a bare text node used to be and
 * remount half the paragraph, replaying entrances that had long finished.
 * Wrapping the lot keeps every position fixed — a new word only ever appends —
 * and a word never gains the class it did not mount with, so nothing replays.
 */
export function rehypeArriving(settled: number) {
  return function attach() {
    return (tree: { children: MarkdownChild[] }) => {
      let word = 0;

      tree.children = rebuild(tree.children, () => word++ >= settled);
    };
  };
}
