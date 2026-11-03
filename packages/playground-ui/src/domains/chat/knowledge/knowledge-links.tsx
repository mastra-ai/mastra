import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { knowledgePageHref } from './pinned-knowledge-data';
import { useLinkComponent } from '@/lib/framework';
import type { LinkComponent } from '@/lib/framework';

interface KnowledgeLinks {
  /** Undefined when this host has no page to open, e.g. a chat outside any project; the name shows as text. */
  pageHref: (pageId: string) => string | undefined;
  /**
   * Where a page named by reference (a scope address, or `scope#key/path` as `knowledge_list` names
   * entries) opens. Studio's Knowledge page resolves the reference itself, so it uses the page URL. A
   * host that only opens pages by id leaves it out, and those names show as text.
   */
  refHref?: (ref: string) => string | undefined;
  Link?: LinkComponent;
}

const KnowledgeLinksContext = createContext<KnowledgeLinks>({
  pageHref: knowledgePageHref,
  refHref: knowledgePageHref,
});

/**
 * Where Knowledge page links in chat (tool cards, pinned Knowledge) point. Studio's default opens its own
 * Knowledge page; a host with its own route (Factory's per-project page) or its own router passes both.
 */
export function KnowledgeLinksProvider({
  pageHref,
  refHref,
  Link,
  children,
}: KnowledgeLinks & { children: ReactNode }) {
  return (
    <KnowledgeLinksContext.Provider value={{ pageHref, refHref, Link }}>{children}</KnowledgeLinksContext.Provider>
  );
}

const LINK_CLASS = 'min-w-0 truncate text-foreground underline-offset-2 hover:underline';

/** A link to a Knowledge page, through the host's link component and route. */
export function KnowledgePageLink({
  pageId,
  pageRef,
  children,
  className = LINK_CLASS,
}: {
  children: ReactNode;
  className?: string;
} & ({ pageId: string; pageRef?: never } | { pageRef: string; pageId?: never })) {
  const links = useContext(KnowledgeLinksContext);
  const { Link: FrameworkLink } = useLinkComponent();
  const Link = links.Link ?? FrameworkLink;
  const href = pageId !== undefined ? links.pageHref(pageId) : links.refHref?.(pageRef);
  if (!href) return <span className={className}>{children}</span>;
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
