import type { BaseNode } from '@llamaindex/core/schema';
import type { BaseDocumentStore } from '@llamaindex/core/storage/doc-store';

export async function classify(docStore: BaseDocumentStore, nodes: BaseNode[]) {
  const existingDocIds = Object.values(await docStore.getAllDocumentHashes());
  const docIdsFromNodes = new Set<string>();
  const dedupedNodes: BaseNode[] = [];
  const unusedDocs: string[] = [];

  for (const node of nodes) {
    const refDocId = node.sourceNode?.nodeId || node.id_;
    docIdsFromNodes.add(refDocId);
    const existingHash = await docStore.getDocumentHash(refDocId);

    if (!existingHash) {
      // document doesn't exist, so add it
      dedupedNodes.push(node);
    } else if (existingHash && existingHash !== node.hash) {
      // document exists but hash is different, so mark doc as unused and add node as deduped
      unusedDocs.push(refDocId);
      dedupedNodes.push(node);
    }
    // otherwise, document exists and hash is the same, so do nothing
  }
  const missingDocs = existingDocIds.filter(id => !docIdsFromNodes.has(id));
  return { dedupedNodes, missingDocs, unusedDocs };
}
