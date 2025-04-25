import { createHash, randomUUID } from 'crypto';
import { NodeRelationship, ObjectType } from './types';
import type { Metadata, RelatedNodeInfo, RelatedNodeType, BaseNodeParams, TextNodeParams } from './types';

/**
 * Generic abstract class for retrievable nodes
 */
export abstract class BaseNode<T extends Metadata = Metadata> {
  id_: string;
  metadata: T;
  relationships: Partial<Record<NodeRelationship, RelatedNodeType<T>>>;

  @lazyInitHash
  accessor hash: string = '';

  protected constructor(init?: BaseNodeParams<T>) {
    const { id_, metadata, relationships } = init || {};
    this.id_ = id_ ?? randomUUID();
    this.metadata = metadata ?? ({} as T);
    this.relationships = relationships ?? {};
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

/**
 * TextNode is the default node type for text.
 */
export class TextNode<T extends Metadata = Metadata> extends BaseNode<T> {
  text: string;

  startCharIdx?: number;
  endCharIdx?: number;
  metadataSeparator: string;

  constructor(init: TextNodeParams<T> = {}) {
    super(init);
    const { text, startCharIdx, endCharIdx, metadataSeparator } = init;
    this.text = text ?? '';
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

function lazyInitHash(
  value: ClassAccessorDecoratorTarget<BaseNode, string>,
  _context: ClassAccessorDecoratorContext,
): ClassAccessorDecoratorResult<BaseNode, string> {
  return {
    get() {
      const oldValue = value.get.call(this);
      if (oldValue === '') {
        const hash = this.generateHash();
        value.set.call(this, hash);
      }
      return value.get.call(this);
    },
    set(newValue: string) {
      value.set.call(this, newValue);
    },
    init(value: string): string {
      return value;
    },
  };
}

function createSHA256() {
  const hash = createHash('sha256');
  return {
    update(data: string | Uint8Array): void {
      hash.update(data);
    },
    digest() {
      return hash.digest('base64');
    },
  };
}
