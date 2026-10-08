import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ReactNode } from 'react';

/** Keep the page identifiable when there is no canvas to host its toolbar. */
export function KnowledgeGraphFallback({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <Txt as="h1" variant="heading" tone="ink">
        Knowledge Graph
      </Txt>
      {children}
    </div>
  );
}
