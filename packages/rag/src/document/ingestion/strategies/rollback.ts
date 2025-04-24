import type { BaseNode } from '@llamaindex/core/schema';
import { TransformComponent } from '@llamaindex/core/schema';
import type { BaseDocumentStore } from '@llamaindex/core/storage/doc-store';
import { classify } from './classify';

export class RollbackableTransformComponent extends TransformComponent {
  // Remove unused docs from the doc store. It is useful in case
  // generating embeddings fails and we want to remove the unused docs
  // TODO: override this in UpsertsStrategy if we want to revert removed docs also
  public async rollback(docStore: BaseDocumentStore, nodes: BaseNode[]): Promise<void> {
    const { unusedDocs } = await classify(docStore, nodes);
    for (const docId of unusedDocs) {
      await docStore.deleteDocument(docId, false);
    }
    docStore.persist();
  }
}
