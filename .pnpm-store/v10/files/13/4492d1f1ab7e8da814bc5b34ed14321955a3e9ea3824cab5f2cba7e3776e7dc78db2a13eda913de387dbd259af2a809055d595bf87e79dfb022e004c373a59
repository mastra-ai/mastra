import { NodeRelationship, ObjectType } from './types.js';
import type { Metadata, RelatedNodeInfo, RelatedNodeType, BaseNodeParams, TextNodeParams } from './types.js';
/**
 * Generic abstract class for retrievable nodes
 */
export declare abstract class BaseNode<T extends Metadata = Metadata> {
    id_: string;
    metadata: T;
    relationships: Partial<Record<NodeRelationship, RelatedNodeType<T>>>;
    accessor hash: string;
    protected constructor(init?: BaseNodeParams<T>);
    abstract get type(): ObjectType;
    abstract getContent(): string;
    abstract getMetadataStr(): string;
    get sourceNode(): RelatedNodeInfo<T> | undefined;
    get prevNode(): RelatedNodeInfo<T> | undefined;
    get nextNode(): RelatedNodeInfo<T> | undefined;
    get parentNode(): RelatedNodeInfo<T> | undefined;
    get childNodes(): RelatedNodeInfo<T>[] | undefined;
    abstract generateHash(): string;
}
/**
 * TextNode is the default node type for text.
 */
export declare class TextNode<T extends Metadata = Metadata> extends BaseNode<T> {
    text: string;
    startCharIdx?: number;
    endCharIdx?: number;
    metadataSeparator: string;
    constructor(init?: TextNodeParams<T>);
    /**
     * Generate a hash of the text node.
     * The ID is not part of the hash as it can change independent of content.
     * @returns
     */
    generateHash(): string;
    get type(): ObjectType;
    getContent(): string;
    getMetadataStr(): string;
    getNodeInfo(): {
        start: number | undefined;
        end: number | undefined;
    };
    getText(): string;
}
/**
 * A document is just a special text node with a docId.
 */
export declare class Document<T extends Metadata = Metadata> extends TextNode<T> {
    constructor(init?: TextNodeParams<T>);
    get type(): ObjectType;
}
//# sourceMappingURL=node.d.ts.map