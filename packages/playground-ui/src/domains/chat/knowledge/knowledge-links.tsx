import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { knowledgePageHref } from './pinned-knowledge-data';
import { KnowledgePageCard } from '@/domains/knowledge/components/KnowledgePageCard';
import type { KnowledgePageCardProps } from '@/domains/knowledge/components/KnowledgePageCard';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/ds/components/HoverCard';
import { useLinkComponent } from '@/lib/framework';
import type { LinkComponent } from '@/lib/framework';

/** Names the page a link points at: by id, or by reference the way `refHref` takes it. */
export type KnowledgePageTarget = { pageId: string; pageRef?: never } | { pageRef: string; pageId?: never };

/**
 * What a hover card says about a page. Called, as a hook, only while a card is open, so a host fetches
 * the page on hover and not for every link in the transcript. `undefined` while loading or unreadable.
 */
export type UseKnowledgePagePreview = (target: KnowledgePageTarget) => KnowledgePageCardProps | undefined;

interface KnowledgeLinks {
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
  usePagePreview,
  children,
}: KnowledgeLinks & { children: ReactNode }) {
  return (
    <KnowledgeLinksContext.Provider value={{ pageHref, refHref, Link, usePagePreview }}>
      {children}
    </KnowledgeLinksContext.Provider>
  );
}

const LINK_CLASS = 'min-w-0 truncate text-foreground underline-offset-2 hover:underline';

/** Mounted by the open card only, so the host's lookup runs on hover. */
function PagePreviewCard({
  target,
  usePagePreview,
}: {
  target: KnowledgePageTarget;
  usePagePreview: UseKnowledgePagePreview;
}) {
  const card = usePagePreview(target);
  return card ? <KnowledgePageCard {...card} /> : null;
}

/** A link to a Knowledge page, through the host's link component and route. */
export function KnowledgePageLink({
  pageId,
  pageRef,
  children,
  className = LINK_CLASS,
}: {
  children: ReactNode;
  className?: string;
} & KnowledgePageTarget) {
  const links = useContext(KnowledgeLinksContext);
  const { Link: FrameworkLink } = useLinkComponent();
  const Link = links.Link ?? FrameworkLink;
  const href = pageId !== undefined ? links.pageHref(pageId) : links.refHref?.(pageRef);
  if (!href) return <span className={className}>{children}</span>;
  const link = (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
  const { usePagePreview } = links;
  if (!usePagePreview) return link;
  const target = pageId !== undefined ? { pageId } : { pageRef: pageRef as string };
  return (
    <HoverCard>
      <HoverCardTrigger render={<Link href={href} className={className} />}>{children}</HoverCardTrigger>
      <HoverCardContent data-testid="knowledge-link-card" className="flex w-max max-w-72 flex-col px-2 py-1">
        <PagePreviewCard target={target} usePagePreview={usePagePreview} />
      </HoverCardContent>
    </HoverCard>
  );
}
