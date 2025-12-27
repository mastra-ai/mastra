import { FilesystemStorage, Knowledge } from '@mastra/knowledge';

/**
 * Knowledge base for the support agent.
 * Uses BM25 for fast keyword search - no vector database or embeddings needed.
 */
export const supportKnowledge = new Knowledge({
  id: 'support-knowledge',
  storage: new FilesystemStorage({ basePath: '.mastra-knowledge/knowledge/support' }),
  bm25: true,
});
