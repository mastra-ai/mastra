import type { BaseNode } from '@llamaindex/core/schema';
import type { BaseDocumentStore } from '@llamaindex/core/storage/doc-store';
import { RollbackableTransformComponent } from './rollback';

/**
 * Handle doc store duplicates by checking all hashes.
 */
export class DuplicatesStrategy extends RollbackableTransformComponent {
  private docStore: BaseDocumentStore;

  constructor(docStore: BaseDocumentStore) {
    super(async (nodes: BaseNode[]): Promise<BaseNode[]> => {
      const hashes = await this.docStore.getAllDocumentHashes();
      const currentHashes = new Set<string>();
      const nodesToRun: BaseNode[] = [];

      for (const node of nodes) {
        if (!(node.hash in hashes) && !currentHashes.has(node.hash)) {
          await this.docStore.setDocumentHash(node.id_, node.hash);
          nodesToRun.push(node);
          currentHashes.add(node.hash);
        }
      }

      await this.docStore.addDocuments(nodesToRun, true);

      return nodesToRun;
    });
    this.docStore = docStore;
  }
}
