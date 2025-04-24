import { BaseNode } from '@llamaindex/core/schema';
import type { BaseDocumentStore } from '@llamaindex/core/storage/doc-store';
import type { BaseVectorStore } from '@llamaindex/core/vector-store';
import { classify } from './classify.js';
import { RollbackableTransformComponent } from './rollback.js';

/**
 * Handles doc store upserts by checking hashes and ids.
 */
export class UpsertsStrategy extends RollbackableTransformComponent {
  protected docStore: BaseDocumentStore;
  protected vectorStores: BaseVectorStore[] | undefined;

  constructor(docStore: BaseDocumentStore, vectorStores?: BaseVectorStore[]) {
    super(async (nodes: BaseNode[]): Promise<BaseNode[]> => {
      const { dedupedNodes, unusedDocs } = await classify(this.docStore, nodes);
      // remove unused docs
      for (const refDocId of unusedDocs) {
        await this.docStore.deleteRefDoc(refDocId, false);
        if (this.vectorStores) {
          for (const vectorStore of this.vectorStores) {
            await vectorStore.delete(refDocId);
          }
        }
      }
      // add non-duplicate docs
      await this.docStore.addDocuments(dedupedNodes, true);
      return dedupedNodes;
    });
    this.docStore = docStore;
    this.vectorStores = vectorStores;
  }
}
