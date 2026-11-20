import type { KnowledgePageResponse, KnowledgeTreeResponse } from '@mastra/client-js';
import { KnowledgeLinksProvider } from '@mastra/playground-ui/domains/chat/knowledge/knowledge-links';
import type { KnowledgePageTarget } from '@mastra/playground-ui/domains/chat/knowledge/knowledge-links';
import { knowledgePageHref } from '@mastra/playground-ui/domains/chat/knowledge/pinned-knowledge-data';
import type { KnowledgePageCardProps } from '@mastra/playground-ui/domains/knowledge/components/KnowledgePageCard';
import { pageRef } from '@mastra/playground-ui/domains/knowledge/lib/pageAddress';
import type { KnowledgePagePayload } from '@mastra/playground-ui/domains/knowledge/pageTypes';
import { useMastraClient } from '@mastra/react';
import { skipToken, useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useKnowledgeInstances } from './use-studio-knowledge';

/** What the hover card says about a fetched page: its label, address, and how many children it has. */
export function studioPageCard(view: KnowledgePageResponse, children?: KnowledgeTreeResponse): KnowledgePageCardProps {
  const page = view.page as KnowledgePagePayload;
  const byId = new Map([...(view.ancestors as KnowledgePagePayload[]), page].map(p => [p.id, p]));
  return {
    name: page.name,
    kind: page.isScope ? (page.displayLabel ?? 'Scope') : 'Page',
    pageRef: pageRef(page, byId),
    childCount: children?.pages.length ? `${children.pages.length}${children.nextCursor ? '+' : ''}` : undefined,
  };
}

/**
 * Whether bare text like `git:abc#1` could be a Knowledge address: only when its scope type is one the
 * instance has, judged by the root scopes the explorer already lists. Anything else is never looked up.
 */
export function isDeclaredAddress(pageRef: string, roots: KnowledgeTreeResponse | undefined): boolean {
  const type = pageRef.split('#')[0]?.split(':')[0];
  return Boolean(
    type && pageRef.includes(':') && roots?.pages.some(root => root.isScope && root.address?.split(':')[0] === type),
  );
}

/**
 * Fetches the page behind a chat link, on hover. Same query key as the explorer's page query, so a page
 * already open there costs nothing. Unreadable or missing pages give no card.
 */
function useStudioPagePreview(target: KnowledgePageTarget): KnowledgePageCardProps | undefined {
  const client = useMastraClient();
  const instances = useKnowledgeInstances();
  const knowledgeKey = instances.data?.[0]?.key;
  const key = target.pageId ?? target.pageRef;
  // The same query the explorer's tree runs for its root scopes.
  const roots = useQuery({
    queryKey: ['knowledge', knowledgeKey, 'tree', null, null],
    queryFn: knowledgeKey ? async () => client.getKnowledge(knowledgeKey).tree({}) : skipToken,
    staleTime: 30_000,
  });
  const askable =
    target.pageId !== undefined || (target.pageRef !== undefined && isDeclaredAddress(target.pageRef, roots.data));
  const { data } = useQuery({
    queryKey: ['knowledge', knowledgeKey, 'page', key, null],
    queryFn: knowledgeKey && key && askable ? async () => client.getKnowledge(knowledgeKey).page(key) : skipToken,
    retry: false,
    staleTime: 30_000,
  });
  // The page route carries no child count; the tree route lists the children, paged.
  const pageId = data?.page.id;
  const children = useQuery({
    queryKey: ['knowledge', knowledgeKey, 'tree', pageId ?? null, null],
    queryFn:
      knowledgeKey && pageId ? async () => client.getKnowledge(knowledgeKey).tree({ parentId: pageId }) : skipToken,
    staleTime: 30_000,
  });
  return data ? studioPageCard(data, children.data) : undefined;
}

/** Chat links to Knowledge pages in Studio open the Knowledge page and show a hover card. */
export function StudioKnowledgeLinks({ children }: { children: ReactNode }) {
  return (
    <KnowledgeLinksProvider
      pageHref={knowledgePageHref}
      refHref={knowledgePageHref}
      usePagePreview={useStudioPagePreview}
    >
      {children}
    </KnowledgeLinksProvider>
  );
}
