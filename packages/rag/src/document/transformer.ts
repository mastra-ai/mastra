import { MastraDocument } from './document';

export interface Transformer {
  transformDocuments(documents: MastraDocument[]): MastraDocument[];
}
