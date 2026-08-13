import type { ExtraProps } from 'react-markdown';

type MarkdownElement = NonNullable<ExtraProps['node']>;
type MarkdownChild = MarkdownElement['children'][number];

/** Load-bearing: `MarkdownCodeBlock` reads a fence's source from its direct text children. */
const OPAQUE_TAGS = new Set(['code', 'pre']);

function wordSpans(value: string): MarkdownChild[] {
  return value.split(/(\s+)/).flatMap<MarkdownChild>(chunk => {
    if (!chunk) return [];
    if (/^\s+$/.test(chunk)) return [{ type: 'text', value: chunk }];

    return [
      {
        type: 'element',
        tagName: 'span',
        properties: { className: ['mastra-markdown-word'] },
        children: [{ type: 'text', value: chunk }],
      },
    ];
  });
}

function wrapNodes(nodes: MarkdownChild[]): MarkdownChild[] {
  return nodes.flatMap<MarkdownChild>(node => {
    if (node.type === 'text') return wordSpans(node.value);
    if (node.type === 'element' && !OPAQUE_TAGS.has(node.tagName)) node.children = wrapNodes(node.children);

    return [node];
  });
}

/**
 * Wraps every word in its own span. The fade is CSS on `.mastra-markdown-word`
 * and an animation runs only when its element mounts, so re-parsing the growing
 * text leaves the words already on screen alone and lights up just the new ones.
 *
 * One span per word: for the message being written, never for settled ones.
 */
export function rehypeWordSpans() {
  return (tree: { children: MarkdownChild[] }) => {
    tree.children = wrapNodes(tree.children);
  };
}
