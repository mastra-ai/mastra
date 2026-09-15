import type {
  SourceChangeRequestInput,
  SourceChangeRequestResult,
  SourceFile,
  SourceFileHistoryEntry,
  SourceFileHistoryInput,
  SourceFileListEntry,
  SourceFileListInput,
  SourceFileRef,
  SourceControlCapabilities,
  SourceControlProvider,
  SourceWriteFileInput,
  SourceWriteResult,
} from '../source-control';

export type GitHubSourceControlProviderConfig = {
  endpoint: string;
  token: string;
  pathPrefix?: string;
  fetch?: typeof fetch;
};

type BrokerErrorResponse = {
  type?: string;
  detail?: string;
};

export class GitHubSourceControlProvider implements SourceControlProvider {
  readonly id = 'github';
  readonly displayName = 'GitHub';

  private readonly endpoint: string;
  private readonly token: string;
  private readonly pathPrefix: string;
  private readonly fetch: typeof fetch;

  constructor(config: GitHubSourceControlProviderConfig) {
    this.endpoint = normalizeApiEndpoint(config.endpoint);
    this.token = config.token;
    this.pathPrefix = normalizePathPrefix(config.pathPrefix ?? 'mastra/editor');
    this.fetch = config.fetch ?? fetch;
  }

  async getCapabilities(): Promise<SourceControlCapabilities> {
    return this.request<SourceControlCapabilities>('/capabilities');
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
    const normalizedPath = stripLeadingSlashes(path);
    return this.pathPrefix ? `${this.pathPrefix}/${normalizedPath}` : normalizedPath;
  }

  private unsourcePath(path: string): string {
    const normalizedPath = stripLeadingSlashes(path);
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
      let detail = `GitHub source control request failed: ${res.status}`;
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

export function createGitHubSourceControlProviderFromEnv(
  env: Record<string, string | undefined> = process.env,
  defaults?: { pathPrefix?: string },
): GitHubSourceControlProvider | undefined {
  if (env.MASTRA_SOURCE_PROVIDER !== 'github') return undefined;

  const endpoint = env.MASTRA_SOURCE_PROVIDER_ENDPOINT ?? env.MASTRA_SHARED_API_URL ?? env.MASTRA_CLOUD_API_ENDPOINT;
  const token = env.MASTRA_PLATFORM_ACCESS_TOKEN ?? env.MASTRA_CLOUD_ACCESS_TOKEN;

  if (!endpoint || !token) return undefined;

  return new GitHubSourceControlProvider({
    endpoint: normalizeApiEndpoint(endpoint),
    token,
    pathPrefix: env.MASTRA_SOURCE_STORAGE_PATH_PREFIX ?? defaults?.pathPrefix,
  });
}

function normalizeApiEndpoint(endpoint: string): string {
  const trimmed = stripTrailingSlashes(endpoint);
  const withoutV1 = trimmed.endsWith('/v1') ? trimmed.slice(0, -3) : trimmed;
  return stripTrailingSlashes(withoutV1);
}

function normalizePathPrefix(pathPrefix: string): string {
  return stripTrailingSlashes(stripLeadingSlashes(pathPrefix));
}

function stripLeadingSlashes(value: string): string {
  let start = 0;
  while (start < value.length && value[start] === '/') start += 1;
  return value.slice(start);
}

function stripTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value[end - 1] === '/') end -= 1;
  return value.slice(0, end);
}
