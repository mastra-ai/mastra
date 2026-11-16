import { KnowledgeLinksProvider } from '@mastra/playground-ui/domains/chat/knowledge';
import { forwardRef } from 'react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { Link as RouterLink, useParams } from 'react-router';

const Link = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement>>(({ href = '', ...props }, ref) => (
  <RouterLink ref={ref} to={href} {...props} />
));
Link.displayName = 'FactoryKnowledgeLink';

/** Knowledge page links in chat open this Factory's Knowledge page; a chat outside a Factory shows names only. */
export function FactoryKnowledgeLinks({ children }: { children: ReactNode }) {
  const { factoryId } = useParams<{ factoryId?: string }>();
  const pageHref = (pageId: string) =>
    factoryId
      ? `/factories/${encodeURIComponent(factoryId)}/knowledge?page=${encodeURIComponent(pageId)}&view=page`
      : undefined;
  return (
    <KnowledgeLinksProvider pageHref={pageHref} Link={Link}>
      {children}
    </KnowledgeLinksProvider>
  );
}
