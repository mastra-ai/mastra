import type { Parent, PhrasingContent, Root, Text } from 'mdast';

const WIKILINK = /\[\[([^\]]+)\]\]/g;
/** `[[ref]]`, or a bare `type:value#path` address such as `docs:mastra#guides/memory` (never a URL or an email). */
const WIKILINK_OR_ADDRESS = /\[\[([^\]]+)\]\]|(?<![\w:/#@.-])([a-z][\w-]*:[\w.-]+#[\w./-]*[\w/])/g;

/** The hast property a `[[ref]]` carries on its `<span>`; react-markdown hands it to the `span` override. */
export const KNOWLEDGE_REF_PROPERTY = 'dataKnowledgeRef';
/** Set to `'bare'` on a ref written without `[[ ]]`: it only looks like an address, so a host links it once the page resolves. */
export const KNOWLEDGE_BARE_PROPERTY = 'dataKnowledgeBare';

/**
 * A remark plugin that turns each `[[ref]]` in markdown prose into `<span data-knowledge-ref="ref">ref</span>`,
 * for a `span` override to draw as a page link. It only splits text nodes, so code, inline code and
 * existing links are left alone, and the ref stays text: nothing in a body becomes markup.
 */
export function remarkKnowledgeLinks() {
  return (tree: Root) => {
    visit(tree, WIKILINK);
  };
}

/** `remarkKnowledgeLinks` for chat prose, where a model also writes a page's address bare. */
export function remarkKnowledgeChatLinks() {
  return (tree: Root) => {
    visit(tree, WIKILINK_OR_ADDRESS);
  };
}

function visit(node: Parent, pattern: RegExp) {
  if (node.type === 'link' || node.type === 'linkReference') return;
  const children: Parent['children'] = [];
  let changed = false;
  for (const child of node.children) {
    if (child.type === 'text') {
      const split = splitText(child, pattern);
      if (split) {
        children.push(...split);
        changed = true;
        continue;
      }
    } else if ('children' in child) {
      visit(child, pattern);
    }
    children.push(child);
  }
  if (changed) node.children = children;
}

function splitText(node: Text, pattern: RegExp): PhrasingContent[] | null {
  const { value } = node;
  const parts: PhrasingContent[] = [];
  let last = 0;
  for (const match of value.matchAll(pattern)) {
    const ref = match[1] ?? match[2] ?? '';
    const bare = match[1] === undefined;
    if (match.index > last) parts.push({ type: 'text', value: value.slice(last, match.index) });
    parts.push({
      type: 'emphasis',
      data: {
        hName: 'span',
        hProperties: { [KNOWLEDGE_REF_PROPERTY]: ref, ...(bare ? { [KNOWLEDGE_BARE_PROPERTY]: 'bare' } : {}) },
      },
      children: [{ type: 'text', value: ref }],
    });
    last = match.index + match[0].length;
  }
  if (last === 0) return null;
  if (last < value.length) parts.push({ type: 'text', value: value.slice(last) });
  return parts;
}
