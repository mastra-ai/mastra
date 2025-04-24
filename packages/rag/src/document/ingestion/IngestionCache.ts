import { createHash } from 'crypto';
import type { BaseNode, TransformComponent } from '@llamaindex/core/schema';
import { MetadataMode } from '@llamaindex/core/schema';
import { docToJson, jsonSerializer, jsonToDoc } from '@llamaindex/core/storage/doc-store';
import { SimpleKVStore } from '@llamaindex/core/storage/kv-store';
import type { BaseKVStore } from '@llamaindex/core/storage/kv-store';

export function createSHA256() {
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

const transformToJSON = (obj: TransformComponent) => {
  const seen: any[] = [];

  const replacer = (key: string, value: any) => {
    if (value != null && typeof value == 'object') {
      if (seen.indexOf(value) >= 0) {
        return;
      }
      seen.push(value);
    }
    return value;
  };

  // this is a custom replacer function that will allow us to handle circular references
  const jsonStr = JSON.stringify(obj, replacer);

  return jsonStr;
};

export function getTransformationHash(nodes: BaseNode[], transform: TransformComponent) {
  const nodesStr: string = nodes.map(node => node.getContent(MetadataMode.ALL)).join('');

  const transformString: string = transformToJSON(transform);

  const hash = createSHA256();
  hash.update(nodesStr + transformString + transform.id);
  return hash.digest();
}

export class IngestionCache {
  collection: string = 'llama_cache';
  cache: BaseKVStore;
  nodesKey = 'nodes';

  constructor(collection?: string) {
    if (collection) {
      this.collection = collection;
    }
    this.cache = new SimpleKVStore();
  }

  async put(hash: string, nodes: BaseNode[]) {
    const val = {
      [this.nodesKey]: nodes.map(node => docToJson(node, jsonSerializer)),
    };
    await this.cache.put(hash, val, this.collection);
  }

  async get(hash: string): Promise<BaseNode[] | undefined> {
    const json = await this.cache.get(hash, this.collection);
    if (!json || !json[this.nodesKey] || !Array.isArray(json[this.nodesKey])) {
      return undefined;
    }

    return json[this.nodesKey].map((doc: any) => jsonToDoc(doc, jsonSerializer));
  }
}
