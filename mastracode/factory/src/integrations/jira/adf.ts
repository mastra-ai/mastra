/**
 * Minimal Atlassian Document Format (ADF) helpers.
 *
 * Jira Cloud returns issue descriptions and comment bodies as ADF JSON and
 * requires ADF when creating comments. The flattener here is a display/agent-
 * context aid, not a fidelity converter: it covers the common nodes
 * (paragraphs, text, hard breaks, lists, code blocks, headings, mentions,
 * links) and degrades unknown nodes to their text content.
 */

/** Loosely-typed ADF node — Jira emits many node types we don't enumerate. */
export interface AdfNode {
  type?: string;
  text?: string;
  version?: number;
  content?: AdfNode[];
  attrs?: Record<string, unknown>;
}

/** Flatten an ADF document (or fragment) to plain text. */
export function adfToText(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  return render(node as AdfNode)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Wrap plain text in a minimal ADF document for comment creation. Each line
 * becomes a paragraph; blank lines produce empty paragraphs so spacing
 * round-trips reasonably.
 */
export function textToAdf(text: string): AdfNode {
  const lines = text.split('\n');
  const content: AdfNode[] = lines.map(line => ({
    type: 'paragraph',
    content: line === '' ? [] : [{ type: 'text', text: line }],
  }));
  return { type: 'doc', version: 1, content: content.length > 0 ? content : [{ type: 'paragraph', content: [] }] };
}

function children(node: AdfNode): AdfNode[] {
  return Array.isArray(node.content) ? node.content : [];
}

function renderInline(nodes: AdfNode[]): string {
  return nodes.map(render).join('');
}

function renderBlocks(nodes: AdfNode[], separator: string): string {
  return nodes
    .map(render)
    .filter(text => text !== '')
    .join(separator);
}

function render(node: AdfNode): string {
  switch (node.type) {
    case 'text':
      return node.text ?? '';
    case 'hardBreak':
      return '\n';
    case 'mention': {
      // Jira mention `attrs.text` usually already includes the `@`.
      const label = String(node.attrs?.text ?? node.attrs?.displayName ?? '').trim();
      if (!label) return '';
      return label.startsWith('@') ? label : `@${label}`;
    }
    case 'emoji':
      return String(node.attrs?.shortName ?? '');
    case 'inlineCard':
    case 'blockCard':
    case 'embedCard':
      return String(node.attrs?.url ?? '');
    case 'doc':
      return renderBlocks(children(node), '\n\n');
    case 'blockquote':
    case 'panel':
    case 'listItem':
    case 'expand':
    case 'nestedExpand':
      return renderBlocks(children(node), '\n');
    case 'paragraph':
    case 'heading':
      return renderInline(children(node));
    case 'codeBlock':
      return '```\n' + renderInline(children(node)) + '\n```';
    case 'bulletList':
      return children(node)
        .map(item => `- ${render(item).replace(/\n/g, '\n  ')}`)
        .join('\n');
    case 'orderedList':
      return children(node)
        .map((item, index) => `${index + 1}. ${render(item).replace(/\n/g, '\n   ')}`)
        .join('\n');
    case 'rule':
      return '---';
    default: {
      // Unknown node: degrade to its text content.
      if (node.text) return node.text;
      const kids = children(node);
      return kids.length > 0 ? renderBlocks(kids, '\n') : '';
    }
  }
}
