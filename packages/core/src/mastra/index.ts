import type { Agent } from '../agent';
import { getAllAITracing, setupAITracing, shutdownAITracingRegistry } from '../ai-tracing';
import type { AITracingConfig } from '../ai-tracing';
import type { BundlerConfig } from '../bundler/types';
import type { MastraDeployer } from '../deployer';
import { MastraError, ErrorDomain, ErrorCategory } from '../error';
import { EventEmitterPubSub } from '../events/event-emitter';
import type { PubSub } from '../events/pubsub';
import type { Event } from '../events/types';
import { AvailableHooks, registerHook } from '../hooks';
import { LogLevel, noopLogger, ConsoleLogger } from '../logger';
import type { IMastraLogger } from '../logger';
import type { MCPServerBase } from '../mcp';
import type { MastraMemory } from '../memory/memory';
import type { AgentNetwork } from '../network';
import type { NewAgentNetwork } from '../network/vNext';
import type { MastraScorer } from '../scores';
import type { Middleware, ServerConfig } from '../server/types';
import type { MastraStorage } from '../storage';
import { augmentWithInit } from '../storage/storageWithInit';
import { InstrumentClass, Telemetry } from '../telemetry';
import type { OtelConfig } from '../telemetry';
import type { MastraTTS } from '../tts';
import type { MastraIdGenerator } from '../types';
import type { MastraVector } from '../vector';
import type { Workflow } from '../workflows';
import { WorkflowEventProcessor } from '../workflows/evented/workflow-event-processor';
import type { LegacyWorkflow } from '../workflows/legacy';
import { createOnScorerHook } from './hooks';

export interface Config<
  TAgents extends Record<string, Agent<any>> = Record<string, Agent<any>>,
  TLegacyWorkflows extends Record<string, LegacyWorkflow> = Record<string, LegacyWorkflow>,
  TWorkflows extends Record<string, Workflow> = Record<string, Workflow>,
  TVectors extends Record<string, MastraVector> = Record<string, MastraVector>,
  TTTS extends Record<string, MastraTTS> = Record<string, MastraTTS>,
  TLogger extends IMastraLogger = IMastraLogger,
  TNetworks extends Record<string, AgentNetwork> = Record<string, AgentNetwork>,
  TVNextNetworks extends Record<string, NewAgentNetwork> = Record<string, NewAgentNetwork>,
  TMCPServers extends Record<string, MCPServerBase> = Record<string, MCPServerBase>,
  TScorers extends Record<string, MastraScorer<any, any, any, any>> = Record<string, MastraScorer<any, any, any, any>>,
> {
  agents?: TAgents;
  networks?: TNetworks;
  vnext_networks?: TVNextNetworks;
  storage?: MastraStorage;
  vectors?: TVectors;
  logger?: TLogger | false;
  legacy_workflows?: TLegacyWorkflows;
  workflows?: TWorkflows;
  tts?: TTTS;
  telemetry?: OtelConfig;
  observability?: AITracingConfig;
  idGenerator?: MastraIdGenerator;
  deployer?: MastraDeployer;
  server?: ServerConfig;
  mcpServers?: TMCPServers;
  bundler?: BundlerConfig;
  pubsub?: PubSub;
  scorers?: TScorers;

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

  events?: {
    [topic: string]: (
      event: Event,
      cb?: () => Promise<void>,
    ) => Promise<void> | ((event: Event, cb?: () => Promise<void>) => Promise<void>)[];
  };
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
  TVNextNetworks extends Record<string, NewAgentNetwork> = Record<string, NewAgentNetwork>,
  TMCPServers extends Record<string, MCPServerBase> = Record<string, MCPServerBase>,
  TScorers extends Record<string, MastraScorer<any, any, any, any>> = Record<string, MastraScorer<any, any, any, any>>,
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
  #vnext_networks?: TVNextNetworks;
  #scorers?: TScorers;
  #server?: ServerConfig;
  #mcpServers?: TMCPServers;
  #bundler?: BundlerConfig;
  #idGenerator?: MastraIdGenerator;
  #pubsub: PubSub;
  #events: {
    [topic: string]: ((event: Event, cb?: () => Promise<void>) => Promise<void>)[];
  } = {};

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

  get pubsub() {
    return this.#pubsub;
  }

  public getIdGenerator() {
    return this.#idGenerator;
  }

  /**
   * Generate a unique identifier using the configured generator or default to crypto.randomUUID()
   * @returns A unique string ID
   */
  public generateId(): string {
    if (this.#idGenerator) {
      const id = this.#idGenerator();
      if (!id) {
        const error = new MastraError({
          id: 'MASTRA_ID_GENERATOR_RETURNED_EMPTY_STRING',
          domain: ErrorDomain.MASTRA,
          category: ErrorCategory.USER,
          text: 'ID generator returned an empty string, which is not allowed',
        });
        this.#logger?.trackException(error);
        throw error;
      }
      return id;
    }
    return crypto.randomUUID();
  }

  public setIdGenerator(idGenerator: MastraIdGenerator) {
    this.#idGenerator = idGenerator;
  }

  constructor(
    config?: Config<
      TAgents,
      TLegacyWorkflows,
      TWorkflows,
      TVectors,
      TTTS,
      TLogger,
      TNetworks,
      TVNextNetworks,
      TMCPServers,
      TScorers
    >,
  ) {
    // Store server middleware with default path
    if (config?.serverMiddleware) {
      this.#serverMiddleware = config.serverMiddleware.map(m => ({
        handler: m.handler,
        path: m.path || '/api/*',
      }));
    }

    /*
    Events
    */
    if (config?.pubsub) {
      this.#pubsub = config.pubsub;
    } else {
      this.#pubsub = new EventEmitterPubSub();
    }

    this.#events = {};
    for (const topic in config?.events ?? {}) {
      if (!Array.isArray(config?.events?.[topic])) {
        this.#events[topic] = [config?.events?.[topic] as any];
      } else {
        this.#events[topic] = config?.events?.[topic] ?? [];
      }
    }

    const workflowEventProcessor = new WorkflowEventProcessor({ mastra: this });
    const workflowEventCb = async (event: Event, cb?: () => Promise<void>): Promise<void> => {
      try {
        await workflowEventProcessor.process(event, cb);
      } catch (e) {
        console.error('Error processing event', e);
      }
    };
    if (this.#events.workflows) {
      this.#events.workflows.push(workflowEventCb);
    } else {
      this.#events.workflows = [workflowEventCb];
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

    this.#idGenerator = config?.idGenerator;

    let storage = config?.storage;

    if (storage) {
      storage = augmentWithInit(storage);
    }

    /*
    Telemetry
    */

    this.#telemetry = Telemetry.init(config?.telemetry);

    // Warn if telemetry is enabled but the instrumentation global is not set
    if (
      config?.telemetry?.enabled !== false &&
      typeof globalThis !== 'undefined' &&
      (globalThis as any).___MASTRA_TELEMETRY___ !== true
    ) {
      this.#logger?.warn(
        `Mastra telemetry is enabled, but the required instrumentation file was not loaded. ` +
          `If you are using Mastra outside of the mastra server environment, see: https://mastra.ai/en/docs/observability/tracing#tracing-outside-mastra-server-environment`,
        `If you are using a custom instrumentation file or want to disable this warning, set the globalThis.___MASTRA_TELEMETRY___ variable to true in your instrumentation file.`,
      );
    }

    /*
    AI Tracing
    */

    if (config?.observability) {
      setupAITracing(config.observability);
    }

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

    if (config?.networks) {
      this.#networks = config.networks;
    }

    if (config?.vnext_networks) {
      this.#vnext_networks = config.vnext_networks;
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
      const error = new MastraError({
        id: 'MASTRA_CONSTRUCTOR_INVALID_MEMORY_CONFIG',
        domain: ErrorDomain.MASTRA,
        category: ErrorCategory.USER,
        text: `
  Memory should be added to Agents, not to Mastra.

Instead of:
  new Mastra({ memory: new Memory() })

do:
  new Agent({ memory: new Memory() })
`,
      });
      this.#logger?.trackException(error);
      throw error;
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
          const error = new MastraError({
            id: 'MASTRA_AGENT_REGISTRATION_DUPLICATE_ID',
            domain: ErrorDomain.MASTRA,
            category: ErrorCategory.USER,
            text: `Agent with name ID:${key} already exists`,
            details: {
              agentId: key,
            },
          });
          this.#logger?.trackException(error);
          throw error;
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
    this.#vnext_networks = {} as TVNextNetworks;

    if (config?.networks) {
      Object.entries(config.networks).forEach(([key, network]) => {
        network.__registerMastra(this);
        // @ts-ignore
        this.#networks[key] = network;
      });
    }

    if (config?.vnext_networks) {
      Object.entries(config.vnext_networks).forEach(([key, network]) => {
        network.__registerMastra(this);
        // @ts-ignore
        this.#vnext_networks[key] = network;
      });
    }

    /**
     * Scorers
     */

    const scorers = {} as Record<string, MastraScorer<any, any, any, any>>;
    if (config?.scorers) {
      Object.entries(config.scorers).forEach(([key, scorer]) => {
        scorers[key] = scorer;
      });
    }
    this.#scorers = scorers as TScorers;

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

    registerHook(AvailableHooks.ON_SCORER_RUN, createOnScorerHook(this));

    /*
      Register Mastra instance with AI tracing exporters and initialize them
    */
    if (config?.observability) {
      this.registerAITracingExporters();
      this.initAITracingExporters();
    }

    this.setLogger({ logger });
  }

  /**
   * Register this Mastra instance with AI tracing exporters that need it
   */
  private registerAITracingExporters(): void {
    const allTracingInstances = getAllAITracing();
    allTracingInstances.forEach(tracing => {
      const exporters = tracing.getExporters();
      exporters.forEach(exporter => {
        // Check if exporter has __registerMastra method
        if ('__registerMastra' in exporter && typeof (exporter as any).__registerMastra === 'function') {
          (exporter as any).__registerMastra(this);
        }
      });
    });
  }

  /**
   * Initialize all AI tracing exporters after registration is complete
   */
  private initAITracingExporters(): void {
    const allTracingInstances = getAllAITracing();

    allTracingInstances.forEach(tracing => {
      const exporters = tracing.getExporters();
      exporters.forEach(exporter => {
        // Initialize exporter if it has an init method
        if ('init' in exporter && typeof exporter.init === 'function') {
          try {
            exporter.init();
          } catch (error) {
            this.#logger?.warn('Failed to initialize AI tracing exporter', {
              exporterName: exporter.name,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      });
    });
  }

  public getAgent<TAgentName extends keyof TAgents>(name: TAgentName): TAgents[TAgentName] {
    const agent = this.#agents?.[name];
    if (!agent) {
      const error = new MastraError({
        id: 'MASTRA_GET_AGENT_BY_NAME_NOT_FOUND',
        domain: ErrorDomain.MASTRA,
        category: ErrorCategory.USER,
        text: `Agent with name ${String(name)} not found`,
        details: {
          status: 404,
          agentName: String(name),
          agents: Object.keys(this.#agents ?? {}).join(', '),
        },
      });
      this.#logger?.trackException(error);
      throw error;
    }
    return this.#agents[name];
  }

  public getAgentById(id: string): Agent {
    let agent = Object.values(this.#agents).find(a => a.id === id);

    if (!agent) {
      try {
        agent = this.getAgent(id as any);
      } catch {
        // do nothing
      }
    }

    if (!agent) {
      const error = new MastraError({
        id: 'MASTRA_GET_AGENT_BY_AGENT_ID_NOT_FOUND',
        domain: ErrorDomain.MASTRA,
        category: ErrorCategory.USER,
        text: `Agent with id ${String(id)} not found`,
        details: {
          status: 404,
          agentId: String(id),
          agents: Object.keys(this.#agents ?? {}).join(', '),
        },
      });
      this.#logger?.trackException(error);
      throw error;
    }

    return agent;
  }

  public getAgents() {
    return this.#agents;
  }

  public getVector<TVectorName extends keyof TVectors>(name: TVectorName): TVectors[TVectorName] {
    const vector = this.#vectors?.[name];
    if (!vector) {
      const error = new MastraError({
        id: 'MASTRA_GET_VECTOR_BY_NAME_NOT_FOUND',
        domain: ErrorDomain.MASTRA,
        category: ErrorCategory.USER,
        text: `Vector with name ${String(name)} not found`,
        details: {
          status: 404,
          vectorName: String(name),
          vectors: Object.keys(this.#vectors ?? {}).join(', '),
        },
      });
      this.#logger?.trackException(error);
      throw error;
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
      const error = new MastraError({
        id: 'MASTRA_GET_LEGACY_WORKFLOW_BY_ID_NOT_FOUND',
        domain: ErrorDomain.MASTRA,
        category: ErrorCategory.USER,
        text: `Workflow with ID ${String(id)} not found`,
        details: {
          status: 404,
          workflowId: String(id),
          workflows: Object.keys(this.#legacy_workflows ?? {}).join(', '),
        },
      });
      this.#logger?.trackException(error);
      throw error;
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
      const error = new MastraError({
        id: 'MASTRA_GET_WORKFLOW_BY_ID_NOT_FOUND',
        domain: ErrorDomain.MASTRA,
        category: ErrorCategory.USER,
        text: `Workflow with ID ${String(id)} not found`,
        details: {
          status: 404,
          workflowId: String(id),
          workflows: Object.keys(this.#workflows ?? {}).join(', '),
        },
      });
      this.#logger?.trackException(error);
      throw error;
    }

    if (serialized) {
      return { name: workflow.name } as TWorkflows[TWorkflowId];
    }

    return workflow;
  }

  public getWorkflowById(id: string): Workflow {
    let workflow = Object.values(this.#workflows).find(a => a.id === id);

    if (!workflow) {
      try {
        workflow = this.getWorkflow(id as any);
      } catch {
        // do nothing
      }
    }

    if (!workflow) {
      const error = new MastraError({
        id: 'MASTRA_GET_WORKFLOW_BY_ID_NOT_FOUND',
        domain: ErrorDomain.MASTRA,
        category: ErrorCategory.USER,
        text: `Workflow with id ${String(id)} not found`,
        details: {
          status: 404,
          workflowId: String(id),
          workflows: Object.keys(this.#workflows ?? {}).join(', '),
        },
      });
      this.#logger?.trackException(error);
      throw error;
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

  public getScorers() {
    return this.#scorers;
  }

  public getScorer<TScorerKey extends keyof TScorers>(key: TScorerKey): TScorers[TScorerKey] {
    const scorer = this.#scorers?.[key];
    if (!scorer) {
      const error = new MastraError({
        id: 'MASTRA_GET_SCORER_NOT_FOUND',
        domain: ErrorDomain.MASTRA,
        category: ErrorCategory.USER,
        text: `Scorer with ${String(key)} not found`,
      });
      this.#logger?.trackException(error);
      throw error;
    }
    return scorer;
  }

  public getScorerByName(name: string): MastraScorer<any, any, any, any> {
    for (const [_key, value] of Object.entries(this.#scorers ?? {})) {
      if (value.name === name) {
        return value;
      }
    }

    const error = new MastraError({
      id: 'MASTRA_GET_SCORER_BY_NAME_NOT_FOUND',
      domain: ErrorDomain.MASTRA,
      category: ErrorCategory.USER,
      text: `Scorer with name ${String(name)} not found`,
    });
    this.#logger?.trackException(error);
    throw error;
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

    // Set logger for AI tracing instances
    const allTracingInstances = getAllAITracing();
    allTracingInstances.forEach(instance => {
      instance.__setLogger(this.#logger);
    });
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
      const error = new MastraError({
        id: 'MASTRA_SET_SERVER_MIDDLEWARE_INVALID_TYPE',
        domain: ErrorDomain.MASTRA,
        category: ErrorCategory.USER,
        text: `Invalid middleware: expected a function or array, received ${typeof serverMiddleware}`,
      });
      this.#logger?.trackException(error);
      throw error;
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

  public vnext_getNetworks() {
    return Object.values(this.#vnext_networks || {});
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

  public vnext_getNetwork(networkId: string): NewAgentNetwork | undefined {
    const networks = this.vnext_getNetworks();
    return networks.find(network => network.id === networkId);
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
      const error = new MastraError({
        id: 'MASTRA_GET_LOGS_BY_RUN_ID_MISSING_TRANSPORT',
        domain: ErrorDomain.MASTRA,
        category: ErrorCategory.USER,
        text: 'Transport ID is required',
        details: {
          runId,
          transportId,
        },
      });
      this.#logger?.trackException(error);
      throw error;
    }

    if (!this.#logger?.getLogsByRunId) {
      const error = new MastraError({
        id: 'MASTRA_GET_LOGS_BY_RUN_ID_LOGGER_NOT_CONFIGURED',
        domain: ErrorDomain.MASTRA,
        category: ErrorCategory.SYSTEM,
        text: 'Logger is not configured or does not support getLogsByRunId operation',
        details: {
          runId,
          transportId,
        },
      });
      this.#logger?.trackException(error);
      throw error;
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
      const error = new MastraError({
        id: 'MASTRA_GET_LOGS_MISSING_TRANSPORT',
        domain: ErrorDomain.MASTRA,
        category: ErrorCategory.USER,
        text: 'Transport ID is required',
        details: {
          transportId,
        },
      });
      this.#logger?.trackException(error);
      throw error;
    }

    if (!this.#logger) {
      const error = new MastraError({
        id: 'MASTRA_GET_LOGS_LOGGER_NOT_CONFIGURED',
        domain: ErrorDomain.MASTRA,
        category: ErrorCategory.SYSTEM,
        text: 'Logger is not set',
        details: {
          transportId,
        },
      });
      throw error;
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

  public async addTopicListener(topic: string, listener: (event: any) => Promise<void>) {
    await this.#pubsub.subscribe(topic, listener);
  }

  public async removeTopicListener(topic: string, listener: (event: any) => Promise<void>) {
    await this.#pubsub.unsubscribe(topic, listener);
  }

  public async startEventEngine() {
    for (const topic in this.#events) {
      if (!this.#events[topic]) {
        continue;
      }

      const listeners = Array.isArray(this.#events[topic]) ? this.#events[topic] : [this.#events[topic]];
      for (const listener of listeners) {
        await this.#pubsub.subscribe(topic, listener);
      }
    }
  }

  public async stopEventEngine() {
    for (const topic in this.#events) {
      if (!this.#events[topic]) {
        continue;
      }

      const listeners = Array.isArray(this.#events[topic]) ? this.#events[topic] : [this.#events[topic]];
      for (const listener of listeners) {
        await this.#pubsub.unsubscribe(topic, listener);
      }
    }

    await this.#pubsub.flush();
  }

  /**
   * Shutdown Mastra and clean up all resources
   */
  async shutdown(): Promise<void> {
    // Shutdown AI tracing registry and all instances
    await shutdownAITracingRegistry();
    await this.stopEventEngine();

    this.#logger?.info('Mastra shutdown completed');
  }
}
