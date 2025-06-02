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
};

export type TextNodeParams<T extends Metadata = Metadata> = BaseNodeParams<T> & {
  text?: string | undefined;
  startCharIdx?: number | undefined;
  endCharIdx?: number | undefined;
  metadataSeparator?: string | undefined;
};
