import { Knowledge, knowledgeMemoryScopes } from '@mastra/core/knowledge';
import type { KnowledgeConfig } from '@mastra/core/knowledge';
import { MastraCompositeStore, KnowledgeStorage } from '@mastra/core/storage';
import type { KnowledgePageStore } from '@mastra/core/storage';

export interface PlatformKnowledgeOptions extends Omit<
  KnowledgeConfig,
  'storage' | 'vector' | 'embedder' | 'embedderOptions' | 'scopes'
> {
  scopes?: KnowledgeConfig['scopes'];
  accessToken?: string;
  projectId?: string;
  instanceId?: string;
  /**
   * Knowledge API URL. Falls back to `MASTRA_KNOWLEDGE_API_URL`, then `https://knowledge-api.mastra.ai`.
   */
  apiUrl?: string;
}

// These are the schema-v4 page-store methods, not arbitrary object properties or storage lifecycle methods.
const operations = [
  'materializeScope',
  'getScopesByAddress',
  'listScopeDeclarations',
  'renameScopeDeclaration',
  'listChildScopes',
  'countChildScopes',
  'getPage',
  'getPages',
  'getPageByPath',
  'findPagesByName',
  'listChildPages',
  'countChildPages',
  'listPages',
  'createPage',
  'updatePage',
  'movePage',
  'mergePages',
  'deletePage',
  'getNote',
  'countNotes',
  'listNotes',
  'listNotesMentioning',
  'addNote',
  'restampNote',
  'removeNote',
  'restoreNote',
  'searchPages',
  'listPageActivity',
  'addPinAudience',
  'removePinAudience',
  'listPins',
  'countPageLinks',
  'listPageLinks',
  'replacePageBodyLinks',
  'listPageBodyLinkSources',
] as const satisfies readonly (keyof KnowledgePageStore)[];

function encode(value: unknown): string {
  return JSON.stringify(value, function (key, item: unknown) {
    const original: unknown = key ? (this as Record<string, unknown>)[key] : item;
    return original instanceof Date ? { __knowledgeDate: original.toISOString() } : item;
  });
}

function decode<T>(text: string): T {
  return JSON.parse(text, (_key, value: unknown) => {
    if (value && typeof value === 'object' && '__knowledgeDate' in value) {
      return new Date((value as { __knowledgeDate: string }).__knowledgeDate);
    }
    return value;
  }) as T;
}

class RemoteKnowledgeStorage extends KnowledgeStorage {
  constructor(
    private readonly endpoint: string,
    private readonly token: string,
  ) {
    super({ storageIsolationKey: endpoint });
    return new Proxy(this, {
      get(target, key) {
        if (typeof key === 'string' && operations.includes(key as (typeof operations)[number])) {
          return (input?: unknown) => target.request(key, input);
        }
        const value: unknown = Reflect.get(target, key, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  }

  private async request(operation: string, input?: unknown): Promise<unknown> {
    const response = await fetch(`${this.endpoint}/operations/${operation}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json' },
      body: encode({ input }),
    });
    const body = decode<{ result?: unknown; error?: { message?: string } }>(await response.text());
    if (!response.ok) throw new Error(body.error?.message ?? `Knowledge request failed (${response.status})`);
    return body.result;
  }

  override getCapabilities() {
    return {
      contractVersion: 4,
      schemaVersion: 4,
      supportsSchemaInspection: false,
      supportsExplicitReset: false,
    } as const;
  }

  override async dangerouslyClearAll(): Promise<void> {
    throw new Error('Hosted Knowledge cannot be cleared from the client');
  }
}

const DEFAULT_API_URL = 'https://knowledge-api.mastra.ai';

export class PlatformKnowledge extends Knowledge {
  constructor(options: PlatformKnowledgeOptions = {}) {
    const token =
      options.accessToken ?? process.env.MASTRA_PLATFORM_ACCESS_TOKEN ?? process.env.MASTRA_PLATFORM_SECRET_KEY;
    const instanceId = options.instanceId ?? process.env.MASTRA_KNOWLEDGE_INSTANCE_ID;
    const apiUrl =
      options.apiUrl ??
      (process.env.MASTRA_KNOWLEDGE_API_URL?.trim() || undefined) ??
      DEFAULT_API_URL;
    if (!token || !instanceId) {
      throw new Error('PlatformKnowledge requires a Platform access token and Knowledge instance ID');
    }
    const {
      accessToken: _accessToken,
      projectId: _projectId,
      instanceId: _instanceId,
      apiUrl: _apiUrl,
      ...config
    } = options;
    const endpoint = `${apiUrl.replace(/\/$/, '')}/v1/knowledge/${encodeURIComponent(instanceId)}`;
    const storage = new MastraCompositeStore({
      id: `platform-knowledge-${instanceId}`,
      domains: { knowledge: new RemoteKnowledgeStorage(endpoint, token) },
    });
    super({
      ...config,
      tools: config.tools ?? { read: true },
      scopes: config.scopes ?? knowledgeMemoryScopes(),
      storage,
    });
  }
}

export { encode as encodeKnowledgeTransport, decode as decodeKnowledgeTransport };
export { operations as knowledgeOperations };
