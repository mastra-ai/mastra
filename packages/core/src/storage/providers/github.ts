import type {
  SourceChangeRequestInput,
  SourceChangeRequestResult,
  SourceFile,
  SourceFileHistoryEntry,
  SourceFileHistoryInput,
  SourceFileListEntry,
  SourceFileListInput,
  SourceFileRef,
  SourceStorageCapabilities,
  SourceStorageProvider,
  SourceWriteFileInput,
  SourceWriteResult,
} from '../source-storage';

export type GitHubSourceStorageProviderConfig = {
  endpoint: string;
  token: string;
  pathPrefix?: string;
  fetch?: typeof fetch;
};

type BrokerErrorResponse = {
  type?: string;
  detail?: string;
};

export class GitHubSourceStorageProvider implements SourceStorageProvider {
  readonly id = 'github';
  readonly displayName = 'GitHub';

  private readonly endpoint: string;
  private readonly token: string;
  private readonly pathPrefix: string;
  private readonly fetch: typeof fetch;

  constructor(config: GitHubSourceStorageProviderConfig) {
    this.endpoint = normalizeApiEndpoint(config.endpoint);
    this.token = config.token;
    this.pathPrefix = normalizePathPrefix(config.pathPrefix ?? 'mastra/editor');
    this.fetch = config.fetch ?? fetch;
  }

  async getCapabilities(): Promise<SourceStorageCapabilities> {
    return this.request<SourceStorageCapabilities>('/capabilities');
  }

  async readFile(input: SourceFileRef): Promise<SourceFile | null> {
    const path = this.sourcePath(input.path);
    const query = new URLSearchParams({ path });
    if (input.ref) query.set('ref', input.ref);

    const result = await this.request<SourceFile | null>(`/files?${query.toString()}`);
    return result ? { ...result, path: input.path } : null;
  }

  async writeFile(input: SourceWriteFileInput): Promise<SourceWriteResult> {
    const result = await this.request<SourceWriteResult>('/files', {
      method: 'POST',
      body: JSON.stringify({ ...input, path: this.sourcePath(input.path) }),
    });

    return { ...result, path: input.path };
  }

  async listFileHistory(input: SourceFileHistoryInput): Promise<SourceFileHistoryEntry[]> {
    const query = new URLSearchParams({ path: this.sourcePath(input.path) });
    if (input.ref) query.set('ref', input.ref);
    if (input.limit) query.set('limit', String(input.limit));

    return this.request<SourceFileHistoryEntry[]>(`/files/history?${query.toString()}`);
  }

  async listFiles(input: SourceFileListInput): Promise<SourceFileListEntry[]> {
    const query = new URLSearchParams({ path: this.sourcePath(input.path) });
    if (input.ref) query.set('ref', input.ref);

    const files = await this.request<SourceFileListEntry[]>(`/files/list?${query.toString()}`);
    return files.map(file => ({ ...file, path: this.unsourcePath(file.path) }));
  }

  async openChangeRequest(input: SourceChangeRequestInput): Promise<SourceChangeRequestResult> {
    return this.request<SourceChangeRequestResult>('/change-requests', {
      method: 'POST',
      body: JSON.stringify({
        ...input,
        files: input.files.map(file => ({ ...file, path: this.sourcePath(file.path) })),
      }),
    });
  }

  private sourcePath(path: string): string {
    const normalizedPath = path.replace(/^\/+/, '');
    return this.pathPrefix ? `${this.pathPrefix}/${normalizedPath}` : normalizedPath;
  }

  private unsourcePath(path: string): string {
    const normalizedPath = path.replace(/^\/+/, '');
    const prefix = this.pathPrefix ? `${this.pathPrefix}/` : '';
    return prefix && normalizedPath.startsWith(prefix) ? normalizedPath.slice(prefix.length) : normalizedPath;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await this.fetch(`${this.endpoint}/v1/server/source-storage/github${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });

    if (!res.ok) {
      let detail = `GitHub source storage request failed: ${res.status}`;
      try {
        const body = (await res.json()) as BrokerErrorResponse;
        detail = body.detail ?? detail;
      } catch {
        // Ignore non-JSON error bodies.
      }
      throw new Error(detail);
    }

    return (await res.json()) as T;
  }
}

export function createGitHubSourceStorageProviderFromEnv(
  env: Record<string, string | undefined> = process.env,
  defaults?: { pathPrefix?: string },
): GitHubSourceStorageProvider | undefined {
  if (env.MASTRA_SOURCE_PROVIDER !== 'github') return undefined;

  const endpoint = env.MASTRA_SOURCE_PROVIDER_ENDPOINT ?? env.MASTRA_SHARED_API_URL ?? env.MASTRA_CLOUD_API_ENDPOINT;
  const token = env.MASTRA_PLATFORM_ACCESS_TOKEN ?? env.MASTRA_CLOUD_ACCESS_TOKEN;

  if (!endpoint || !token) return undefined;

  return new GitHubSourceStorageProvider({
    endpoint: normalizeApiEndpoint(endpoint),
    token,
    pathPrefix: env.MASTRA_SOURCE_STORAGE_PATH_PREFIX ?? defaults?.pathPrefix,
  });
}

function normalizeApiEndpoint(endpoint: string): string {
  return endpoint.replace(/\/v1\/?$/, '').replace(/\/$/, '');
}

function normalizePathPrefix(pathPrefix: string): string {
  return pathPrefix.replace(/^\/+|\/+$/g, '');
}
