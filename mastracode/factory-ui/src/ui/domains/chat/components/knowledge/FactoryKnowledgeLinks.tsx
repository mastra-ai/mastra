import { KnowledgeLinksProvider } from '@mastra/playground-ui/domains/chat/knowledge';
import type { ReactNode } from 'react';
import { useSessionHost } from '../../context/SessionHostContext';

import { HrefLink } from '../../../../ui/HrefLink';

/** Knowledge page links in chat open this Factory's Knowledge page; a chat outside a Factory shows names only. */
export function FactoryKnowledgeLinks({ children }: { children: ReactNode }) {
  const { factoryProjectId: factoryId } = useSessionHost();
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
