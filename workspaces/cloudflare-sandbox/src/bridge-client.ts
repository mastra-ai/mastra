export interface CloudflareSandboxBridgeClientOptions {
  baseUrl: string;
  apiToken?: string;
  fetch?: typeof globalThis.fetch;
}

export interface CloudflareSandboxRecord {
  id: string;
  status?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export interface CloudflareCommandEvent {
  type: 'stdout' | 'stderr' | 'complete' | 'error';
  data?: string;
  exitCode?: number;
  message?: string;
}

export interface CloudflareCommandRequest {
  command: string;
  timeout?: number;
}

export interface CloudflareFileWrite {
  path: string;
  content: string;
  encoding?: 'base64';
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

export class CloudflareSandboxBridgeClient {
  readonly baseUrl: string;
  private readonly apiToken?: string;
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(options: CloudflareSandboxBridgeClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.apiToken = options.apiToken;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
  }

  async createSandbox(): Promise<CloudflareSandboxRecord> {
    return this.request<CloudflareSandboxRecord>('/sandboxes', { method: 'POST' });
  }

  async getSandbox(id: string): Promise<CloudflareSandboxRecord> {
    return this.request<CloudflareSandboxRecord>(`/sandboxes/${encodeURIComponent(id)}`, {});
  }

  async deleteSandbox(id: string): Promise<void> {
    await this.request(`/sandboxes/${encodeURIComponent(id)}`, { method: 'DELETE' }, true);
  }

  async writeFiles(id: string, files: CloudflareFileWrite[]): Promise<void> {
    await this.request(
      `/sandboxes/${encodeURIComponent(id)}/files`,
      { method: 'POST', body: JSON.stringify({ files }) },
      true,
    );
  }

  async executeCommand(
    id: string,
    request: CloudflareCommandRequest,
    options: {
      signal?: AbortSignal;
      onEvent: (event: CloudflareCommandEvent) => void;
    },
  ): Promise<void> {
    const response = await this.fetchImpl(`${this.baseUrl}/sandboxes/${encodeURIComponent(id)}/commands`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(request),
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

    const emit = (block: string) => {
      const lines = block.split('\n');
      const eventName = lines
        .find(line => line.startsWith('event:'))
        ?.slice(6)
        .trim();
      const data = lines
        .filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).trimStart())
        .join('\n');
      if (!data && !eventName) return;

      try {
        const parsed = JSON.parse(data) as Record<string, unknown>;
        options.onEvent({
          ...parsed,
          type:
            (parsed.type as CloudflareCommandEvent['type'] | undefined) ??
            (eventName as CloudflareCommandEvent['type']),
        } as CloudflareCommandEvent);
      } catch {
        options.onEvent({ type: eventName as CloudflareCommandEvent['type'], data });
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, '\n');
      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        emit(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf('\n\n');
      }
      if (done) break;
    }
    if (buffer.trim()) emit(buffer);
  }

  private headers(): Record<string, string> {
    return {
      'content-type': 'application/json',
      ...(this.apiToken ? { authorization: `Bearer ${this.apiToken}` } : {}),
    };
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
}
