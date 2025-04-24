import { randomUUID } from 'crypto';
import { lazyInitHash, createSHA256 } from '../utils';

export enum NodeRelationship {
  SOURCE = 'SOURCE',
  PREVIOUS = 'PREVIOUS',
  NEXT = 'NEXT',
  PARENT = 'PARENT',
  CHILD = 'CHILD',
}

export enum ObjectType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  INDEX = 'INDEX',
  DOCUMENT = 'DOCUMENT',
  IMAGE_DOCUMENT = 'IMAGE_DOCUMENT',
}

export type Metadata = Record<string, any>;

export interface RelatedNodeInfo<T extends Metadata = Metadata> {
  nodeId: string;
  nodeType?: ObjectType;
  metadata: T;
  hash?: string;
}

export type RelatedNodeType<T extends Metadata = Metadata> = RelatedNodeInfo<T> | RelatedNodeInfo<T>[];

export type BaseNodeParams<T extends Metadata = Metadata> = {
  id_?: string | undefined;
  metadata?: T | undefined;
  relationships?: Partial<Record<NodeRelationship, RelatedNodeType<T>>> | undefined;
  hash?: string | undefined;
  embedding?: number[] | undefined;
};

/**
 * Generic abstract class for retrievable nodes
 */
export abstract class BaseNode<T extends Metadata = Metadata> {
  /**
   * The unique ID of the Node/Document. The trailing underscore is here
   * to avoid collisions with the id keyword in Python.
   *
   * Set to a UUID by default.
   */
  id_: string;
  embedding: number[] | undefined;

  // Metadata fields
  metadata: T;
  relationships: Partial<Record<NodeRelationship, RelatedNodeType<T>>>;

  @lazyInitHash
  accessor hash: string = '';

  protected constructor(init?: BaseNodeParams<T>) {
    const { id_, metadata, relationships, embedding } = init || {};
    this.id_ = id_ ?? randomUUID();
    this.metadata = metadata ?? ({} as T);
    this.relationships = relationships ?? {};
    this.embedding = embedding;
  }

  abstract get type(): ObjectType;

  abstract getContent(): string;

  abstract getMetadataStr(): string;

  get sourceNode(): RelatedNodeInfo<T> | undefined {
    const relationship = this.relationships[NodeRelationship.SOURCE];

    if (Array.isArray(relationship)) {
      throw new Error('Source object must be a single RelatedNodeInfo object');
    }

    return relationship;
  }

  get prevNode(): RelatedNodeInfo<T> | undefined {
    const relationship = this.relationships[NodeRelationship.PREVIOUS];

    if (Array.isArray(relationship)) {
      throw new Error('Previous object must be a single RelatedNodeInfo object');
    }

    return relationship;
  }

  get nextNode(): RelatedNodeInfo<T> | undefined {
    const relationship = this.relationships[NodeRelationship.NEXT];

    if (Array.isArray(relationship)) {
      throw new Error('Next object must be a single RelatedNodeInfo object');
    }

    return relationship;
  }

  get parentNode(): RelatedNodeInfo<T> | undefined {
    const relationship = this.relationships[NodeRelationship.PARENT];

    if (Array.isArray(relationship)) {
      throw new Error('Parent object must be a single RelatedNodeInfo object');
    }

    return relationship;
  }

  get childNodes(): RelatedNodeInfo<T>[] | undefined {
    const relationship = this.relationships[NodeRelationship.CHILD];

    if (!Array.isArray(relationship)) {
      throw new Error('Child object must be a an array of RelatedNodeInfo objects');
    }

    return relationship;
  }

  abstract generateHash(): string;
}

export type TextNodeParams<T extends Metadata = Metadata> = BaseNodeParams<T> & {
  text?: string | undefined;
  textTemplate?: string | undefined;
  startCharIdx?: number | undefined;
  endCharIdx?: number | undefined;
  metadataSeparator?: string | undefined;
};

/**
 * TextNode is the default node type for text. Most common node type in LlamaIndex.TS
 */
export class TextNode<T extends Metadata = Metadata> extends BaseNode<T> {
  text: string;
  textTemplate: string;

  startCharIdx?: number;
  endCharIdx?: number;
  // textTemplate: NOTE write your own formatter if needed
  // metadataTemplate: NOTE write your own formatter if needed
  metadataSeparator: string;

  constructor(init: TextNodeParams<T> = {}) {
    super(init);
    const { text, textTemplate, startCharIdx, endCharIdx, metadataSeparator } = init;
    this.text = text ?? '';
    this.textTemplate = textTemplate ?? '';
    if (startCharIdx) {
      this.startCharIdx = startCharIdx;
    }
    if (endCharIdx) {
      this.endCharIdx = endCharIdx;
    }
    this.metadataSeparator = metadataSeparator ?? '\n';
  }

  /**
   * Generate a hash of the text node.
   * The ID is not part of the hash as it can change independent of content.
   * @returns
   */
  generateHash() {
    const hashFunction = createSHA256();
    hashFunction.update(`type=${this.type}`);
    hashFunction.update(`startCharIdx=${this.startCharIdx} endCharIdx=${this.endCharIdx}`);
    hashFunction.update(this.getContent());
    return hashFunction.digest();
  }

  get type() {
    return ObjectType.TEXT;
  }

  getContent(): string {
    const metadataStr = this.getMetadataStr().trim();
    return `${metadataStr}\n\n${this.text}`.trim();
  }

  getMetadataStr(): string {
    const usableMetadataKeys = new Set(Object.keys(this.metadata).sort());

    return [...usableMetadataKeys].map(key => `${key}: ${this.metadata[key]}`).join(this.metadataSeparator);
  }

  getNodeInfo() {
    return { start: this.startCharIdx, end: this.endCharIdx };
  }

  getText() {
    return this.text;
  }
}

/**
 * A document is just a special text node with a docId.
 */
export class Document<T extends Metadata = Metadata> extends TextNode<T> {
  constructor(init?: TextNodeParams<T>) {
    super(init);
  }

  get type() {
    return ObjectType.DOCUMENT;
  }
}
