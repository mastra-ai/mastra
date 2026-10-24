import { createContext, useContext } from 'react';
import type { KnowledgeDataSource } from './data-source';

export const KnowledgeDataSourceContext = createContext<KnowledgeDataSource | null>(null);

export function useKnowledgeDataSource(): KnowledgeDataSource {
  const source = useContext(KnowledgeDataSourceContext);
  if (!source) throw new Error('Knowledge components must render inside a KnowledgeDataSourceProvider.');
  return source;
}
