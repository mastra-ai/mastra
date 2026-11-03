/**
 * Resolves `[[ref]]` links in page bodies and notes against the pages the explorer has loaded, in the
 * order core's `run.page(ref)` uses: page id, then `scope#key/key` path, then scope address, then a
 * unique page name (an ambiguous name resolves to nothing, as it throws in core). The server does not
 * resolve body links, so a link to a page outside the loaded set stays unresolved.
 */

import type { KnowledgePageEdge, KnowledgePagePayload } from '../pageTypes';

export interface KnowledgePageRefIndex {
  resolve: (ref: string) => KnowledgePagePayload | undefined;
}

/** Same as core's `canonicalKnowledgeName`. */
function canonicalName(name: string): string {
  return name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function knowledgePageRefIndex(pages: Iterable<KnowledgePagePayload>): KnowledgePageRefIndex {
  const byId = new Map<string, KnowledgePagePayload>();
  const scopesByAddress = new Map<string, KnowledgePagePayload>();
  const childByKey = new Map<string, KnowledgePagePayload>();
  const byName = new Map<string, KnowledgePagePayload | null>();
  for (const page of pages) {
    if (page.deletedAt || page.mergedInto) continue;
    byId.set(page.id, page);
    if (page.isScope && page.address) scopesByAddress.set(page.address, page);
    if (!page.isScope && page.key && page.parentId) childByKey.set(`${page.parentId}\u0000${page.key}`, page);
    const name = canonicalName(page.name);
    byName.set(name, byName.has(name) ? null : page);
  }

  const byPath = (ref: string): KnowledgePagePayload | undefined => {
    const hash = ref.indexOf('#');
    if (hash <= 0) return undefined;
    const scope = scopesByAddress.get(ref.slice(0, hash));
    if (!scope) return undefined;
    let page: KnowledgePagePayload | undefined = scope;
    for (const key of ref.slice(hash + 1).split('/')) {
      page = childByKey.get(`${page.id}\u0000${key}`);
      if (!page || page.scopeId !== scope.id) return undefined;
    }
    return page === scope ? undefined : page;
  };

  return {
    resolve(raw) {
      const ref = raw.trim();
      if (!ref) return undefined;
      return byId.get(ref) ?? byPath(ref) ?? scopesByAddress.get(ref) ?? byName.get(canonicalName(ref)) ?? undefined;
    },
  };
}

const WIKILINK = /\[\[([^\]]+)\]\]/g;
// Code is shown as written, so a `[[ref]]` inside it is not a link.
const FENCED_CODE = /^(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^\1[ \t]*$|(?![\s\S]))/gm;
const INLINE_CODE = /(`+)[\s\S]*?\1/g;

/** The `[[ref]]`s in a markdown body, outside code. */
export function bodyLinkRefs(body: string): string[] {
  const prose = body.replace(FENCED_CODE, '').replace(INLINE_CODE, '');
  return [...prose.matchAll(WIKILINK)].map(match => match[1] ?? '');
}

/** One `link` edge per page whose body links another loaded page; `count` is how many times. */
export function bodyLinkEdges(pages: KnowledgePagePayload[]): KnowledgePageEdge[] {
  const index = knowledgePageRefIndex(pages);
  const edges: KnowledgePageEdge[] = [];
  for (const page of pages) {
    if (!page.body || page.deletedAt || page.mergedInto) continue;
    const counts = new Map<string, number>();
    for (const ref of bodyLinkRefs(page.body)) {
      const target = index.resolve(ref);
      if (target && target.id !== page.id) counts.set(target.id, (counts.get(target.id) ?? 0) + 1);
    }
    for (const [target, count] of counts) edges.push({ source: page.id, target, kind: 'link', count });
  }
  return edges;
}
