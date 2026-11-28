import { KnowledgeLinksProvider } from '@mastra/playground-ui/domains/chat/knowledge';
import type { ReactNode } from 'react';

import { useSessionHost } from '../../context/SessionHostContext';

/** Knowledge page links in chat open the host's Knowledge page; a chat outside a project shows names only. */
export function FactoryKnowledgeLinks({ children }: { children: ReactNode }) {
  const { factoryProjectId, LinkComponent, links } = useSessionHost();
  const pageHref = (pageId: string) => (factoryProjectId ? links.knowledgePage(pageId) : undefined);
  return (
    <KnowledgeLinksProvider pageHref={pageHref} Link={LinkComponent}>
      {children}
    </KnowledgeLinksProvider>
  );
}
