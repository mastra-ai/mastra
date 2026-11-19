import { KnowledgeLinksProvider } from '@mastra/playground-ui/domains/chat/knowledge';
import type { ReactNode } from 'react';
import { useParams } from 'react-router';

import { HrefLink } from '../../../../ui/HrefLink';

/** Knowledge page links in chat open this Factory's Knowledge page; a chat outside a Factory shows names only. */
export function FactoryKnowledgeLinks({ children }: { children: ReactNode }) {
  const { factoryId } = useParams<{ factoryId?: string }>();
  const pageHref = (pageId: string) =>
    factoryId
      ? `/factories/${encodeURIComponent(factoryId)}/knowledge?page=${encodeURIComponent(pageId)}&view=page`
      : undefined;
  return (
    <KnowledgeLinksProvider pageHref={pageHref} Link={HrefLink}>
      {children}
    </KnowledgeLinksProvider>
  );
}
