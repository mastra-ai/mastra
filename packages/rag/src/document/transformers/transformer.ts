import type { Document } from '@llamaindex/core/schema';

export interface Transformer {
  transformDocuments(documents: Document[]): Document[];
}
