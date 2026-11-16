import { createContext, useContext, useState } from 'react';
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
 * the page on hover and not for every link in the transcript. (Chat prose is the exception: a bare address
 * in text calls it on render, since it links only if the page resolves.) `undefined` while loading or unreadable.
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
  /** Set by the provider: this host has Knowledge pages, so references in chat prose become links. */
  provided?: boolean;
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
}: Omit<KnowledgeLinks, 'provided'> & { children: ReactNode }) {
  return (
    <KnowledgeLinksContext.Provider value={{ pageHref, refHref, Link, usePagePreview, provided: true }}>
      {children}
    </KnowledgeLinksContext.Provider>
  );
}

/** What the host gave the provider; for renderers that must decide before drawing a link. */
export function useKnowledgeLinksContext(): KnowledgeLinks {
  return useContext(KnowledgeLinksContext);
}

/** Whether this host mounted a `KnowledgeLinksProvider`, i.e. has Knowledge pages chat prose can link to. */
export function useHasKnowledgeLinks(): boolean {
  return useContext(KnowledgeLinksContext).provided === true;
}

const LINK_CLASS = 'min-w-0 truncate text-foreground underline-offset-2 hover:underline';

/** Mounted only while the card is open, so the host's lookup runs on hover. Nothing opens until the page is known. */
function PagePreviewContent({
  target,
  usePagePreview,
}: {
  target: KnowledgePageTarget;
  usePagePreview: UseKnowledgePagePreview;
}) {
  const card = usePagePreview(target);
  if (!card) return null;
  return (
    <HoverCardContent data-testid="knowledge-link-card" className="flex w-max max-w-72 flex-col px-2 py-1">
      <KnowledgePageCard {...card} />
    </HoverCardContent>
  );
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
  const [open, setOpen] = useState(false);
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
  const target: KnowledgePageTarget = pageId !== undefined ? { pageId } : { pageRef };
  return (
    <HoverCard open={open} onOpenChange={setOpen}>
      <HoverCardTrigger render={<Link href={href} className={className} />}>{children}</HoverCardTrigger>
      {open ? <PagePreviewContent target={target} usePagePreview={usePagePreview} /> : null}
    </HoverCard>
  );
}
