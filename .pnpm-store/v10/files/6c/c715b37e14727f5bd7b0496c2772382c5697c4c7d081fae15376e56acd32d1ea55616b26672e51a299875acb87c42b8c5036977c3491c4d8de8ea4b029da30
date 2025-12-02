import type { BaseNode } from '../schema/index.js';
export declare abstract class BaseExtractor {
    isTextNodeOnly: boolean;
    abstract extract(nodes: BaseNode[]): Promise<Record<string, any>[]>;
    /**
     *
     * @param nodes Nodes to extract metadata from.
     * @returns Metadata extracted from the nodes.
     */
    processNodes(nodes: BaseNode[]): Promise<BaseNode[]>;
}
//# sourceMappingURL=base.d.ts.map