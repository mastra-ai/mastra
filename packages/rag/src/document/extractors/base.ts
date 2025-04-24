import type { BaseNode } from '../schema';

/*
 * Abstract class for all extractors.
 */
export abstract class BaseExtractor {
  isTextNodeOnly: boolean = true;

  abstract extract(nodes: BaseNode[]): Promise<Record<string, any>[]>;

  /**
   *
   * @param nodes Nodes to extract metadata from.
   * @returns Metadata extracted from the nodes.
   */
  async processNodes(nodes: BaseNode[]): Promise<BaseNode[]> {
    let newNodes: BaseNode[] = nodes;

    const curMetadataList = await this.extract(newNodes);

    for (const idx in newNodes) {
      newNodes[idx]!.metadata = {
        ...newNodes[idx]!.metadata,
        ...curMetadataList[idx],
      };
    }

    return newNodes;
  }
}
