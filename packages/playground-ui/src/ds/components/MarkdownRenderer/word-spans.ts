import type { ExtraProps } from 'react-markdown';

type MarkdownElement = NonNullable<ExtraProps['node']>;
type MarkdownChild = MarkdownElement['children'][number];

/** Load-bearing: `MarkdownCodeBlock` reads a fence's source from its direct text children. */
const OPAQUE_TAGS = new Set(['code', 'pre']);

/** Further than this from the end of the reply, a word was already on screen. */
const ANIMATED_TAIL_CHARS = 120;

function textOf(nodes: MarkdownChild[]): string {
  let text = '';

  for (const node of nodes) {
    if (node.type === 'text') text += node.value;
    else if (node.type === 'element') text += textOf(node.children);
  }

  return text;
}

/**
 * One span per word so the fade stays pure CSS: an animation runs when an
 * element mounts, and again when a class hands it an animation-name it did not
 * have. Settled words keep their span — dropping the wrapper would reshape the
 * child list and re-key every sibling after it.
 *
 * The word still being typed is held invisible instead of faded: React reuses
 * its span as characters land, so a mount animation would never cover them.
 * Marking it complete swaps the class, which starts the fade on that same span.
 * Emphasis splits such a word across nodes (`Hel**lo**`), so its boundary is
 * read from the whole reply rather than from each text node.
 *
 * Only the tail is marked. A restructure — a paragraph becoming a list item
 * once the next character lands — remounts the subtree, so the window bounds
 * that re-fade rather than removing it.
 */
export function rehypeWordSpans() {
  return (tree: { children: MarkdownChild[] }) => {
    const reply = textOf(tree.children);
    const total = reply.length;
    const animateFrom = total - ANIMATED_TAIL_CHARS;
    const pendingFrom = total - (/\S*$/.exec(reply)?.[0].length ?? 0);
    let offset = 0;

    const wordProperties = (startsAt: number, endsAt: number) => {
      if (startsAt >= pendingFrom) return { className: ['mastra-markdown-word-pending'] };
      if (endsAt > animateFrom) return { className: ['mastra-markdown-word'] };
      return {};
    };

    const wordSpans = (value: string): MarkdownChild[] =>
      value.split(/(\s+)/).flatMap<MarkdownChild>(chunk => {
        if (!chunk) return [];

        const startsAt = offset;
        offset += chunk.length;
        if (/^\s+$/.test(chunk)) return [{ type: 'text', value: chunk }];

        return [
          {
            type: 'element',
            tagName: 'span',
            properties: wordProperties(startsAt, offset),
            children: [{ type: 'text', value: chunk }],
          },
        ];
      });

    const wrapNodes = (nodes: MarkdownChild[]): MarkdownChild[] =>
      nodes.flatMap<MarkdownChild>(node => {
        if (node.type === 'text') return wordSpans(node.value);

        if (node.type === 'element') {
          if (OPAQUE_TAGS.has(node.tagName)) offset += textOf(node.children).length;
          else node.children = wrapNodes(node.children);
        }

        return [node];
      });

    tree.children = wrapNodes(tree.children);
  };
}
