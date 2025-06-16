import type { Agent } from '../agent';
import type { BundlerConfig } from '../bundler/types';
import type { MastraDeployer } from '../deployer';
import { LogLevel, noopLogger, ConsoleLogger } from '../logger';
import type { IMastraLogger } from '../logger';
import type { MCPServerBase } from '../mcp';
import type { MastraMemory } from '../memory/memory';
import type { AgentNetwork } from '../network';
import type { Middleware, ServerConfig } from '../server/types';
import type { MastraStorage } from '../storage';
import { augmentWithInit } from '../storage/storageWithInit';
import { InstrumentClass, Telemetry } from '../telemetry';
import type { OtelConfig } from '../telemetry';
import type { MastraTTS } from '../tts';
import type { MastraVector } from '../vector';
import type { Workflow } from '../workflows';
import type { LegacyWorkflow } from '../workflows/legacy';

export interface Config<
  TAgents extends Record<string, Agent<any>> = Record<string, Agent<any>>,
  TLegacyWorkflows extends Record<string, LegacyWorkflow> = Record<string, LegacyWorkflow>,
  TWorkflows extends Record<string, Workflow> = Record<string, Workflow>,
  TVectors extends Record<string, MastraVector> = Record<string, MastraVector>,
  TTTS extends Record<string, MastraTTS> = Record<string, MastraTTS>,
  TLogger extends IMastraLogger = IMastraLogger,
  TNetworks extends Record<string, AgentNetwork> = Record<string, AgentNetwork>,
  TMCPServers extends Record<string, MCPServerBase> = Record<string, MCPServerBase>,
> {
  agents?: TAgents;
  networks?: TNetworks;
  storage?: MastraStorage;
  vectors?: TVectors;
  logger?: TLogger | false;
  legacy_workflows?: TLegacyWorkflows;
  workflows?: TWorkflows;
  tts?: TTTS;
  telemetry?: OtelConfig;
  deployer?: MastraDeployer;
  server?: ServerConfig;
  mcpServers?: TMCPServers;
  bundler?: BundlerConfig;

  /**
   * Server middleware functions to be applied to API routes
   * Each middleware can specify a path pattern (defaults to '/api/*')
   * @deprecated use server.middleware instead
   */
  serverMiddleware?: Array<{
    handler: (c: any, next: () => Promise<void>) => Promise<Response | void>;
    path?: string;
  }>;

  // @deprecated add memory to your Agent directly instead
  memory?: never;
}

@InstrumentClass({
  prefix: 'mastra',
  excludeMethods: ['getLogger', 'getTelemetry'],
})
export class Mastra<
  TAgents extends Record<string, Agent<any>> = Record<string, Agent<any>>,
  TLegacyWorkflows extends Record<string, LegacyWorkflow> = Record<string, LegacyWorkflow>,
  TWorkflows extends Record<string, Workflow> = Record<string, Workflow>,
  TVectors extends Record<string, MastraVector> = Record<string, MastraVector>,
  TTTS extends Record<string, MastraTTS> = Record<string, MastraTTS>,
  TLogger extends IMastraLogger = IMastraLogger,
  TNetworks extends Record<string, AgentNetwork> = Record<string, AgentNetwork>,
  TMCPServers extends Record<string, MCPServerBase> = Record<string, MCPServerBase>,
> {
  #vectors?: TVectors;
  #agents: TAgents;
  #logger: TLogger;
  #legacy_workflows: TLegacyWorkflows;
  #workflows: TWorkflows;
  #tts?: TTTS;
  #deployer?: MastraDeployer;
  #serverMiddleware: Array<{
    handler: (c: any, next: () => Promise<void>) => Promise<Response | void>;
    path: string;
  }> = [];
  #telemetry?: Telemetry;
  #storage?: MastraStorage;
  #memory?: MastraMemory;
  #networks?: TNetworks;
  #server?: ServerConfig;
  #mcpServers?: TMCPServers;
  #bundler?: BundlerConfig;

  /**
   * @deprecated use getTelemetry() instead
   */
  get telemetry() {
    return this.#telemetry;
  }

  /**
   * @deprecated use getStorage() instead
   */
  get storage() {
    return this.#storage;
  }

  /**
   * @deprecated use getMemory() instead
   */
  get memory() {
    return this.#memory;
  }

  constructor(config?: Config<TAgents, TLegacyWorkflows, TWorkflows, TVectors, TTTS, TLogger, TNetworks, TMCPServers>) {
    // Store server middleware with default path
    if (config?.serverMiddleware) {
      this.#serverMiddleware = config.serverMiddleware.map(m => ({
        handler: m.handler,
        path: m.path || '/api/*',
      }));
    }

    /*
      Logger
    */

    let logger: TLogger;
    if (config?.logger === false) {
      logger = noopLogger as unknown as TLogger;
    } else {
      if (config?.logger) {
        logger = config.logger;
      } else {
        const levelOnEnv =
          process.env.NODE_ENV === 'production' && process.env.MASTRA_DEV !== 'true' ? LogLevel.WARN : LogLevel.INFO;
        logger = new ConsoleLogger({ name: 'Mastra', level: levelOnEnv }) as unknown as TLogger;
      }
    }
    this.#logger = logger;

    let storage = config?.storage;

    if (storage) {
      storage = augmentWithInit(storage);
    }

    /*
    Telemetry
    */
    this.#telemetry = Telemetry.init(config?.telemetry);

    /*
      Storage
    */
    if (this.#telemetry && storage) {
      this.#storage = this.#telemetry.traceClass(storage, {
        excludeMethods: ['__setTelemetry', '__getTelemetry', 'batchTraceInsert', 'getTraces', 'getEvalsByAgentName'],
      });
      this.#storage.__setTelemetry(this.#telemetry);
    } else {
      this.#storage = storage;
    }

    /*
    Vectors
    */
    if (config?.vectors) {
      let vectors: Record<string, MastraVector> = {};
      Object.entries(config.vectors).forEach(([key, vector]) => {
        if (this.#telemetry) {
          vectors[key] = this.#telemetry.traceClass(vector, {
            excludeMethods: ['__setTelemetry', '__getTelemetry'],
          });
          vectors[key].__setTelemetry(this.#telemetry);
        } else {
          vectors[key] = vector;
        }
      });

      this.#vectors = vectors as TVectors;
    }

    if (config?.vectors) {
      this.#vectors = config.vectors;
    }

    if (config?.networks) {
      this.#networks = config.networks;
    }

    if (config?.mcpServers) {
      this.#mcpServers = config.mcpServers;

      // Set logger/telemetry/Mastra instance/id for MCP servers
      Object.entries(this.#mcpServers).forEach(([key, server]) => {
        server.setId(key);
        if (this.#telemetry) {
          server.__setTelemetry(this.#telemetry);
        }

        server.__registerMastra(this);
        server.__setLogger(this.getLogger());
      });
    }

    if (config && `memory` in config) {
      throw new Error(`
  Memory should be added to Agents, not to Mastra.

Instead of:
  new Mastra({ memory: new Memory() })

do:
  new Agent({ memory: new Memory() })
`);
    }

    if (config?.tts) {
      this.#tts = config.tts;
      Object.entries(this.#tts).forEach(([key, ttsCl]) => {
        if (this.#tts?.[key]) {
          if (this.#telemetry) {
            // @ts-ignore
            this.#tts[key] = this.#telemetry.traceClass(ttsCl, {
              excludeMethods: ['__setTelemetry', '__getTelemetry'],
            });
            this.#tts[key].__setTelemetry(this.#telemetry);
          }
        }
      });
    }

    /*
    Agents
    */
    const agents: Record<string, Agent> = {};
    if (config?.agents) {
      Object.entries(config.agents).forEach(([key, agent]) => {
        if (agents[key]) {
          throw new Error(`Agent with name ID:${key} already exists`);
        }
        agent.__registerMastra(this);

        agent.__registerPrimitives({
          logger: this.getLogger(),
          telemetry: this.#telemetry,
          storage: this.storage,
          memory: this.memory,
          agents: agents,
          tts: this.#tts,
          vectors: this.#vectors,
        });

        agents[key] = agent;
      });
    }

    this.#agents = agents as TAgents;

    /*
    Networks
    */
    this.#networks = {} as TNetworks;

    if (config?.networks) {
      Object.entries(config.networks).forEach(([key, network]) => {
        network.__registerMastra(this);
        // @ts-ignore
        this.#networks[key] = network;
      });
    }

    /*
    Legacy Workflows
    */
    this.#legacy_workflows = {} as TLegacyWorkflows;

    if (config?.legacy_workflows) {
      Object.entries(config.legacy_workflows).forEach(([key, workflow]) => {
        workflow.__registerMastra(this);
        workflow.__registerPrimitives({
          logger: this.getLogger(),
          telemetry: this.#telemetry,
          storage: this.storage,
          memory: this.memory,
          agents: agents,
          tts: this.#tts,
          vectors: this.#vectors,
        });
        // @ts-ignore
        this.#legacy_workflows[key] = workflow;

        const workflowSteps = Object.values(workflow.steps).filter(step => !!step.workflowId && !!step.workflow);
        if (workflowSteps.length > 0) {
          workflowSteps.forEach(step => {
            // @ts-ignore
            this.#legacy_workflows[step.workflowId] = step.workflow;
          });
        }
      });
    }

    this.#workflows = {} as TWorkflows;
    if (config?.workflows) {
      Object.entries(config.workflows).forEach(([key, workflow]) => {
        workflow.__registerMastra(this);
        workflow.__registerPrimitives({
          logger: this.getLogger(),
          telemetry: this.#telemetry,
          storage: this.storage,
          memory: this.memory,
          agents: agents,
          tts: this.#tts,
          vectors: this.#vectors,
        });
        // @ts-ignore
        this.#workflows[key] = workflow;
      });
    }

    if (config?.server) {
      this.#server = config.server;
    }

    this.setLogger({ logger });
  }

  public getAgent<TAgentName extends keyof TAgents>(name: TAgentName): TAgents[TAgentName] {
    const agent = this.#agents?.[name];
    if (!agent) {
      throw new Error(`Agent with name ${String(name)} not found`);
    }
    return this.#agents[name];
  }

  public getAgents() {
    return this.#agents;
  }

  public getVector<TVectorName extends keyof TVectors>(name: TVectorName): TVectors[TVectorName] {
    const vector = this.#vectors?.[name];
    if (!vector) {
      throw new Error(`Vector with name ${String(name)} not found`);
    }
    return vector;
  }

  public getVectors() {
    return this.#vectors;
  }

  public getDeployer() {
    return this.#deployer;
  }

  public legacy_getWorkflow<TWorkflowId extends keyof TLegacyWorkflows>(
    id: TWorkflowId,
    { serialized }: { serialized?: boolean } = {},
  ): TLegacyWorkflows[TWorkflowId] {
    const workflow = this.#legacy_workflows?.[id];
    if (!workflow) {
      throw new Error(`Workflow with ID ${String(id)} not found`);
    }

    if (serialized) {
      return { name: workflow.name } as TLegacyWorkflows[TWorkflowId];
    }

    return workflow;
  }

  public getWorkflow<TWorkflowId extends keyof TWorkflows>(
    id: TWorkflowId,
    { serialized }: { serialized?: boolean } = {},
  ): TWorkflows[TWorkflowId] {
    const workflow = this.#workflows?.[id];
    if (!workflow) {
      throw new Error(`Workflow with ID ${String(id)} not found`);
    }

    if (serialized) {
      return { name: workflow.name } as TWorkflows[TWorkflowId];
    }

    return workflow;
  }

  public legacy_getWorkflows(props: { serialized?: boolean } = {}): Record<string, LegacyWorkflow> {
    if (props.serialized) {
      return Object.entries(this.#legacy_workflows).reduce((acc, [k, v]) => {
        return {
          ...acc,
          [k]: { name: v.name },
        };
      }, {});
    }
    return this.#legacy_workflows;
  }

  public getWorkflows(props: { serialized?: boolean } = {}): Record<string, Workflow> {
    if (props.serialized) {
      return Object.entries(this.#workflows).reduce((acc, [k, v]) => {
        return {
          ...acc,
          [k]: { name: v.name },
        };
      }, {});
    }
    return this.#workflows;
  }

  public setStorage(storage: MastraStorage) {
    this.#storage = augmentWithInit(storage);
  }

  public setLogger({ logger }: { logger: TLogger }) {
    this.#logger = logger;

    if (this.#agents) {
      Object.keys(this.#agents).forEach(key => {
        this.#agents?.[key]?.__setLogger(this.#logger);
      });
    }

    if (this.#memory) {
      this.#memory.__setLogger(this.#logger);
    }

    if (this.#deployer) {
      this.#deployer.__setLogger(this.#logger);
    }

    if (this.#tts) {
      Object.keys(this.#tts).forEach(key => {
        this.#tts?.[key]?.__setLogger(this.#logger);
      });
    }

    if (this.#storage) {
      this.#storage.__setLogger(this.#logger);
    }

    if (this.#vectors) {
      Object.keys(this.#vectors).forEach(key => {
        this.#vectors?.[key]?.__setLogger(this.#logger);
      });
    }

    if (this.#mcpServers) {
      Object.keys(this.#mcpServers).forEach(key => {
        this.#mcpServers?.[key]?.__setLogger(this.#logger);
      });
    }
  }

  public setTelemetry(telemetry: OtelConfig) {
    this.#telemetry = Telemetry.init(telemetry);

    if (this.#agents) {
      Object.keys(this.#agents).forEach(key => {
        if (this.#telemetry) {
          this.#agents?.[key]?.__setTelemetry(this.#telemetry);
        }
      });
    }

    if (this.#memory) {
      this.#memory = this.#telemetry.traceClass(this.#memory, {
        excludeMethods: ['__setTelemetry', '__getTelemetry'],
      });
      this.#memory.__setTelemetry(this.#telemetry);
    }

    if (this.#deployer) {
      this.#deployer = this.#telemetry.traceClass(this.#deployer, {
        excludeMethods: ['__setTelemetry', '__getTelemetry'],
      });
      this.#deployer.__setTelemetry(this.#telemetry);
    }

    if (this.#tts) {
      let tts = {} as Record<string, MastraTTS>;
      Object.entries(this.#tts).forEach(([key, ttsCl]) => {
        if (this.#telemetry) {
          tts[key] = this.#telemetry.traceClass(ttsCl, {
            excludeMethods: ['__setTelemetry', '__getTelemetry'],
          });
          tts[key].__setTelemetry(this.#telemetry);
        }
      });
      this.#tts = tts as TTTS;
    }

    if (this.#storage) {
      this.#storage = this.#telemetry.traceClass(this.#storage, {
        excludeMethods: ['__setTelemetry', '__getTelemetry'],
      });
      this.#storage.__setTelemetry(this.#telemetry);
    }

    if (this.#vectors) {
      let vectors = {} as Record<string, MastraVector>;
      Object.entries(this.#vectors).forEach(([key, vector]) => {
        if (this.#telemetry) {
          vectors[key] = this.#telemetry.traceClass(vector, {
            excludeMethods: ['__setTelemetry', '__getTelemetry'],
          });
          vectors[key].__setTelemetry(this.#telemetry);
        }
      });
      this.#vectors = vectors as TVectors;
    }
  }

  public getTTS() {
    return this.#tts;
  }

  public getLogger() {
    return this.#logger;
  }

  public getTelemetry() {
    return this.#telemetry;
  }

  public getMemory() {
    return this.#memory;
  }

  public getStorage() {
    return this.#storage;
  }

  public getServerMiddleware() {
    return this.#serverMiddleware;
  }

  public setServerMiddleware(serverMiddleware: Middleware | Middleware[]) {
    if (typeof serverMiddleware === 'function') {
      this.#serverMiddleware = [
        {
          handler: serverMiddleware,
          path: '/api/*',
        },
      ];
      return;
    }

    if (!Array.isArray(serverMiddleware)) {
      throw new Error(`Invalid middleware: expected a function or array, received ${typeof serverMiddleware}`);
    }

    this.#serverMiddleware = serverMiddleware.map(m => {
      if (typeof m === 'function') {
        return {
          handler: m,
          path: '/api/*',
        };
      }
      return {
        handler: m.handler,
        path: m.path || '/api/*',
      };
    });
  }

  public getNetworks() {
    return Object.values(this.#networks || {});
  }

  public getServer() {
    return this.#server;
  }

  public getBundlerConfig() {
    return this.#bundler;
  }

  /**
   * Get a specific network by ID
   * @param networkId - The ID of the network to retrieve
   * @returns The network with the specified ID, or undefined if not found
   */
  public getNetwork(networkId: string): AgentNetwork | undefined {
    const networks = this.getNetworks();
    return networks.find(network => {
      const routingAgent = network.getRoutingAgent();
      return network.formatAgentId(routingAgent.name) === networkId;
    });
  }

  public async getLogsByRunId({
    runId,
    transportId,
    fromDate,
    toDate,
    logLevel,
    filters,
    page,
    perPage,
  }: {
    runId: string;
    transportId: string;
    fromDate?: Date;
    toDate?: Date;
    logLevel?: LogLevel;
    filters?: Record<string, any>;
    page?: number;
    perPage?: number;
  }) {
    if (!transportId) {
      throw new Error('Transport ID is required');
    }

    if (!this.#logger?.getLogsByRunId) {
      throw new Error('Logger is not set');
    }

    return await this.#logger.getLogsByRunId({
      runId,
      transportId,
      fromDate,
      toDate,
      logLevel,
      filters,
      page,
      perPage,
    });
  }

  public async getLogs(
    transportId: string,
    params?: {
      fromDate?: Date;
      toDate?: Date;
      logLevel?: LogLevel;
      filters?: Record<string, any>;
      page?: number;
      perPage?: number;
    },
  ) {
    if (!transportId) {
      throw new Error('Transport ID is required');
    }

    if (!this.#logger?.getLogs) {
      throw new Error('Logger is not set');
    }

    return await this.#logger.getLogs(transportId, params);
  }

  /**
   * Get all registered MCP server instances.
   * @returns A record of MCP server ID to MCPServerBase instance, or undefined if none are registered.
   */
  public getMCPServers(): Record<string, MCPServerBase> | undefined {
    return this.#mcpServers;
  }

  /**
   * Get a specific MCP server instance.
   * If a version is provided, it attempts to find the server with that exact logical ID and version.
   * If no version is provided, it returns the server with the specified logical ID that has the most recent releaseDate.
   * The logical ID should match the `id` property of the MCPServer instance (typically set via MCPServerConfig.id).
   * @param serverId - The logical ID of the MCP server to retrieve.
   * @param version - Optional specific version of the MCP server to retrieve.
   * @returns The MCP server instance, or undefined if not found or if the specific version is not found.
   */
  public getMCPServer(serverId: string, version?: string): MCPServerBase | undefined {
    if (!this.#mcpServers) {
      return undefined;
    }

    const allRegisteredServers = Object.values(this.#mcpServers || {});

    const matchingLogicalIdServers = allRegisteredServers.filter(server => server.id === serverId);

    if (matchingLogicalIdServers.length === 0) {
      this.#logger?.debug(`No MCP servers found with logical ID: ${serverId}`);
      return undefined;
    }

    if (version) {
      const specificVersionServer = matchingLogicalIdServers.find(server => server.version === version);
      if (!specificVersionServer) {
        this.#logger?.debug(`MCP server with logical ID '${serverId}' found, but not version '${version}'.`);
      }
      return specificVersionServer;
    } else {
      // No version specified, find the one with the most recent releaseDate
      if (matchingLogicalIdServers.length === 1) {
        return matchingLogicalIdServers[0];
      }

      matchingLogicalIdServers.sort((a, b) => {
        // Ensure releaseDate exists and is a string before creating a Date object
        const dateAVal = a.releaseDate && typeof a.releaseDate === 'string' ? new Date(a.releaseDate).getTime() : NaN;
        const dateBVal = b.releaseDate && typeof b.releaseDate === 'string' ? new Date(b.releaseDate).getTime() : NaN;

        if (isNaN(dateAVal) && isNaN(dateBVal)) return 0;
        if (isNaN(dateAVal)) return 1; // Treat invalid/missing dates as older
        if (isNaN(dateBVal)) return -1; // Treat invalid/missing dates as older

        return dateBVal - dateAVal; // Sorts in descending order of time (latest first)
      });

      // After sorting, the first element should be the latest if its date is valid
      if (matchingLogicalIdServers.length > 0) {
        const latestServer = matchingLogicalIdServers[0];
        if (
          latestServer &&
          latestServer.releaseDate &&
          typeof latestServer.releaseDate === 'string' &&
          !isNaN(new Date(latestServer.releaseDate).getTime())
        ) {
          return latestServer;
        }
      }
      this.#logger?.warn(
        `Could not determine the latest server for logical ID '${serverId}' due to invalid or missing release dates, or no servers left after filtering.`,
      );
      return undefined;
    }
  }
}
