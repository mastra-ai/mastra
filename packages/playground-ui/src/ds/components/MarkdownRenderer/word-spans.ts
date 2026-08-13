import type { ExtraProps } from 'react-markdown';

type MarkdownElement = NonNullable<ExtraProps['node']>;
type MarkdownChild = MarkdownElement['children'][number];

/** Load-bearing: `MarkdownCodeBlock` reads a fence's source from its direct text children. */
const OPAQUE_TAGS = new Set(['code', 'pre']);

/** Further than this from the end of the reply, a word was already on screen. */
const ANIMATED_TAIL_CHARS = 120;

function textLength(nodes: MarkdownChild[]): number {
  let length = 0;

  for (const node of nodes) {
    if (node.type === 'text') length += node.value.length;
    else if (node.type === 'element') length += textLength(node.children);
  }

  return length;
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
 *
 * Only the tail is marked. A restructure — a paragraph becoming a list item
 * once the next character lands — remounts the subtree, so the window bounds
 * that re-fade rather than removing it.
 */
export function rehypeWordSpans() {
  return (tree: { children: MarkdownChild[] }) => {
    const total = textLength(tree.children);
    const animateFrom = total - ANIMATED_TAIL_CHARS;
    let offset = 0;

    const wordProperties = (endsAt: number) => {
      if (endsAt === total) return { className: ['mastra-markdown-word-pending'] };
      if (endsAt > animateFrom) return { className: ['mastra-markdown-word'] };
      return {};
    };

    const wordSpans = (value: string): MarkdownChild[] =>
      value.split(/(\s+)/).flatMap<MarkdownChild>(chunk => {
        if (!chunk) return [];

        offset += chunk.length;
        if (/^\s+$/.test(chunk)) return [{ type: 'text', value: chunk }];

        return [
          {
            type: 'element',
            tagName: 'span',
            properties: wordProperties(offset),
            children: [{ type: 'text', value: chunk }],
          },
        ];
      });

    const wrapNodes = (nodes: MarkdownChild[]): MarkdownChild[] =>
      nodes.flatMap<MarkdownChild>(node => {
        if (node.type === 'text') return wordSpans(node.value);

        if (node.type === 'element') {
          if (OPAQUE_TAGS.has(node.tagName)) offset += textLength(node.children);
          else node.children = wrapNodes(node.children);
        }

        return [node];
      });

    tree.children = wrapNodes(tree.children);
  };
}
