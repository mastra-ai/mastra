import { createContext, useContext } from 'react';
import { knowledgePageHref } from './pinned-knowledge-data';
import { useRecordNavigation } from '@/domains/chat/context/record-navigation';
import type { KnowledgePageCardProps } from '@/domains/knowledge/components/KnowledgePageCard';
import type { LinkComponent } from '@/lib/framework';

/** Names the page a link points at: by id, or by reference the way `refHref` takes it. */
export type KnowledgePageTarget = { pageId: string; pageRef?: never } | { pageRef: string; pageId?: never };

/**
 * What a hover card says about a page. Called, as a hook, only while a card is open, so a host fetches
 * the page on hover and not for every link in the transcript. (Chat prose is the exception: a bare address
 * in text calls it on render, since it links only if the page resolves.) `undefined` while loading or unreadable.
 */
export type UseKnowledgePagePreview = (target: KnowledgePageTarget) => KnowledgePageCardProps | undefined;

export interface KnowledgeLinks {
  /** Left out where the host cannot look a page up; links then have no hover card. */
  usePagePreview?: UseKnowledgePagePreview;
  /** Undefined when this host has no page to open, e.g. a chat outside any project; the name shows as text. */
  pageHref: (pageId: string) => string | undefined;
  /**
   * Where a page named by reference (a scope address, or `scope#key/path` as `knowledge_list` names
   * entries) opens. Studio's Knowledge page resolves the reference itself, so it uses the page URL. A
   * host that only opens pages by id leaves it out, and those names show as text.
   */
  refHref?: (ref: string) => string | undefined;
  Link?: LinkComponent;
  /** Set by the provider: this host has Knowledge pages, so references in chat prose become links. */
  provided?: boolean;
}

export const KnowledgeLinksContext = createContext<KnowledgeLinks>({
  pageHref: knowledgePageHref,
  refHref: knowledgePageHref,
});

/** What the host gave the provider; for renderers that must decide before drawing a link. */
export function useKnowledgeLinksContext(): KnowledgeLinks {
  return useContext(KnowledgeLinksContext);
}

/**
 * Whether chat prose can link Knowledge pages: this host mounted a `KnowledgeLinksProvider`, or, read back
 * from a record, the host opens Knowledge pages.
 */
export function useHasKnowledgeLinks(): boolean {
  const record = useRecordNavigation();
  const provided = useContext(KnowledgeLinksContext).provided === true;
  return record ? Boolean(record.onOpenKnowledgePage) : provided;
}
