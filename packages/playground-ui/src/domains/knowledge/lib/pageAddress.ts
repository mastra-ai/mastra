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

/** The source an imported scope came from, read from its address prefix (`linear:…`). */
export function scopeSource(page: KnowledgePagePayload) {
  if (!page.isScope || !page.address) return undefined;
  const prefix = page.address.slice(0, page.address.indexOf(':'));
  return Object.hasOwn(SOURCES, prefix) ? SOURCES[prefix] : undefined;
}

/** A scope's readable name: an imported scope named only by its address reads as its source, e.g. "Linear". */
export function scopeTitle(page: KnowledgePagePayload): string {
  const source = scopeSource(page);
  return source && page.name === page.address ? source.label : page.name;
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
