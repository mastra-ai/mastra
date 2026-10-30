import type { KnowledgeImporterRoot } from '@mastra/client-js';

/** A root's display label; falls back to its id only if the server stopped declaring it. */
export const rootLabel = (roots: readonly KnowledgeImporterRoot[], id: string) =>
  roots.find(root => root.id === id)?.displayLabel ?? id;
