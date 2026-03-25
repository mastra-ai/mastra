import { injectAnchorIds } from './anchor-ids';

export interface CollapsedNode {
  id: string;
  summary: string;
  children: string;
}

const COLLAPSED_OPEN_TAG = '<collapsed';
const COLLAPSED_CLOSE_TAG = '</collapsed>';
const ATTRIBUTE_PATTERN = /([\w][\w-]*)="([^"]*)"/g;

function parseAttributes(attributeString: string): Record<string, string> {
  const attributes: Record<string, string> = {};

  for (const match of attributeString.matchAll(ATTRIBUTE_PATTERN)) {
    const [, key, value] = match;
    if (key && value !== undefined) {
      attributes[key] = value;
    }
  }

  return attributes;
}

function findCollapsedCloseIndex(text: string, contentStart: number): number {
  let depth = 1;
  let cursor = contentStart;

  while (cursor < text.length) {
    const nextOpen = text.indexOf(COLLAPSED_OPEN_TAG, cursor);
    const nextClose = text.indexOf(COLLAPSED_CLOSE_TAG, cursor);

    if (nextClose === -1) {
      return -1;
    }

    if (nextOpen !== -1 && nextOpen < nextClose) {
      const openTagEnd = text.indexOf('>', nextOpen);
      if (openTagEnd === -1) {
        return -1;
      }

      const openTag = text.slice(nextOpen, openTagEnd + 1);
      if (!openTag.endsWith('/>')) {
        depth += 1;
      }
      cursor = openTagEnd + 1;
      continue;
    }

    depth -= 1;
    if (depth === 0) {
      return nextClose;
    }
    cursor = nextClose + COLLAPSED_CLOSE_TAG.length;
  }

  return -1;
}

export function parseCollapsedNodes(text: string): CollapsedNode[] {
  if (!text) {
    return [];
  }

  const nodes: CollapsedNode[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const openIndex = text.indexOf(COLLAPSED_OPEN_TAG, cursor);
    if (openIndex === -1) {
      break;
    }

    const openTagEnd = text.indexOf('>', openIndex);
    if (openTagEnd === -1) {
      break;
    }

    const openTag = text.slice(openIndex, openTagEnd + 1);
    const attributes = parseAttributes(openTag);
    const id = attributes.id;
    const summary = attributes.summary;

    if (openTag.endsWith('/>')) {
      if (id && summary !== undefined) {
        nodes.push({ id, summary, children: '' });
      }
      cursor = openTagEnd + 1;
      continue;
    }

    const contentStart = openTagEnd + 1;
    const closeIndex = findCollapsedCloseIndex(text, contentStart);
    if (closeIndex === -1) {
      break;
    }

    if (id && summary !== undefined) {
      const children = text.slice(contentStart, closeIndex).trim();
      nodes.push({
        id,
        summary,
        children,
      });
      nodes.push(...parseCollapsedNodes(children));
    }

    cursor = closeIndex + COLLAPSED_CLOSE_TAG.length;
  }

  return nodes;
}

export function wrapInCollapsed(id: string, summary: string, children: string): string {
  const content = children.trim();
  return `<collapsed id="${id}" summary="${summary}">\n${content}\n</collapsed>`;
}

export function renderCollapsedNodesForAgent(observations: string): string {
  if (!observations) {
    return observations;
  }

  let rendered = observations;

  while (rendered.includes(COLLAPSED_OPEN_TAG)) {
    const nodes = parseCollapsedNodes(rendered);
    if (nodes.length === 0) {
      break;
    }

    let nextRendered = rendered;
    let changed = false;

    for (const node of nodes) {
      const fullNode = wrapInCollapsed(node.id, node.summary, node.children);
      if (!nextRendered.includes(fullNode)) {
        const selfClosing = `<collapsed id="${node.id}" summary="${node.summary}" />`;
        if (nextRendered.includes(selfClosing)) {
          nextRendered = nextRendered.replace(selfClosing, `* ${node.summary} [ref:${node.id}]`);
          changed = true;
        }
        continue;
      }

      nextRendered = nextRendered.replace(fullNode, `* ${node.summary} [ref:${node.id}]`);
      changed = true;
    }

    rendered = nextRendered;
    if (!changed) {
      break;
    }
  }

  return rendered.replace(/\n{3,}/g, '\n\n').trim();
}

export function renderCollapsedNodesForReflector(observations: string): string {
  return injectAnchorIds(observations, 'positional');
}

export function findCollapsedNodeById(text: string, id: string): CollapsedNode | null {
  return parseCollapsedNodes(text).find(node => node.id === id) ?? null;
}

export function collapseToExternalRef(id: string, summary: string, recordId: string): string {
  return `<collapsed id="${id}" summary="${summary}" record="${recordId}" />`;
}
