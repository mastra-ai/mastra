import type { ComponentType, SVGProps } from 'react';

import type { KnowledgePagePayload } from '../pageTypes';

import { ConfluenceIcon, GithubIcon, GoogleIcon, LinearIcon, NotionIcon, SlackIcon, ZendeskIcon } from '@/ds/icons';

type KnowledgeSource = { label: string; icon?: ComponentType<SVGProps<SVGSVGElement>> };

const SOURCES: Record<string, KnowledgeSource> = {
  linear: { label: 'Linear', icon: LinearIcon },
  notion: { label: 'Notion', icon: NotionIcon },
  confluence: { label: 'Confluence', icon: ConfluenceIcon },
  zendesk: { label: 'Zendesk', icon: ZendeskIcon },
  fireflies: { label: 'Fireflies' },
  github: { label: 'GitHub', icon: GithubIcon },
  slack: { label: 'Slack', icon: SlackIcon },
  google: { label: 'Google', icon: GoogleIcon },
};

function importerRootKey(page: KnowledgePagePayload) {
  return !page.isScope && page.parentId === page.scopeId ? page.key : undefined;
}

/**
 * The source imported pages came from: an importer's own scope (`linear:…`), or the page an importer
 * writes its pages under, directly inside the organization scope and keyed by its source (`notion`).
 */
export function scopeSource(page: KnowledgePagePayload) {
  const key = page.isScope && page.address ? page.address.slice(0, page.address.indexOf(':')) : importerRootKey(page);
  return key && Object.hasOwn(SOURCES, key) ? SOURCES[key] : undefined;
}

/** Fallback labels for scopes whose declaration has no display label. */
const SCOPE_KINDS = new Map([
  ['org', 'Organization'],
  ['project', 'Project'],
  ['user', 'User'],
  ['agent', 'Agent'],
  ['team', 'Team'],
]);

export function scopeTitle(page: KnowledgePagePayload): string {
  const importerKey = importerRootKey(page);
  if (importerKey && page.name === importerKey) return scopeSource(page)?.label ?? page.name;
  if (!page.isScope || !page.address) return page.name;
  // Template child scopes are stored with their final address segment as their name.
  const childKey = page.address.includes('/') ? page.address.slice(page.address.lastIndexOf('/') + 1) : undefined;
  if (page.name !== page.address && page.name !== childKey) return page.name;
  const source = scopeSource(page);
  if (source) return source.label;
  if (page.displayLabel?.trim()) return page.displayLabel;
  if (childKey && page.name === childKey) return page.name;
  const kind = page.address.slice(0, page.address.indexOf(':'));
  const readableKind = kind.replace(/[-_]+/g, ' ');
  return (
    SCOPE_KINDS.get(kind) ?? (readableKind ? readableKind.charAt(0).toUpperCase() + readableKind.slice(1) : page.name)
  );
}

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
export function pageRef(
  page: KnowledgePagePayload,
  byId: ReadonlyMap<string, KnowledgePagePayload>,
): string | undefined {
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
