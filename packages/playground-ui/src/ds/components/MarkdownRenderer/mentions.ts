import type { ExtraProps } from 'react-markdown';

type MarkdownElement = NonNullable<ExtraProps['node']>;
type MarkdownChild = MarkdownElement['children'][number];

function highlight(nodes: MarkdownChild[], labels: string[]): MarkdownChild[] {
  return nodes.flatMap(node => {
    if (node.type === 'element') {
      if (!['a', 'code', 'pre'].includes(node.tagName)) node.children = highlight(node.children, labels);
      return [node];
    }
    if (node.type !== 'text') return [node];

    const result: MarkdownChild[] = [];
    let offset = 0;
    for (let index = node.value.indexOf('@'); index !== -1; index = node.value.indexOf('@', index + 1)) {
      if (index < offset || /[\p{L}\p{N}_.@/]/u.test(node.value[index - 1] ?? '')) continue;
      const label = labels.find(
        candidate =>
          node.value.startsWith(candidate, index) && !/[\p{L}\p{N}_]/u.test(node.value[index + candidate.length] ?? ''),
      );
      if (!label) continue;
      result.push({ type: 'text', value: node.value.slice(offset, index) });
      result.push({
        type: 'element',
        tagName: 'span',
        properties: { className: ['text-accent1'] },
        children: [{ type: 'text', value: label }],
      });
      offset = index + label.length;
    }
    result.push({ type: 'text', value: node.value.slice(offset) });
    return result;
  });
}

export function rehypeMentions(labels: string[]) {
  const longestFirst = labels
    .filter(label => label.startsWith('@') && label.length > 1)
    .sort((a, b) => b.length - a.length);
  return (tree: { children: MarkdownChild[] }) => {
    tree.children = highlight(tree.children, longestFirst);
  };
}
