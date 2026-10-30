import type { ReactNode } from 'react';
import type { KnowledgeDataSource } from './data-source';
import { KnowledgeDataSourceContext } from './data-source-context';

/** Supplies the host's Knowledge hooks to every explorer component below it. */
export function KnowledgeDataSourceProvider({ value, children }: { value: KnowledgeDataSource; children: ReactNode }) {
  return <KnowledgeDataSourceContext.Provider value={value}>{children}</KnowledgeDataSourceContext.Provider>;
}
