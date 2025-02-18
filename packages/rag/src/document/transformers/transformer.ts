import type { Document } from 'llamaindex';

export interface Transformer {
  transformDocuments(documents: Document[]): Document[];
}
