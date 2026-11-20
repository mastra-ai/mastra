import { MAX_KNOWLEDGE_PAGE_DEPTH } from '../storage/domains/knowledge';
import type { KnowledgePage, KnowledgeReadScope, KnowledgeStorage } from '../storage/domains/knowledge';

export interface KnowledgePageRefs {
  /** Page id → the ref `knowledge_read` accepts: the scope address, `<scope>#<key>/<key>…`, or the page id. */
  refs: Map<string, string>;
  /** Scope page id → scope address, for every readable home scope reached. */
  scopes: Map<string, string>;
}

/**
 * The full ref of each page, in the form a page ref resolves: a scope page's address, an ordinary
 * page's key path from its scope (`docs:acme#guides/cli`), or its id when a page on that path has
 * no key or an ancestor can't be read. Ancestors are fetched one level at a time, one store call
 * per level, under the same read scope.
 * @internal
 */
export async function knowledgePageRefs(
  storage: KnowledgeStorage,
  read: KnowledgeReadScope,
  pages: KnowledgePage[],
): Promise<KnowledgePageRefs> {
  const refs = new Map<string, string>();
  const scopes = new Map<string, string>();
  if (pages.length === 0) return { refs, scopes };
  const known = new Map(pages.map(page => [page.id, page]));
  for (let level = 0; level <= MAX_KNOWLEDGE_PAGE_DEPTH; level++) {
    const missing = new Set<string>();
    for (const page of known.values()) {
      if (!page.isScope && page.parentId && !known.has(page.parentId)) missing.add(page.parentId);
      if (!page.isScope && !known.has(page.scopeId)) missing.add(page.scopeId);
    }
    if (missing.size === 0) break;
    const found = await storage.getPages({ ids: [...missing], read });
    if (found.length === 0) break;
    for (const page of found) known.set(page.id, page);
  }
  for (const page of known.values()) if (page.isScope && page.address) scopes.set(page.id, page.address);
  for (const page of pages) {
    const path: string[] = [];
    let current: KnowledgePage | undefined = page;
    while (current && !current.isScope && current.key) {
      path.unshift(current.key);
      current = current.parentId ? known.get(current.parentId) : undefined;
    }
    const address = current?.isScope ? current.address : undefined;
    refs.set(page.id, address ? (path.length > 0 ? `${address}#${path.join('/')}` : address) : page.id);
  }
  return { refs, scopes };
}
