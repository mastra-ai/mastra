import { useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { KnowledgeLinksContext } from './knowledge-links-context';
import type { KnowledgeLinks, KnowledgePageTarget, UseKnowledgePagePreview } from './knowledge-links-context';
import { useRecordNavigation } from '@/domains/chat/context/record-navigation';
import { KnowledgePageCard } from '@/domains/knowledge/components/KnowledgePageCard';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/ds/components/HoverCard';
import { useLinkComponent } from '@/lib/framework';
import { cn } from '@/lib/utils';

export type { KnowledgePageTarget, UseKnowledgePagePreview } from './knowledge-links-context';

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

/**
 * A link to a Knowledge page, through the host's link component and route. Read back from a record, it
 * opens through the host's `onOpenKnowledgePage` instead, and shows as text without one.
 */
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
  const record = useRecordNavigation();
  const [open, setOpen] = useState(false);
  const { Link: FrameworkLink } = useLinkComponent();
  if (record) {
    const { onOpenKnowledgePage } = record;
    if (!onOpenKnowledgePage) return <span className={className}>{children}</span>;
    const target: KnowledgePageTarget = pageId !== undefined ? { pageId } : { pageRef };
    return (
      <button type="button" className={cn('text-left', className)} onClick={() => onOpenKnowledgePage(target)}>
        {children}
      </button>
    );
  }
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
