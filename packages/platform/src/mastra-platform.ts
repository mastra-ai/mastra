import { MastraClient } from '@mastra/client-js';
import { ConnectClient } from '@mastra/connect';
import type { MastraStorage } from '@mastra/core/storage';
import { PlatformFilesystem, PlatformSandbox } from '@mastra/platform-workspace';
import type { PlatformFilesystemOptions, PlatformSandboxOptions } from '@mastra/platform-workspace';
import { PlatformAgent, toAgentBody } from './agents/platform-agent';
import type { CreatePlatformAgentInput, PlatformAgentRecord } from './agents/platform-agent';
import { PlatformKnowledge } from './knowledge/index';
import type { PlatformKnowledgeOptions } from './knowledge/index';
import { PlatformMemory } from './memory/platform-memory';
import type { PlatformMemoryOptions } from './memory/platform-memory';
import {
  PlatformApi,
  PlatformDatabases,
  PlatformEnvironments,
  PlatformFilesystems,
  PlatformSandboxes,
  PlatformKnowledgeInstances,
  PlatformMemoryInstances,
  PlatformProjects,
  waitUntilReady,
} from './provisioning/index';
import type { WaitOptions } from './provisioning/index';

export interface PlatformStorageOptions {
  /** The storage's id in Mastra. Defaults to the database id. */
  id?: string;
  /** Skip creating and migrating tables, for runtimes that run migrations separately. */
  disableInit?: boolean;
}

type ProjectScoped<T> = Omit<T, 'accessToken' | 'projectId' | 'fetch'>;

export interface MastraPlatformOptions {
  /**
   * Platform access token, organization API key, or `mastra auth login` session token. Falls back to
   * `MASTRA_PLATFORM_ACCESS_TOKEN`, then `MASTRA_PLATFORM_SECRET_KEY`.
   */
  accessToken?: string;
  /**
   * Mastra Platform project ID. Falls back to `MASTRA_PROJECT_ID`, then to the project a project
   * access token was issued for. Only project methods need it.
   */
  projectId?: string;
  /**
   * Organization to act in. Needed with a user session token; organization API keys and project
   * tokens already carry it. Falls back to `MASTRA_ORG_ID`.
   */
  organizationId?: string;
  /** Platform API URL. Falls back to `MASTRA_PLATFORM_API_URL`, then `https://platform.mastra.ai`. */
  apiUrl?: string;
  fetch?: typeof fetch;
}

export type ManagedAgentsSetupStatus = 'none' | 'provisioning' | 'ready' | 'failed';

const DEFAULT_API_URL = 'https://platform.mastra.ai';

function env(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

/** The `projectId` claim of a project access token (a JWT), read without verifying it. */
function tokenProjectId(token: string): string | undefined {
  const payload = token.split('.')[1];
  if (!payload) return undefined;
  try {
    const claims: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return claims && typeof claims === 'object' && 'projectId' in claims && typeof claims.projectId === 'string'
      ? claims.projectId
      : undefined;
  } catch {
    return undefined;
  }
}

interface ProjectServices {
  client: MastraClient;
  connect: ConnectClient;
  environments: PlatformEnvironments;
  memoryInstances: PlatformMemoryInstances;
  knowledgeInstances: PlatformKnowledgeInstances;
  databases: PlatformDatabases;
  filesystems: PlatformFilesystems;
  sandboxes: PlatformSandboxes;
}

/**
 * Client for the Mastra Platform API.
 *
 * @example
 * ```ts
 * const platform = new MastraPlatform({ accessToken: process.env.MASTRA_PLATFORM_ACCESS_TOKEN });
 * const agent = await platform.createAgent({ name: 'Support', instructions: 'Answer billing questions.' });
 * const response = await agent.stream('Where is my invoice?', { memory: { thread: 'thread-1', resource: 'user-1' } });
 * ```
 */
export class MastraPlatform {
  /** The organization's projects. */
  readonly projects: PlatformProjects;
  readonly #options: MastraPlatformOptions;
  readonly #accessToken: string;
  readonly #apiUrl: string;
  readonly #api: PlatformApi;
  readonly #projectId: string | undefined;
  #project: ProjectServices | undefined;

  constructor(options: MastraPlatformOptions = {}) {
    const accessToken = options.accessToken ?? env('MASTRA_PLATFORM_ACCESS_TOKEN') ?? env('MASTRA_PLATFORM_SECRET_KEY');
    if (!accessToken) throw new Error('MastraPlatform: accessToken is required');
    this.#options = options;
    this.#accessToken = accessToken;
    this.#apiUrl = options.apiUrl ?? env('MASTRA_PLATFORM_API_URL') ?? DEFAULT_API_URL;
    this.#projectId = options.projectId ?? env('MASTRA_PROJECT_ID') ?? tokenProjectId(accessToken);
    this.#api = new PlatformApi({
      apiUrl: this.#apiUrl,
      accessToken,
      organizationId: options.organizationId ?? env('MASTRA_ORG_ID'),
      fetch: options.fetch,
    });
    this.projects = new PlatformProjects(this.#api);
  }

  /** The project this client works in. Throws when none was given or found. */
  get projectId(): string {
    if (!this.#projectId) {
      throw new Error(
        'MastraPlatform: projectId is required. Pass it, set MASTRA_PROJECT_ID, or use platform.getProject(id)',
      );
    }
    return this.#projectId;
  }

  /**
   * A client for another project in the organization, with the same credentials. It has everything
   * this client has (`listAgents()`, `createAgent()`, `getMemory()`, ...), scoped to that project.
   * Makes no request: a project that doesn't exist fails on first use.
   */
  getProject(projectId: string): MastraPlatform {
    return new MastraPlatform({ ...this.#options, accessToken: this.#accessToken, projectId });
  }

  get #services(): ProjectServices {
    if (this.#project) return this.#project;
    const projectId = this.projectId;
    const organizationId = this.#options.organizationId ?? env('MASTRA_ORG_ID');
    this.#project = {
      client: new MastraClient({
        baseUrl: this.#apiUrl,
        apiPrefix: `/v1/server/projects/${encodeURIComponent(projectId)}`,
        headers: {
          authorization: `Bearer ${this.#accessToken}`,
          ...(organizationId ? { 'x-organization-id': organizationId } : {}),
        },
        fetch: this.#options.fetch,
      }),
      connect: new ConnectClient({
        accessToken: this.#accessToken,
        projectId,
        orgId: organizationId,
        fetch: this.#options.fetch,
      }),
      environments: new PlatformEnvironments(this.#api, projectId),
      memoryInstances: new PlatformMemoryInstances(this.#api, projectId),
      knowledgeInstances: new PlatformKnowledgeInstances(this.#api, projectId),
      databases: new PlatformDatabases(this.#api, projectId),
      filesystems: new PlatformFilesystems(this.#api, projectId),
      sandboxes: new PlatformSandboxes(this.#api, projectId),
    };
    return this.#project;
  }

  /**
   * Mastra Connect for the project: the provider accounts its agents and tools act through. Use
   * `connect.withResource(userId)` to connect, list, and remove an end user's own accounts.
   */
  get connect(): ConnectClient {
    return this.#services.connect;
  }

  /** The project's environments. */
  get environments(): PlatformEnvironments {
    return this.#services.environments;
  }

  /** Provision and manage the project's hosted Memory instances. Use `getMemory()` to read and write one. */
  get memoryInstances(): PlatformMemoryInstances {
    return this.#services.memoryInstances;
  }

  /** Provision and manage the project's hosted Knowledge instances. Use `getKnowledge()` to use one. */
  get knowledgeInstances(): PlatformKnowledgeInstances {
    return this.#services.knowledgeInstances;
  }

  /** Provision and manage the project's managed databases. */
  get databases(): PlatformDatabases {
    return this.#services.databases;
  }

  /** Provision and manage file systems in the project's environments. */
  get filesystems(): PlatformFilesystems {
    return this.#services.filesystems;
  }

  /** The Platform's records of the project's sandboxes. Use `createSandbox` or `getSandbox` to run commands. */
  get sandboxes(): PlatformSandboxes {
    return this.#services.sandboxes;
  }

  /** Whether the project is set up to run managed agents. */
  async agentsSetupStatus(): Promise<ManagedAgentsSetupStatus> {
    return (await this.#api.request<{ status: ManagedAgentsSetupStatus }>('GET', `${this.#agentsPath}/setup`)).status;
  }

  /**
   * Sets the project up to run managed agents (provisions its agents database), then waits until
   * it is ready. Safe to call on a project that is already set up.
   */
  async setupAgents(options: WaitOptions = {}): Promise<void> {
    const { ready } = await this.#api.request<{ ready: boolean }>('POST', `${this.#agentsPath}/setup`);
    if (ready) return;
    await waitUntilReady(
      async () => {
        const status = await this.agentsSetupStatus();
        // `none` until the setup started above is recorded.
        return { status: status === 'none' ? 'provisioning' : status };
      },
      `Managed agents setup for project ${this.projectId}`,
      options,
    );
  }

  get #agentsPath() {
    return `/v1/server/projects/${encodeURIComponent(this.projectId)}/agents`;
  }

  /** Creates a managed agent in the project. */
  async createAgent(input: CreatePlatformAgentInput): Promise<PlatformAgent> {
    const created = await this.#services.client.request<PlatformAgentRecord>('/agents', {
      method: 'POST',
      body: toAgentBody(input),
    });
    // The Platform resolves the default model and the tools the connections bring.
    return this.getAgent(created.id);
  }

  /**
   * An existing managed agent, with its name, instructions, model, and tools read from the
   * Platform.
   */
  async getAgent(agentId: string): Promise<PlatformAgent> {
    const client = this.#services.client;
    const details = await client.getAgent(agentId).details();
    return new PlatformAgent(client, {
      id: agentId,
      name: details.name,
      description: details.description,
      instructions: typeof details.instructions === 'string' ? details.instructions : undefined,
      model: gatewayModel(details.provider, details.modelId),
      tools: details.tools,
      memory: () => this.#agentMemoryLookup(),
    });
  }

  #agentMemory?: Promise<PlatformMemory | undefined>;

  /** The Platform Memory the project's managed agents keep their conversations in, once it's ready. */
  #agentMemoryLookup() {
    const lookup = (this.#agentMemory ??= this.#api
      .request<{ memoryInstanceId?: string }>('GET', `${this.#agentsPath}/setup`)
      .then(({ memoryInstanceId }) =>
        memoryInstanceId ? this.getMemory({ instanceId: memoryInstanceId }) : undefined,
      ));
    // Look again next time until the memory is ready.
    return lookup.then(
      memory => {
        if (!memory) this.#agentMemory = undefined;
        return memory;
      },
      error => {
        this.#agentMemory = undefined;
        throw error;
      },
    );
  }

  /** The project's managed agents, keyed by agent ID. */
  listAgents() {
    return this.#services.client.listAgents();
  }

  /**
   * A Platform Memory instance. Use it as an agent's `memory`, or read and write threads directly
   * through `memory.client`. `instanceId` falls back to `MASTRA_MEMORY_INSTANCE_ID`.
   */
  getMemory(options: ProjectScoped<PlatformMemoryOptions> = {}): PlatformMemory {
    return new PlatformMemory({
      ...options,
      accessToken: this.#accessToken,
      projectId: this.projectId,
      fetch: this.#options.fetch,
    });
  }

  /** A Platform Knowledge instance. `instanceId` falls back to `MASTRA_KNOWLEDGE_INSTANCE_ID`. */
  getKnowledge(options: ProjectScoped<PlatformKnowledgeOptions> = {}): PlatformKnowledge {
    return new PlatformKnowledge({ ...options, accessToken: this.#accessToken, projectId: this.projectId });
  }

  /**
   * A project file system, by the `id` it was provisioned with, ready to hand to a `Workspace`.
   * Throws while the file system is still provisioning or if provisioning failed.
   */
  async getFilesystem(
    filesystemId: string,
    options: ProjectScoped<Omit<PlatformFilesystemOptions, 'bucketName'>> = {},
  ): Promise<PlatformFilesystem> {
    const record = await this.filesystems.get(filesystemId);
    if (record.status !== 'ready' || !record.bucketName) {
      throw new Error(`File system ${filesystemId} is ${record.status}${record.error ? `: ${record.error}` : ''}`);
    }
    return new PlatformFilesystem({
      id: filesystemId,
      ...options,
      bucketName: record.bucketName,
      accessToken: this.#accessToken,
      projectId: this.projectId,
      fetch: this.#options.fetch,
    });
  }

  /**
   * A project database as Mastra storage, for `new Mastra({ storage })`, `new Memory({ storage })`
   * and anything else that takes one. Needs the store package for the database's kind installed:
   * `@mastra/libsql` for Turso, `@mastra/pg` for Neon and Postgres, `@mastra/redis` for Redis.
   */
  async getStorage(databaseId: string, options: PlatformStorageOptions = {}): Promise<MastraStorage> {
    const database = await this.databases.get(databaseId);
    if (database.status !== 'ready') {
      throw new Error(`Database ${databaseId} is ${database.status}${database.error ? `: ${database.error}` : ''}`);
    }
    const { envVars } = await this.databases.connection(databaseId);
    const env = (name: string) => {
      const value = envVars.find(v => v.name === name)?.value;
      if (!value) throw new Error(`Database ${databaseId} has no ${name}`);
      return value;
    };
    const config = { id: options.id ?? databaseId, disableInit: options.disableInit };
    switch (database.kind) {
      case 'turso': {
        const { LibSQLStore } = await import('@mastra/libsql');
        return new LibSQLStore({ ...config, url: env('TURSO_DATABASE_URL'), authToken: env('TURSO_AUTH_TOKEN') });
      }
      case 'neon':
      case 'postgres': {
        const { PostgresStore } = await import('@mastra/pg');
        return new PostgresStore({ ...config, connectionString: env('DATABASE_URL') });
      }
      case 'redis': {
        const { RedisStore } = await import('@mastra/redis');
        return new RedisStore({ ...config, connectionString: env('REDIS_URL') });
      }
    }
  }

  /**
   * Starts a Platform sandbox and resolves once it is running. Pass `sandboxId` to reattach to an
   * existing sandbox instead of provisioning a new one.
   */
  async createSandbox(options: ProjectScoped<PlatformSandboxOptions> = {}): Promise<PlatformSandbox> {
    const sandbox = new PlatformSandbox({
      ...options,
      accessToken: this.#accessToken,
      projectId: this.projectId,
      fetch: this.#options.fetch,
    });
    await sandbox.start();
    return sandbox;
  }

  /**
   * Reconnects to a sandbox started earlier, by the `sandboxId` you saved. Throws instead of
   * starting a replacement when the sandbox no longer exists.
   */
  async getSandbox(
    sandboxId: string,
    options: ProjectScoped<Omit<PlatformSandboxOptions, 'sandboxId' | 'reattach'>> = {},
  ): Promise<PlatformSandbox> {
    // The proxy routes by provider, so a sandbox has to be reached through the one that runs it.
    const sandboxProvider = options.sandboxProvider ?? (await this.sandboxes.get(sandboxId)).provider;
    return this.createSandbox({ ...options, sandboxId, sandboxProvider, reattach: 'required' });
  }
}

/** An agent's model as `provider/model`, however the Platform splits it into provider and ID. */
function gatewayModel(provider: string | undefined, modelId: string | undefined) {
  if (!modelId) return undefined;
  return modelId.includes('/') || !provider || provider === 'mastra' ? modelId : `${provider}/${modelId}`;
}
