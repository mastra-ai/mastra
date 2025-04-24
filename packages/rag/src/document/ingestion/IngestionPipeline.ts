import { ModalityType, splitNodesByType } from '@llamaindex/core/schema';
import type { BaseReader, TransformComponent, BaseNode, Document, Metadata } from '@llamaindex/core/schema';
import type { BaseDocumentStore } from '@llamaindex/core/storage/doc-store';
import type { BaseVectorStore, VectorStoreByType } from '@llamaindex/core/vector-store';
import { IngestionCache, getTransformationHash } from './IngestionCache';
import { DocStoreStrategy, createDocStoreStrategy } from './strategies/index';

type TransformRunArgs = {
  inPlace?: boolean;
  cache?: IngestionCache;
  docStoreStrategy?: TransformComponent;
};

export async function runTransformations(
  nodesToRun: BaseNode[],
  transformations: TransformComponent[],

  transformOptions: any = {},
  { inPlace = true, cache, docStoreStrategy }: TransformRunArgs = {},
): Promise<BaseNode[]> {
  let nodes = nodesToRun;
  if (!inPlace) {
    nodes = [...nodesToRun];
  }
  if (docStoreStrategy) {
    nodes = await docStoreStrategy(nodes);
  }
  for (const transform of transformations) {
    if (cache) {
      const hash = getTransformationHash(nodes, transform);
      const cachedNodes = await cache.get(hash);
      if (cachedNodes) {
        nodes = cachedNodes;
      } else {
        nodes = await transform(nodes, transformOptions);
        await cache.put(hash, nodes);
      }
    } else {
      nodes = await transform(nodes, transformOptions);
    }
  }
  return nodes;
}

export class IngestionPipeline {
  transformations: TransformComponent[] = [];
  documents?: Document[] | undefined;
  reader?: BaseReader | undefined;
  vectorStore?: BaseVectorStore | undefined;
  vectorStores?: VectorStoreByType | undefined;
  docStore?: BaseDocumentStore;
  docStoreStrategy: DocStoreStrategy = DocStoreStrategy.UPSERTS;
  cache?: IngestionCache | undefined;
  disableCache: boolean = false;

  private _docStoreStrategy?: TransformComponent;

  constructor(init?: Partial<IngestionPipeline>) {
    Object.assign(this, init);
    if (!this.docStore) {
      this.docStoreStrategy = DocStoreStrategy.NONE;
    }
    this.vectorStores = this.vectorStores ?? (this.vectorStore ? { [ModalityType.TEXT]: this.vectorStore } : undefined);
    this._docStoreStrategy = createDocStoreStrategy(
      this.docStoreStrategy,
      this.docStore,
      this.vectorStores ? Object.values(this.vectorStores) : undefined,
    );
    if (!this.disableCache) {
      this.cache = new IngestionCache();
    }
  }

  async prepareInput(documents?: Document[], nodes?: BaseNode[]): Promise<BaseNode[]> {
    const inputNodes: BaseNode[][] = [];
    if (documents) {
      inputNodes.push(documents);
    }
    if (nodes) {
      inputNodes.push(nodes);
    }
    if (this.documents) {
      inputNodes.push(this.documents);
    }
    if (this.reader) {
      inputNodes.push(await this.reader.loadData());
    }
    return inputNodes.flat();
  }

  async run(args: any = {}, transformOptions?: any): Promise<BaseNode[]> {
    args.cache = args.cache ?? this.cache;
    args.docStoreStrategy = args.docStoreStrategy ?? this._docStoreStrategy;
    const inputNodes = await this.prepareInput(args.documents, args.nodes);
    const nodes = await runTransformations(inputNodes, this.transformations, transformOptions, args);
    if (this.vectorStores) {
      const nodesToAdd = nodes.filter(node => node.embedding);
      await addNodesToVectorStores(nodesToAdd, this.vectorStores);
    }
    return nodes;
  }
}

export async function addNodesToVectorStores(
  nodes: BaseNode<Metadata>[],
  vectorStores: VectorStoreByType,
  nodesAdded?: (newIds: string[], nodes: BaseNode<Metadata>[], vectorStore: BaseVectorStore) => Promise<void>,
) {
  const nodeMap = splitNodesByType(nodes);
  for (const type in nodeMap) {
    const nodes = nodeMap[type as ModalityType];
    if (nodes) {
      const vectorStore = vectorStores[type as ModalityType];
      if (!vectorStore) {
        throw new Error(`Cannot insert nodes of type ${type} without assigned vector store`);
      }
      const newIds = await vectorStore.add(nodes);
      if (nodesAdded) {
        await nodesAdded(newIds, nodes, vectorStore);
      }
    }
  }
}
