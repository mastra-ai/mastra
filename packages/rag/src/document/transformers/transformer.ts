import type { Document } from '../schema';

export interface Transformer {
  transformDocuments(documents: Document[]): Document[];
}
