export interface CloudflareSandboxBridgeClientOptions {
  baseUrl: string;
  apiToken?: string;
  fetch?: typeof globalThis.fetch;
}

/** Terminal and streaming events emitted by `POST /v1/sandbox/:id/exec`. */
export type CloudflareCommandEvent =
  | { type: 'stdout'; data: Uint8Array }
  | { type: 'stderr'; data: Uint8Array }
  | { type: 'exit'; exitCode: number }
  | { type: 'error'; message: string; code?: string };

export interface CloudflareExecRequest {
  /** Command and arguments. The bridge applies ANSI-C quoting to each element. */
  argv: string[];
  timeoutMs?: number;
  cwd?: string;
}

export interface CloudflarePersistWorkspaceOptions {
  /** Relative paths (under /workspace) to exclude from the archive. */
  excludes?: string[];
}

export interface CloudflareMountBucketCredentials {
  accessKeyId: string;
  secretAccessKey: string;
}

export interface CloudflareMountBucketOptions {
  /** S3-compatible endpoint, e.g. `https://<account>.r2.cloudflarestorage.com`. */
  endpoint?: string;
  /** Mount the bucket read-only. */
  readOnly?: boolean;
  /** Only expose objects under this bucket prefix at the mount point. */
  prefix?: string;
  /** Storage provider hint, e.g. `r2`. */
  provider?: string;
  /** Explicit credentials; omitted when the Worker resolves them from secrets. */
  credentials?: CloudflareMountBucketCredentials;
}

export interface CloudflareMountBucketRequest {
  /** Bucket name, e.g. `my-r2-bucket`. */
  bucket: string;
  /** Local filesystem path to mount at, e.g. `/mnt/data`. */
  mountPath: string;
  options?: CloudflareMountBucketOptions;
}

export interface CloudflareCreateSessionRequest {
  /** Working directory the session starts in. */
  cwd?: string;
  /** Environment variables seeded into the session. */
  env?: Record<string, string>;
  /** Caller-chosen session id; must match `^[a-zA-Z0-9._-]{1,128}$`. Generated when omitted. */
  sessionId?: string;
}

export interface CloudflareSession {
  id: string;
}

export class CloudflareSandboxBridgeError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string) {
    super(`Cloudflare Sandbox Bridge request failed (${status}): ${body || 'empty response'}`);
    this.name = 'CloudflareSandboxBridgeError';
    this.status = status;
    this.body = body;
  }
}

function stripTrailingSlashes(url: string): string {
  let end = url.length;
  while (end > 0 && url[end - 1] === '/') end--;
  return url.slice(0, end);
}

/** Encodes an absolute sandbox path for the `/file/*` route, which omits the leading slash. */
function encodeFilePath(absolutePath: string): string {
  let start = 0;
  while (start < absolutePath.length && absolutePath[start] === '/') start++;
  return absolutePath
    .slice(start)
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');
}

/**
 * Client for the Cloudflare Sandbox Bridge Worker.
 *
 * @see https://developers.cloudflare.com/sandbox/bridge/http-api/
 */
export class CloudflareSandboxBridgeClient {
  readonly baseUrl: string;
  private readonly apiToken?: string;
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(options: CloudflareSandboxBridgeClientOptions) {
    this.baseUrl = stripTrailingSlashes(options.baseUrl);
    this.apiToken = options.apiToken;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
  }

  /** `POST /v1/sandbox` */
  async createSandbox(): Promise<string> {
    const created = await this.request<{ id: string }>('/v1/sandbox', { method: 'POST' });
    return created.id;
  }

  /** `GET /v1/sandbox/:id/running` */
  async isRunning(id: string): Promise<boolean> {
    const status = await this.request<{ running: boolean }>(`/v1/sandbox/${encodeURIComponent(id)}/running`, {});
    return status.running === true;
  }

  /** `DELETE /v1/sandbox/:id` */
  async deleteSandbox(id: string): Promise<void> {
    await this.request(`/v1/sandbox/${encodeURIComponent(id)}`, { method: 'DELETE' }, true);
  }

  /** `PUT /v1/sandbox/:id/file/*` — one file per request, raw bytes as the body. */
  async writeFile(id: string, absolutePath: string, content: Uint8Array | string): Promise<void> {
    await this.request(
      `/v1/sandbox/${encodeURIComponent(id)}/file/${encodeFilePath(absolutePath)}`,
      {
        method: 'PUT',
        body: content as RequestInit['body'],
        headers: { 'content-type': 'application/octet-stream' },
      },
      true,
    );
  }

  /** `GET /v1/sandbox/:id/file/*` — reads one file, returning its raw bytes. */
  async readFile(id: string, absolutePath: string): Promise<Uint8Array> {
    return this.requestBytes(`/v1/sandbox/${encodeURIComponent(id)}/file/${encodeFilePath(absolutePath)}`, {});
  }

  /** `GET /v1/sandbox/:id/persist` — archives `/workspace`, returning raw tar bytes. */
  async persistWorkspace(id: string, options: CloudflarePersistWorkspaceOptions = {}): Promise<Uint8Array> {
    const query = options.excludes?.length ? `?excludes=${encodeURIComponent(options.excludes.join(','))}` : '';
    return this.requestBytes(`/v1/sandbox/${encodeURIComponent(id)}/persist${query}`, {});
  }

  /** `POST /v1/sandbox/:id/hydrate` — restores `/workspace` from a raw tar payload. */
  async hydrateWorkspace(id: string, tar: Uint8Array): Promise<void> {
    await this.request(
      `/v1/sandbox/${encodeURIComponent(id)}/hydrate`,
      {
        method: 'POST',
        body: tar as RequestInit['body'],
        headers: { 'content-type': 'application/octet-stream' },
      },
      true,
    );
  }

  /** `POST /v1/sandbox/:id/mount` — mounts an S3-compatible bucket as a local directory. */
  async mountBucket(id: string, request: CloudflareMountBucketRequest): Promise<void> {
    await this.request(
      `/v1/sandbox/${encodeURIComponent(id)}/mount`,
      {
        method: 'POST',
        body: JSON.stringify(request),
        headers: { 'content-type': 'application/json' },
      },
      true,
    );
  }

  /** `POST /v1/sandbox/:id/unmount` — unmounts a previously mounted bucket. */
  async unmountBucket(id: string, mountPath: string): Promise<void> {
    await this.request(
      `/v1/sandbox/${encodeURIComponent(id)}/unmount`,
      {
        method: 'POST',
        body: JSON.stringify({ mountPath }),
        headers: { 'content-type': 'application/json' },
      },
      true,
    );
  }

  /** `POST /v1/sandbox/:id/session` — creates an execution session, returning its id. */
  async createSession(id: string, request: CloudflareCreateSessionRequest = {}): Promise<CloudflareSession> {
    const body: Record<string, unknown> = {};
    if (request.cwd !== undefined) body.cwd = request.cwd;
    if (request.env !== undefined) body.env = request.env;
    if (request.sessionId !== undefined) body.id = request.sessionId;
    return this.request<CloudflareSession>(`/v1/sandbox/${encodeURIComponent(id)}/session`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    });
  }

  /** `DELETE /v1/sandbox/:id/session/:sessionId` — tears down an execution session. */
  async deleteSession(id: string, sessionId: string): Promise<void> {
    await this.request(
      `/v1/sandbox/${encodeURIComponent(id)}/session/${encodeURIComponent(sessionId)}`,
      { method: 'DELETE' },
      true,
    );
  }

  /** `POST /v1/sandbox/:id/exec` — streams SSE events until `exit` or `error`. */
  async exec(
    id: string,
    request: CloudflareExecRequest,
    options: {
      signal?: AbortSignal;
      onEvent: (event: CloudflareCommandEvent) => void;
    },
  ): Promise<void> {
    const response = await this.fetchImpl(`${this.baseUrl}/v1/sandbox/${encodeURIComponent(id)}/exec`, {
      method: 'POST',
      headers: { ...this.headers(), 'content-type': 'application/json', accept: 'text/event-stream' },
      body: JSON.stringify({
        argv: request.argv,
        ...(request.timeoutMs === undefined ? {} : { timeout_ms: request.timeoutMs }),
        ...(request.cwd === undefined ? {} : { cwd: request.cwd }),
      }),
      signal: options.signal,
    });

    if (!response.ok) {
      throw new CloudflareSandboxBridgeError(response.status, await response.text());
    }
    if (!response.body) {
      throw new Error('Cloudflare Sandbox Bridge returned an empty command stream');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, '\n');
      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        this.emitBlock(buffer.slice(0, boundary), options.onEvent);
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf('\n\n');
      }
      if (done) break;
    }
    if (buffer.trim()) this.emitBlock(buffer, options.onEvent);
  }

  private emitBlock(block: string, onEvent: (event: CloudflareCommandEvent) => void): void {
    let eventName: string | undefined;
    const dataLines: string[] = [];
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) eventName = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
    }
    const data = dataLines.join('\n');
    if (!eventName || !data) return;

    switch (eventName) {
      case 'stdout':
      case 'stderr':
        onEvent({ type: eventName, data: base64ToBytes(data) });
        return;
      case 'exit': {
        const parsed = safeJsonParse(data);
        onEvent({ type: 'exit', exitCode: typeof parsed?.exit_code === 'number' ? parsed.exit_code : 0 });
        return;
      }
      case 'error': {
        const parsed = safeJsonParse(data);
        onEvent({
          type: 'error',
          message: typeof parsed?.error === 'string' ? parsed.error : data,
          code: typeof parsed?.code === 'string' ? parsed.code : undefined,
        });
        return;
      }
      default:
        return;
    }
  }

  private headers(): Record<string, string> {
    return this.apiToken ? { authorization: `Bearer ${this.apiToken}` } : {};
  }

  private async request<T>(path: string, init: RequestInit, allowEmpty = false): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers: { ...this.headers(), ...init.headers },
    });
    if (!response.ok) {
      throw new CloudflareSandboxBridgeError(response.status, await response.text());
    }
    if (allowEmpty || response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  private async requestBytes(path: string, init: RequestInit): Promise<Uint8Array> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers: { ...this.headers(), ...init.headers },
    });
    if (!response.ok) {
      throw new CloudflareSandboxBridgeError(response.status, await response.text());
    }
    return new Uint8Array(await response.arrayBuffer());
  }
}

function base64ToBytes(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, 'base64'));
}

function safeJsonParse(value: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}
