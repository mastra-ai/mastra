import { defaultNodeTextTemplate } from '../prompts';
import type { BaseNode } from '../schema';
import { TransformComponent, TextNode } from '../schema';

/*
 * Abstract class for all extractors.
 */
export abstract class BaseExtractor extends TransformComponent {
  isTextNodeOnly: boolean = true;

  constructor() {
    super(async (nodes: BaseNode[]): Promise<BaseNode[]> => {
      return this.processNodes(nodes);
    });
  }

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

    for (const idx in newNodes) {
      if (newNodes[idx] instanceof TextNode) {
        newNodes[idx] = new TextNode({
          ...newNodes[idx],
          textTemplate: defaultNodeTextTemplate.format(),
        });
      }
    }

    return newNodes;
  }
}
