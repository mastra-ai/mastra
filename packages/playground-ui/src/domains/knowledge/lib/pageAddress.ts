import type { KnowledgePagePayload } from '../pageTypes';

/** The page's place from its root scope down, through the pages the graph holds. */
export function pagePath(page: KnowledgePagePayload, byId: ReadonlyMap<string, KnowledgePagePayload>): string {
  const names: string[] = [];
  const seen = new Set<string>();
  for (let up = page.parentId ? byId.get(page.parentId) : undefined; up && !seen.has(up.id);) {
    seen.add(up.id);
    names.unshift(up.isScope && up.address ? up.address : up.name);
    up = up.parentId ? byId.get(up.parentId) : undefined;
  }
  return names.join(' › ');
}

/** How the page is addressed: its scope's address, then the keys down to it. Scopes are just their address. */
export function pageRef(page: KnowledgePagePayload, byId: ReadonlyMap<string, KnowledgePagePayload>): string | undefined {
  if (page.isScope) return page.address;
  const keys: string[] = [];
  const seen = new Set<string>();
  for (
    let at: KnowledgePagePayload | undefined = page;
    at && !seen.has(at.id);
    at = at.parentId ? byId.get(at.parentId) : undefined
  ) {
    seen.add(at.id);
    if (at.isScope) return at.address ? `${at.address}#${keys.reverse().join('/')}` : undefined;
    if (!at.key) return undefined;
    keys.push(at.key);
  }
  return undefined;
}
