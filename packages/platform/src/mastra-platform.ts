import { MastraClient } from '@mastra/client-js';
import { PlatformSandbox } from '@mastra/platform-workspace';
import type { PlatformSandboxOptions } from '@mastra/platform-workspace';
import { PlatformAgent, toAgentBody } from './agents/platform-agent';
import type { CreatePlatformAgentInput, PlatformAgentRecord } from './agents/platform-agent';
import { PlatformConnect } from './connect/platform-connect';
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
  connect: PlatformConnect;
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
        'MastraPlatform: projectId is required. Pass it, set MASTRA_PROJECT_ID, or use platform.project(id)',
      );
    }
    return this.#projectId;
  }

  /** A client for another project, with the same credentials. */
  project(projectId: string): MastraPlatform {
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
      connect: new PlatformConnect({ accessToken: this.#accessToken, projectId, fetch: this.#options.fetch }),
      environments: new PlatformEnvironments(this.#api, projectId),
      memoryInstances: new PlatformMemoryInstances(this.#api, projectId),
      knowledgeInstances: new PlatformKnowledgeInstances(this.#api, projectId),
      databases: new PlatformDatabases(this.#api, projectId),
      filesystems: new PlatformFilesystems(this.#api, projectId),
      sandboxes: new PlatformSandboxes(this.#api, projectId),
    };
    return this.#project;
  }

  /** Mastra Connect: the provider accounts the project's agents and tools act through. */
  get connect(): PlatformConnect {
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
    return new PlatformAgent(this.#services.client, created.id);
  }

  /** A handle to an existing managed agent. Makes no request. */
  getAgent(agentId: string): PlatformAgent {
    return new PlatformAgent(this.#services.client, agentId);
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
