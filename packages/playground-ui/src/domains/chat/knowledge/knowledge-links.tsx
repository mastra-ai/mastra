import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { knowledgePageHref } from './pinned-knowledge-data';
import { useLinkComponent } from '@/lib/framework';
import type { LinkComponent } from '@/lib/framework';

interface KnowledgeLinks {
  /** Undefined when this host has no page to open, e.g. a chat outside any project; the name shows as text. */
  pageHref: (pageId: string) => string | undefined;
  Link?: LinkComponent;
}

const KnowledgeLinksContext = createContext<KnowledgeLinks>({ pageHref: knowledgePageHref });

/**
 * Where Knowledge page links in chat (tool cards, pinned Knowledge) point. Studio's default opens its own
 * Knowledge page; a host with its own route (Factory's per-project page) or its own router passes both.
 */
export function KnowledgeLinksProvider({ pageHref, Link, children }: KnowledgeLinks & { children: ReactNode }) {
  return <KnowledgeLinksContext.Provider value={{ pageHref, Link }}>{children}</KnowledgeLinksContext.Provider>;
}

/** A link to a Knowledge page, through the host's link component and route. */
export function KnowledgePageLink({
  pageId,
  children,
  className = 'min-w-0 truncate text-foreground underline-offset-2 hover:underline',
}: {
  pageId: string;
  children: ReactNode;
  className?: string;
}) {
  const links = useContext(KnowledgeLinksContext);
  const { Link: FrameworkLink } = useLinkComponent();
  const Link = links.Link ?? FrameworkLink;
  const href = links.pageHref(pageId);
  if (!href) return <span className={className}>{children}</span>;
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
