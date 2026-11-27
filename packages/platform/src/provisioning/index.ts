/** Thrown when the Platform API answers with an error status. */
export class MastraPlatformError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = 'MastraPlatformError';
  }
}

export interface PlatformApiOptions {
  apiUrl: string;
  accessToken: string;
  organizationId?: string;
  fetch?: typeof fetch;
}

export function errorMessage(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  // Problem details (RFC 9457), which the Platform API answers most errors with.
  if ('detail' in body && typeof body.detail === 'string' && body.detail) return body.detail;
  if (!('error' in body)) return undefined;
  const { error } = body;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return undefined;
}

/** JSON requests to the Platform API with the caller's credentials. */
export class PlatformApi {
  constructor(private readonly options: PlatformApiOptions) {}

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {
      accept: 'application/json',
      authorization: `Bearer ${this.options.accessToken}`,
    };
    if (this.options.organizationId) headers['x-organization-id'] = this.options.organizationId;
    if (body !== undefined) headers['content-type'] = 'application/json';

    const response = await (this.options.fetch ?? fetch)(`${this.options.apiUrl.replace(/\/$/, '')}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let data: unknown = undefined;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    if (!response.ok) {
      const reason = errorMessage(data) ?? (typeof data === 'string' && data ? data : response.statusText);
      throw new MastraPlatformError(`${method} ${path} failed (${response.status}): ${reason}`, response.status, data);
    }
    return data as T;
  }
}

export interface WaitOptions {
  /** How long to wait before giving up. Defaults to 15 minutes (file systems can take over 5). */
  timeoutMs?: number;
  /** Time between status checks. Defaults to 2 seconds. */
  intervalMs?: number;
}

/** Polls `get` until the resource is ready; throws when it fails, disappears or times out. */
export async function waitUntilReady<T extends { status: string; error?: string | null }>(
  get: () => Promise<T>,
  label: string,
  { timeoutMs = 15 * 60_000, intervalMs = 2_000 }: WaitOptions = {},
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const resource = await get();
    if (resource.status === 'ready') return resource;
    if (resource.status !== 'provisioning') {
      throw new Error(`${label} is ${resource.status}${resource.error ? `: ${resource.error}` : ''}`);
    }
    if (Date.now() + intervalMs > deadline) throw new Error(`${label} was not ready after ${timeoutMs}ms`);
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
}

const id = encodeURIComponent;

export type ProvisioningStatus = 'provisioning' | 'ready' | 'failed' | 'deleting' | 'deleted' | 'destroyed';

export interface PlatformProject {
  id: string;
  name: string;
  slug: string;
  organizationId: string;
  [field: string]: unknown;
}

export interface CreatePlatformProjectInput {
  name: string;
  /** Region to run the project in, e.g. `us-east`. */
  region?: string;
}

/** Projects in the organization. Needs a user session or an organization API key. */
export class PlatformProjects {
  constructor(private readonly api: PlatformApi) {}

  async list(): Promise<PlatformProject[]> {
    return (await this.api.request<{ projects: PlatformProject[] }>('GET', '/v1/server/projects')).projects;
  }

  async create(input: CreatePlatformProjectInput): Promise<PlatformProject> {
    return (await this.api.request<{ project: PlatformProject }>('POST', '/v1/server/projects', input)).project;
  }

  async get(projectId: string): Promise<PlatformProject> {
    return (await this.api.request<{ project: PlatformProject }>('GET', `/v1/server/projects/${id(projectId)}`))
      .project;
  }

  async delete(projectId: string): Promise<void> {
    await this.api.request('DELETE', `/v1/server/projects/${id(projectId)}`);
  }
}

export interface PlatformEnvironment {
  id: string;
  projectId: string;
  name: string;
  slug: string;
  type: 'production' | 'staging' | 'preview';
  branch: string | null;
  [field: string]: unknown;
}

export interface CreatePlatformEnvironmentInput {
  name: string;
  type: 'production' | 'staging' | 'preview';
  branch?: string;
  region?: string;
}

/** A project's environments. Databases and file systems can be scoped to one. */
export class PlatformEnvironments {
  constructor(
    private readonly api: PlatformApi,
    private readonly projectId: string,
  ) {}

  async list(): Promise<PlatformEnvironment[]> {
    return (
      await this.api.request<{ environments: PlatformEnvironment[] }>(
        'GET',
        `/v1/projects/${id(this.projectId)}/environments`,
      )
    ).environments;
  }

  async create(input: CreatePlatformEnvironmentInput): Promise<PlatformEnvironment> {
    return (
      await this.api.request<{ environment: PlatformEnvironment }>(
        'POST',
        `/v1/projects/${id(this.projectId)}/environments`,
        input,
      )
    ).environment;
  }
}

export interface PlatformMemoryInstance {
  id: string;
  projectId: string;
  environmentId: string | null;
  name: string;
  status: ProvisioningStatus;
  error: string | null;
  region: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlatformMemoryInstanceInput {
  /** Lowercase letters, numbers and dashes. */
  name: string;
  environmentId?: string;
}

/** Hosted Memory instances. Creating and deleting them needs an organization admin. */
export class PlatformMemoryInstances {
  constructor(
    private readonly api: PlatformApi,
    private readonly projectId: string,
  ) {}

  private get path() {
    return `/v1/server/projects/${id(this.projectId)}/memory`;
  }

  async list(): Promise<PlatformMemoryInstance[]> {
    return (await this.api.request<{ instances: PlatformMemoryInstance[] }>('GET', this.path)).instances;
  }

  /** Starts provisioning an instance. Pass the result's `id` to `waitUntilReady` before using it. */
  async create(input: CreatePlatformMemoryInstanceInput): Promise<PlatformMemoryInstance> {
    return (await this.api.request<{ instance: PlatformMemoryInstance }>('POST', this.path, input)).instance;
  }

  async get(instanceId: string): Promise<PlatformMemoryInstance> {
    return (await this.api.request<{ instance: PlatformMemoryInstance }>('GET', `${this.path}/${id(instanceId)}`))
      .instance;
  }

  async delete(instanceId: string): Promise<void> {
    await this.api.request('DELETE', `${this.path}/${id(instanceId)}`);
  }

  waitUntilReady(instanceId: string, options?: WaitOptions): Promise<PlatformMemoryInstance> {
    return waitUntilReady(() => this.get(instanceId), `Memory instance ${instanceId}`, options);
  }
}

export interface PlatformKnowledgeInstance {
  id: string;
  projectId: string;
  projectDatabaseId: string | null;
  status: ProvisioningStatus;
  error: string | null;
  region: string | null;
  createdAt: string;
  updatedAt: string;
  [field: string]: unknown;
}

/** Hosted Knowledge instances. Creating and deleting them needs an organization admin. */
export class PlatformKnowledgeInstances {
  constructor(
    private readonly api: PlatformApi,
    private readonly projectId: string,
  ) {}

  private get path() {
    return `/v1/server/projects/${id(this.projectId)}/knowledge`;
  }

  async list(): Promise<PlatformKnowledgeInstance[]> {
    return (await this.api.request<{ instances: PlatformKnowledgeInstance[] }>('GET', this.path)).instances;
  }

  /** Starts provisioning an instance. Pass the result's `id` to `waitUntilReady` before using it. */
  async create(): Promise<PlatformKnowledgeInstance> {
    return (await this.api.request<{ instance: PlatformKnowledgeInstance }>('POST', this.path, {})).instance;
  }

  async get(instanceId: string): Promise<PlatformKnowledgeInstance> {
    return (await this.api.request<{ instance: PlatformKnowledgeInstance }>('GET', `${this.path}/${id(instanceId)}`))
      .instance;
  }

  async delete(instanceId: string): Promise<void> {
    await this.api.request('DELETE', `${this.path}/${id(instanceId)}`);
  }

  waitUntilReady(instanceId: string, options?: WaitOptions): Promise<PlatformKnowledgeInstance> {
    return waitUntilReady(() => this.get(instanceId), `Knowledge instance ${instanceId}`, options);
  }
}

export type PlatformDatabaseKind = 'turso' | 'neon' | 'redis' | 'postgres';

export interface PlatformDatabase {
  id: string;
  platformProjectId: string;
  environmentId: string | null;
  kind: PlatformDatabaseKind;
  name: string;
  status: ProvisioningStatus;
  region: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  [field: string]: unknown;
}

export type CreatePlatformDatabaseInput =
  | { kind: 'turso' | 'neon'; name: string; regionId?: string; environmentId?: string }
  | { kind: 'redis' | 'postgres'; name: string; environmentId: string };

export interface PlatformDatabaseConnection {
  envVars: { name: string; value: string }[];
  snippets: unknown[];
  docsUrl: string;
}

/** Managed databases. Creating and deleting them needs an organization admin. */
export class PlatformDatabases {
  constructor(
    private readonly api: PlatformApi,
    private readonly projectId: string,
  ) {}

  private get path() {
    return `/v1/server/projects/${id(this.projectId)}/databases`;
  }

  async list(): Promise<PlatformDatabase[]> {
    return (await this.api.request<{ databases: PlatformDatabase[] }>('GET', this.path)).databases;
  }

  /** Starts provisioning a database. Pass the result's `id` to `waitUntilReady` before connecting. */
  async create(input: CreatePlatformDatabaseInput): Promise<PlatformDatabase> {
    return (await this.api.request<{ database: PlatformDatabase }>('POST', this.path, input)).database;
  }

  async get(databaseId: string): Promise<PlatformDatabase> {
    return (await this.api.request<{ database: PlatformDatabase }>('GET', `${this.path}/${id(databaseId)}`)).database;
  }

  /** Environment variables and snippets for connecting to a ready database. */
  connection(databaseId: string): Promise<PlatformDatabaseConnection> {
    return this.api.request('GET', `${this.path}/${id(databaseId)}/connection`);
  }

  async delete(databaseId: string): Promise<void> {
    await this.api.request('DELETE', `${this.path}/${id(databaseId)}`);
  }

  waitUntilReady(databaseId: string, options?: WaitOptions): Promise<PlatformDatabase> {
    return waitUntilReady(() => this.get(databaseId), `Database ${databaseId}`, options);
  }
}

/** A file system as the Platform records it. Read and write its files through `MastraPlatform.getFilesystem`. */
export interface PlatformFilesystemRecord {
  id: string;
  environmentId: string;
  platformProjectId: string;
  provider?: 'railway' | 'neon';
  name?: string | null;
  bucketName: string | null;
  endpoint: string | null;
  status: 'provisioning' | 'ready' | 'failed' | 'destroyed';
  error: string | null;
  createdAt: string;
  updatedAt: string;
  [field: string]: unknown;
}

export interface CreatePlatformFilesystemInput {
  environmentId: string;
  /** Lowercase letters, numbers and dashes. */
  name: string;
}

/** File systems (storage buckets) in a project's environments. */
export class PlatformFilesystems {
  constructor(
    private readonly api: PlatformApi,
    private readonly projectId: string,
  ) {}

  private envPath(environmentId: string) {
    return `/v1/server/projects/${id(this.projectId)}/environments/${id(environmentId)}/buckets`;
  }

  list(environmentId: string): Promise<PlatformFilesystemRecord[]> {
    return this.api.request('GET', this.envPath(environmentId));
  }

  /** Starts provisioning a file system. Pass the result's `id` to `waitUntilReady` before using it. */
  create({ environmentId, name }: CreatePlatformFilesystemInput): Promise<PlatformFilesystemRecord> {
    return this.api.request('POST', this.envPath(environmentId), { name });
  }

  get(filesystemId: string): Promise<PlatformFilesystemRecord> {
    return this.api.request('GET', `/v1/server/projects/${id(this.projectId)}/buckets/${id(filesystemId)}`);
  }

  async delete(filesystem: Pick<PlatformFilesystemRecord, 'id' | 'environmentId'>): Promise<void> {
    await this.api.request('DELETE', `${this.envPath(filesystem.environmentId)}/${id(filesystem.id)}`);
  }

  waitUntilReady(filesystemId: string, options?: WaitOptions): Promise<PlatformFilesystemRecord> {
    return waitUntilReady(() => this.get(filesystemId), `File system ${filesystemId}`, options);
  }
}

/** A sandbox as the Platform records it. Start and run commands through `MastraPlatform.getSandbox`. */
export interface PlatformSandboxRecord {
  id: string;
  environmentId: string;
  status: 'provisioning' | 'ready' | 'paused' | 'failed' | 'destroyed';
  provider: 'railway' | 'e2b';
  createdAt: string;
  updatedAt: string;
  [field: string]: unknown;
}

/** The Platform's records of a project's sandboxes, including destroyed ones. */
export class PlatformSandboxes {
  constructor(
    private readonly api: PlatformApi,
    private readonly projectId: string,
  ) {}

  /** Sandboxes in an environment, newest first. */
  async list(environmentId: string): Promise<PlatformSandboxRecord[]> {
    const path = `/v1/server/projects/${id(this.projectId)}/environments/${id(environmentId)}/sandboxes`;
    const sandboxes: PlatformSandboxRecord[] = [];
    for (let page = 1; ; page++) {
      const result = await this.api.request<{ sandboxes: PlatformSandboxRecord[]; hasMore: boolean }>(
        'GET',
        `${path}?page=${page}`,
      );
      sandboxes.push(...result.sandboxes);
      if (!result.hasMore) return sandboxes;
    }
  }

  get(sandboxId: string): Promise<PlatformSandboxRecord> {
    return this.api.request('GET', `/v1/server/projects/${id(this.projectId)}/sandboxes/${id(sandboxId)}`);
  }
}
