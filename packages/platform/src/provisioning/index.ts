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

function errorMessage(body: unknown): string | undefined {
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

export type PlatformEnvironmentType = 'production' | 'staging' | 'preview';

export interface PlatformEnvironment {
  id: string;
  projectId: string;
  name: string;
  slug: string;
  type: PlatformEnvironmentType;
  branch: string | null;
  region: string | null;
  /** Where the environment's deployed server answers, once it has been deployed. */
  instanceUrl: string | null;
  customServerUrl: string | null;
  /**
   * The environment's variables. Where the project keeps secrets encrypted, a secret's value reads as
   * `__mastra_secret__`; sending that value back keeps the stored secret.
   */
  envVars: Record<string, string> | null;
  /** Names of the variables the project's databases add at deploy time. Their values are never returned. */
  managedEnvVarNames?: string[];
  [field: string]: unknown;
}

export interface CreatePlatformEnvironmentInput {
  name: string;
  type: PlatformEnvironmentType;
  /** Git branch that deploys to this environment on push. */
  branch?: string;
  region?: string;
  customServerUrl?: string;
  envVars?: Record<string, string>;
}

export interface UpdatePlatformEnvironmentInput {
  name?: string;
  /** Git branch that deploys to this environment on push. `null` unbinds it. */
  branch?: string | null;
  customServerUrl?: string | null;
  /** Replaces all of the environment's variables. Use `setVars()` and `unsetVars()` to change some. */
  envVars?: Record<string, string>;
}

export interface DeletedPlatformEnvironment {
  deletedAt?: string;
  /** Until when `restore()` can bring the environment back. `null` for an immediate delete. */
  undoUntil: string | null;
  /** Set when an environment that was already deleted is torn down immediately. */
  teardownAfter?: string;
}

export type PlatformDeployStatus =
  | 'queued'
  | 'uploading'
  | 'starting'
  | 'building'
  | 'deploying'
  | 'running'
  | 'sleeping'
  | 'stopped'
  | 'failed'
  | 'crashed'
  | 'cancelled'
  | 'unknown';

export interface PlatformDeploy {
  id: string;
  environmentId: string;
  status: PlatformDeployStatus;
  instanceUrl: string | null;
  mastraVersion: string | null;
  error: string | null;
  createdAt: string | null;
  githubBranch: string | null;
  githubCommitSha: string | null;
  [field: string]: unknown;
}

/**
 * A project's environments: their variables, deploys, and lifecycle. Databases, file systems,
 * sandboxes and browsers run in one.
 */
export class PlatformEnvironments {
  constructor(
    private readonly api: PlatformApi,
    private readonly projectId: string,
  ) {}

  #path(environmentId?: string, rest = '') {
    const base = `/v1/projects/${id(this.projectId)}/environments`;
    return environmentId === undefined ? base : `${base}/${id(environmentId)}${rest}`;
  }

  async list(): Promise<PlatformEnvironment[]> {
    return (await this.api.request<{ environments: PlatformEnvironment[] }>('GET', this.#path())).environments;
  }

  async create(input: CreatePlatformEnvironmentInput): Promise<PlatformEnvironment> {
    return (await this.api.request<{ environment: PlatformEnvironment }>('POST', this.#path(), input)).environment;
  }

  async get(environmentId: string): Promise<PlatformEnvironment> {
    return (await this.api.request<{ environment: PlatformEnvironment }>('GET', this.#path(environmentId))).environment;
  }

  async update(environmentId: string, input: UpdatePlatformEnvironmentInput): Promise<PlatformEnvironment> {
    const { environment } = await this.api.request<{ environment: PlatformEnvironment | null }>(
      'PATCH',
      this.#path(environmentId),
      input,
    );
    if (!environment) {
      throw new MastraPlatformError(`Environment ${environmentId} was deleted during the update`, 404, null);
    }
    return environment;
  }

  /**
   * Sets variables, keeping the others. Reads the variables and writes them all back, so a change
   * someone else saves in between is overwritten. Takes effect on the next deploy or `restart()`.
   */
  async setVars(environmentId: string, vars: Record<string, string>): Promise<PlatformEnvironment> {
    const { envVars } = await this.get(environmentId);
    return this.update(environmentId, { envVars: { ...envVars, ...vars } });
  }

  /** Removes variables, keeping the others. Same caveats as `setVars()`. */
  async unsetVars(environmentId: string, names: string[]): Promise<PlatformEnvironment> {
    const envVars = { ...(await this.get(environmentId)).envVars };
    for (const name of names) delete envVars[name];
    return this.update(environmentId, { envVars });
  }

  /**
   * Deletes the environment. It can be restored until `undoUntil`; `immediate` skips that window
   * and tears it down on the next pass.
   */
  async delete(environmentId: string, options: { immediate?: boolean } = {}): Promise<DeletedPlatformEnvironment> {
    const query = options.immediate ? '?immediate=true' : '';
    const { success: _, ...deleted } = await this.api.request<DeletedPlatformEnvironment & { success: true }>(
      'DELETE',
      this.#path(environmentId, query),
    );
    return deleted;
  }

  /** Brings back an environment deleted within its undo window. */
  async restore(environmentId: string): Promise<PlatformEnvironment> {
    return (
      await this.api.request<{ environment: PlatformEnvironment }>('POST', this.#path(environmentId, '/undelete'))
    ).environment;
  }

  /** Restarts the deployed server, so saved variables take effect without a deploy. */
  async restart(environmentId: string): Promise<{ id: string; status: string }> {
    return this.api.request('POST', this.#path(environmentId, '/restart'));
  }

  /** The environment's deploys, newest first. */
  async listDeploys(environmentId: string): Promise<PlatformDeploy[]> {
    return (await this.api.request<{ deploys: PlatformDeploy[] }>('GET', this.#path(environmentId, '/deploys')))
      .deploys;
  }

  async getDeploy(environmentId: string, deployId: string): Promise<PlatformDeploy> {
    return (
      await this.api.request<{ deploy: PlatformDeploy }>('GET', this.#path(environmentId, `/deploys/${id(deployId)}`))
    ).deploy;
  }

  /** A deploy's build and runtime logs. */
  async deployLogs(environmentId: string, deployId: string): Promise<string> {
    return (await this.api.request<{ logs: string }>('GET', this.#path(environmentId, `/deploys/${id(deployId)}/logs`)))
      .logs;
  }

  /** Cancels a deploy that is still queued or uploading. */
  async cancelDeploy(environmentId: string, deployId: string): Promise<{ id: string; status: PlatformDeployStatus }> {
    return this.api.request('POST', this.#path(environmentId, `/deploys/${id(deployId)}/cancel`));
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
