import { randomUUID } from 'node:crypto';
import type { Agent } from '../agent';
import { getAllAITracing, setupAITracing, shutdownAITracingRegistry } from '../ai-tracing';
import type { ObservabilityRegistryConfig } from '../ai-tracing';
import type { BundlerConfig } from '../bundler/types';
import { InMemoryServerCache } from '../cache';
import type { MastraServerCache } from '../cache';
import type { MastraDeployer } from '../deployer';
import { MastraError, ErrorDomain, ErrorCategory } from '../error';
import { EventEmitterPubSub } from '../events/event-emitter';
import type { PubSub } from '../events/pubsub';
import type { Event } from '../events/types';
import { AvailableHooks, registerHook } from '../hooks';
import type { MastraModelGateway } from '../llm/model/gateways';
import { LogLevel, noopLogger, ConsoleLogger } from '../logger';
import type { IMastraLogger } from '../logger';
import type { MCPServerBase } from '../mcp';
import type { MastraMemory } from '../memory/memory';
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

/**
 * Configuration interface for initializing a Mastra instance.
 *
 * The Config interface defines all the optional components that can be registered
 * with a Mastra instance, including agents, workflows, storage, logging, and more.
 *
 * @template TAgents - Record of agent instances keyed by their names
 * @template TLegacyWorkflows - Record of legacy workflow instances
 * @template TWorkflows - Record of workflow instances
 * @template TVectors - Record of vector store instances
 * @template TTTS - Record of text-to-speech instances
 * @template TLogger - Logger implementation type
 * @template TVNextNetworks - Record of agent network instances
 * @template TMCPServers - Record of MCP server instances
 * @template TScorers - Record of scorer instances
 *
 * @example
 * ```typescript
 * const mastra = new Mastra({
 *   agents: {
 *     weatherAgent: new Agent({
 *       name: 'weather-agent',
 *       instructions: 'You help with weather information',
 *       model: 'openai/gpt-5'
 *     })
 *   },
 *   storage: new LibSQLStore({ url: ':memory:' }),
 *   logger: new PinoLogger({ name: 'MyApp' })
 * });
 * ```
 */
export interface Config<
  TAgents extends Record<string, Agent<any>> = Record<string, Agent<any>>,
  TLegacyWorkflows extends Record<string, LegacyWorkflow> = Record<string, LegacyWorkflow>,
  TWorkflows extends Record<string, Workflow<any, any, any, any, any, any>> = Record<
    string,
    Workflow<any, any, any, any, any, any>
  >,
  TVectors extends Record<string, MastraVector<any>> = Record<string, MastraVector<any>>,
  TTTS extends Record<string, MastraTTS> = Record<string, MastraTTS>,
  TLogger extends IMastraLogger = IMastraLogger,
  TMCPServers extends Record<string, MCPServerBase> = Record<string, MCPServerBase>,
  TScorers extends Record<string, MastraScorer<any, any, any, any>> = Record<string, MastraScorer<any, any, any, any>>,
> {
  /**
   * Agents are autonomous systems that can make decisions and take actions.
   */
  agents?: TAgents;

  /**
   * Storage provider for persisting data, conversation history, and workflow state.
   * Required for agent memory and workflow persistence.
   */
  storage?: MastraStorage;

  /**
   * Vector stores for semantic search and retrieval-augmented generation (RAG).
   * Used for storing and querying embeddings.
   */
  vectors?: TVectors;

  /**
   * Logger implementation for application logging and debugging.
   * Set to `false` to disable logging entirely.
   * @default `INFO` level in development, `WARN` in production.
   */
  logger?: TLogger | false;

  /**
   * Legacy workflow definitions for backward compatibility.
   * @deprecated Use `workflows` instead.
   */
  legacy_workflows?: TLegacyWorkflows;

  /**
   * Workflows provide type-safe, composable task execution with built-in error handling.
   */
  workflows?: TWorkflows;

  /**
   * Text-to-speech providers for voice synthesis capabilities.
   */
  tts?: TTTS;

  /**
   * OpenTelemetry configuration for distributed tracing and observability.
   *
   * @deprecated Use {@link observability} instead.
   */
  telemetry?: OtelConfig;

  /**
   * AI-specific observability configuration for tracking model interactions.
   */
  observability?: ObservabilityRegistryConfig;

  /**
   * Custom ID generator function for creating unique identifiers.
   * @default `crypto.randomUUID()`
   */
  idGenerator?: MastraIdGenerator;

  /**
   * Deployment provider for publishing applications to cloud platforms.
   */
  deployer?: MastraDeployer;

  /**
   * Server configuration for HTTP endpoints and middleware.
   */
  server?: ServerConfig;

  /**
   * MCP servers provide tools and resources that agents can use.
   */
  mcpServers?: TMCPServers;

  /**
   * Bundler configuration for packaging and deployment.
   */
  bundler?: BundlerConfig;

  /**
   * Pub/sub system for event-driven communication between components.
   * @default EventEmitterPubSub
   */
  pubsub?: PubSub;

  /**
   * Scorers help assess the quality of agent responses and workflow outputs.
   */
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

  /**
   * Custom model router gateways for accessing LLM providers.
   * Gateways handle provider-specific authentication, URL construction, and model resolution.
   */
  gateways?: Record<string, MastraModelGateway>;

  /**
   * Event handlers for custom application events.
   * Maps event topics to handler functions for event-driven architectures.
   */
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
/**
 * The central orchestrator for Mastra applications, managing agents, workflows, storage, logging, telemetry, and more.
 *
 * The `Mastra` class serves as the main entry point and registry for all components in a Mastra application.
 * It coordinates the interaction between agents, workflows, storage systems, and other services.

 * @template TAgents - Record of agent instances keyed by their names
 * @template TLegacyWorkflows - Record of legacy workflow instances for backward compatibility
 * @template TWorkflows - Record of modern workflow instances
 * @template TVectors - Record of vector store instances for semantic search and RAG
 * @template TTTS - Record of text-to-speech provider instances
 * @template TLogger - Logger implementation type for application logging
 * @template TVNextNetworks - Record of next-generation agent network instances
 * @template TMCPServers - Record of Model Context Protocol server instances
 * @template TScorers - Record of evaluation scorer instances for measuring AI performance
 *
 * @example
 * ```typescript
 * const mastra = new Mastra({
 *   agents: {
 *     weatherAgent: new Agent({
 *       name: 'weather-agent',
 *       instructions: 'You provide weather information',
 *       model: 'openai/gpt-5',
 *       tools: [getWeatherTool]
 *     })
 *   },
 *   workflows: { dataWorkflow },
 *   storage: new LibSQLStore({ url: ':memory:' }),
 *   logger: new PinoLogger({ name: 'MyApp' })
 * });
 * ```
 */
export class Mastra<
  TAgents extends Record<string, Agent<any>> = Record<string, Agent<any>>,
  TLegacyWorkflows extends Record<string, LegacyWorkflow> = Record<string, LegacyWorkflow>,
  TWorkflows extends Record<string, Workflow<any, any, any, any, any, any>> = Record<
    string,
    Workflow<any, any, any, any, any, any>
  >,
  TVectors extends Record<string, MastraVector<any>> = Record<string, MastraVector<any>>,
  TTTS extends Record<string, MastraTTS> = Record<string, MastraTTS>,
  TLogger extends IMastraLogger = IMastraLogger,
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

  /**
   * @deprecated Use {@link getAITracing()} instead.
   */
  #telemetry?: Telemetry;
  #storage?: MastraStorage;
  #memory?: MastraMemory;
  #scorers?: TScorers;
  #server?: ServerConfig;
  #mcpServers?: TMCPServers;
  #bundler?: BundlerConfig;
  #idGenerator?: MastraIdGenerator;
  #pubsub: PubSub;
  #gateways?: Record<string, MastraModelGateway>;
  #events: {
    [topic: string]: ((event: Event, cb?: () => Promise<void>) => Promise<void>)[];
  } = {};
  #internalMastraWorkflows: Record<string, Workflow> = {};
  // This is only used internally for server handlers that require temporary persistence
  #serverCache: MastraServerCache;

  /**
   * @deprecated use {@link getAITracing()} instead
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

  /**
   * Gets the currently configured ID generator function.
   *
   * @example
   * ```typescript
   * const mastra = new Mastra({
   *   idGenerator: () => `custom-${Date.now()}`
   * });
   * const generator = mastra.getIdGenerator();
   * console.log(generator?.()); // "custom-1234567890"
   * ```
   */
  public getIdGenerator() {
    return this.#idGenerator;
  }

  /**
   * Generates a unique identifier using the configured generator or defaults to `crypto.randomUUID()`.
   *
   * This method is used internally by Mastra for creating unique IDs for various entities
   * like workflow runs, agent conversations, and other resources that need unique identification.
   *
   * @throws {MastraError} When the custom ID generator returns an empty string
   *
   * @example
   * ```typescript
   * const mastra = new Mastra();
   * const id = mastra.generateId();
   * console.log(id); // "550e8400-e29b-41d4-a716-446655440000"
   * ```
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
    return randomUUID();
  }

  /**
   * Sets a custom ID generator function for creating unique identifiers.
   *
   * The ID generator function will be used by `generateId()` instead of the default
   * `crypto.randomUUID()`. This is useful for creating application-specific ID formats
   * or integrating with existing ID generation systems.
   *
   * @example
   * ```typescript
   * const mastra = new Mastra();
   * mastra.setIdGenerator(() => `custom-${Date.now()}`);
   * const id = mastra.generateId();
   * console.log(id); // "custom-1234567890"
   * ```
   */
  public setIdGenerator(idGenerator: MastraIdGenerator) {
    this.#idGenerator = idGenerator;
  }

  /**
   * Creates a new Mastra instance with the provided configuration.
   *
   * The constructor initializes all the components specified in the config, sets up
   * internal systems like logging and telemetry, and registers components with each other.
   *
   * @example
   * ```typescript
   * const mastra = new Mastra({
   *   agents: {
   *     assistant: new Agent({
   *       name: 'assistant',
   *       instructions: 'You are a helpful assistant',
   *       model: 'openai/gpt-5'
   *     })
   *   },
   *   storage: new PostgresStore({
   *     connectionString: process.env.DATABASE_URL
   *   }),
   *   logger: new PinoLogger({ name: 'MyApp' })
   * });
   * ```
   */
  constructor(config?: Config<TAgents, TLegacyWorkflows, TWorkflows, TVectors, TTTS, TLogger, TMCPServers, TScorers>) {
    // Store server middleware with default path
    if (config?.serverMiddleware) {
      this.#serverMiddleware = config.serverMiddleware.map(m => ({
        handler: m.handler,
        path: m.path || '/api/*',
      }));
    }

    /*
    Server Cache
    */

    // This is only used internally for server handlers that require temporary persistence
    this.#serverCache = new InMemoryServerCache();

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

    if (config?.telemetry?.enabled !== false) {
      this.#logger?.warn(
        `Mastra telemetry is deprecated and will be removed on the Nov 4th release. Instead use AI Tracing. ` +
          `More info can be found here: https://github.com/mastra-ai/mastra/issues/8577 and here: https://mastra.ai/en/docs/observability/ai-tracing/overview`,
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

    // Initialize gateways
    this.#gateways = config?.gateways;
    if (config?.gateways) {
      this.#syncGatewayRegistry();
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
      const config = tracing.getConfig();
      const exporters = tracing.getExporters();
      exporters.forEach(exporter => {
        // Initialize exporter if it has an init method
        if ('init' in exporter && typeof exporter.init === 'function') {
          try {
            exporter.init(config);
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

  /**
   * Retrieves a registered agent by its name.
   *
   * @template TAgentName - The specific agent name type from the registered agents
   * @throws {MastraError} When the agent with the specified name is not found
   *
   * @example
   * ```typescript
   * const mastra = new Mastra({
   *   agents: {
   *     weatherAgent: new Agent({
   *       name: 'weather-agent',
   *       instructions: 'You provide weather information',
   *       model: 'openai/gpt-5'
   *     })
   *   }
   * });
   * const agent = mastra.getAgent('weatherAgent');
   * const response = await agent.generate('What is the weather?');
   * ```
   */
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

  /**
   * Retrieves a registered agent by its unique ID.
   *
   * This method searches for an agent using its internal ID property. If no agent
   * is found with the given ID, it also attempts to find an agent using the ID as
   * a name (for backward compatibility).
   *
   * @throws {MastraError} When no agent is found with the specified ID
   *
   * @example
   * ```typescript
   * const mastra = new Mastra({
   *   agents: {
   *     assistant: new Agent({
   *       name: 'assistant',
   *       instructions: 'You are a helpful assistant',
   *       model: 'openai/gpt-5'
   *     })
   *   }
   * });
   *
   * const assistant = mastra.getAgent('assistant');
   * const sameAgent = mastra.getAgentById(assistant.id);
   * ```
   */
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

  /**
   * Returns all registered agents as a record keyed by their names.
   *
   * This method provides access to the complete registry of agents, allowing you to
   * iterate over them, check what agents are available, or perform bulk operations.
   *
   * @example
   * ```typescript
   * const mastra = new Mastra({
   *   agents: {
   *     weatherAgent: new Agent({ name: 'weather', model: openai('gpt-4o') }),
   *     supportAgent: new Agent({ name: 'support', model: openai('gpt-4o') })
   *   }
   * });
   *
   * const allAgents = mastra.getAgents();
   * console.log(Object.keys(allAgents)); // ['weatherAgent', 'supportAgent']
   * ```
   */
  public getAgents() {
    return this.#agents;
  }

  /**
   * Retrieves a registered vector store by its name.
   *
   * @template TVectorName - The specific vector store name type from the registered vectors
   * @throws {MastraError} When the vector store with the specified name is not found
   *
   * @example Using a vector store for semantic search
   * ```typescript
   * import { PineconeVector } from '@mastra/pinecone';
   * import { OpenAIEmbedder } from '@mastra/embedders';
   *
   * const mastra = new Mastra({
   *   vectors: {
   *     knowledge: new PineconeVector({
   *       apiKey: process.env.PINECONE_API_KEY,
   *       indexName: 'knowledge-base',
   *       embedder: new OpenAIEmbedder({
   *         apiKey: process.env.OPENAI_API_KEY,
   *         model: 'text-embedding-3-small'
   *       })
   *     }),
   *     products: new PineconeVector({
   *       apiKey: process.env.PINECONE_API_KEY,
   *       indexName: 'product-catalog'
   *     })
   *   }
   * });
   *
   * // Get a vector store and perform semantic search
   * const knowledgeBase = mastra.getVector('knowledge');
   * const results = await knowledgeBase.query({
   *   query: 'How to reset password?',
   *   topK: 5
   * });
   *
   * console.log('Relevant documents:', results);
   * ```
   */
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

  /**
   * Returns all registered vector stores as a record keyed by their names.
   *
   * @example Listing all vector stores
   * ```typescript
   * const mastra = new Mastra({
   *   vectors: {
   *     documents: new PineconeVector({ indexName: 'docs' }),
   *     images: new PineconeVector({ indexName: 'images' }),
   *     products: new ChromaVector({ collectionName: 'products' })
   *   }
   * });
   *
   * const allVectors = mastra.getVectors();
   * console.log(Object.keys(allVectors)); // ['documents', 'images', 'products']
   *
   * // Check vector store types and configurations
   * for (const [name, vectorStore] of Object.entries(allVectors)) {
   *   console.log(`Vector store ${name}:`, vectorStore.constructor.name);
   * }
   * ```
   */
  public getVectors() {
    return this.#vectors;
  }

  /**
   * Gets the currently configured deployment provider.
   *
   * @example
   * ```typescript
   * const mastra = new Mastra({
   *   deployer: new VercelDeployer({
   *     token: process.env.VERCEL_TOKEN,
   *     projectId: process.env.VERCEL_PROJECT_ID
   *   })
   * });
   *
   * const deployer = mastra.getDeployer();
   * if (deployer) {
   *   await deployer.deploy({
   *     name: 'my-mastra-app',
   *     environment: 'production'
   *   });
   * }
   * ```
   */
  public getDeployer() {
    return this.#deployer;
  }

  /**
   * Retrieves a registered legacy workflow by its ID.
   *
   * Legacy workflows are the previous generation of workflow system in Mastra,
   * maintained for backward compatibility. For new implementations, use the
   * modern workflow system accessed via `getWorkflow()`.
   *
   * @template TWorkflowId - The specific workflow ID type from the registered legacy workflows
   * @throws {MastraError} When the legacy workflow with the specified ID is not found
   * @deprecated Use `getWorkflow()` for new implementations
   *
   * @example Getting a legacy workflow
   * ```typescript
   * const mastra = new Mastra({
   *   legacy_workflows: {
   *     oldDataFlow: legacyWorkflowInstance
   *   }
   * });
   *
   * const workflow = mastra.legacy_getWorkflow('oldDataFlow');
   * const result = await workflow.execute({ input: 'data' });
   * ```
   */
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

  /**
   * Retrieves a registered workflow by its ID.
   *
   * @template TWorkflowId - The specific workflow ID type from the registered workflows
   * @throws {MastraError} When the workflow with the specified ID is not found
   *
   * @example Getting and executing a workflow
   * ```typescript
   * import { createWorkflow, createStep } from '@mastra/core/workflows';
   * import { z } from 'zod';
   *
   * const processDataWorkflow = createWorkflow({
   *   name: 'process-data',
   *   triggerSchema: z.object({ input: z.string() })
   * })
   *   .then(validateStep)
   *   .then(transformStep)
   *   .then(saveStep)
   *   .commit();
   *
   * const mastra = new Mastra({
   *   workflows: {
   *     dataProcessor: processDataWorkflow
   *   }
   * });
   * ```
   */
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

  __registerInternalWorkflow(workflow: Workflow) {
    workflow.__registerMastra(this);
    workflow.__registerPrimitives({
      logger: this.getLogger(),
      storage: this.storage,
    });
    this.#internalMastraWorkflows[workflow.id] = workflow;
  }

  __hasInternalWorkflow(id: string): boolean {
    return Object.values(this.#internalMastraWorkflows).some(workflow => workflow.id === id);
  }

  __getInternalWorkflow(id: string): Workflow {
    const workflow = Object.values(this.#internalMastraWorkflows).find(a => a.id === id);
    if (!workflow) {
      throw new MastraError({
        id: 'MASTRA_GET_INTERNAL_WORKFLOW_BY_ID_NOT_FOUND',
        domain: ErrorDomain.MASTRA,
        category: ErrorCategory.SYSTEM,
        text: `Workflow with id ${String(id)} not found`,
        details: {
          status: 404,
          workflowId: String(id),
        },
      });
    }

    return workflow;
  }

  /**
   * Retrieves a registered workflow by its unique ID.
   *
   * This method searches for a workflow using its internal ID property. If no workflow
   * is found with the given ID, it also attempts to find a workflow using the ID as
   * a name (for backward compatibility).
   *
   * @throws {MastraError} When no workflow is found with the specified ID
   *
   * @example Finding a workflow by ID
   * ```typescript
   * const mastra = new Mastra({
   *   workflows: {
   *     dataProcessor: createWorkflow({
   *       name: 'process-data',
   *       triggerSchema: z.object({ input: z.string() })
   *     }).commit()
   *   }
   * });
   *
   * // Get the workflow's ID
   * const workflow = mastra.getWorkflow('dataProcessor');
   * const workflowId = workflow.id;
   *
   * // Later, retrieve the workflow by ID
   * const sameWorkflow = mastra.getWorkflowById(workflowId);
   * console.log(sameWorkflow.name); // "process-data"
   * ```
   */
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

  /**
   * Returns all registered legacy workflows as a record keyed by their IDs.
   *
   * Legacy workflows are the previous generation of workflow system in Mastra,
   * maintained for backward compatibility. For new implementations, use `getWorkflows()`.
   *
   * @deprecated Use `getWorkflows()` for new implementations
   *
   * @example Listing all legacy workflows
   * ```typescript
   * const mastra = new Mastra({
   *   legacy_workflows: {
   *     oldFlow1: legacyWorkflow1,
   *     oldFlow2: legacyWorkflow2
   *   }
   * });
   *
   * const allLegacyWorkflows = mastra.legacy_getWorkflows();
   * console.log(Object.keys(allLegacyWorkflows)); // ['oldFlow1', 'oldFlow2']
   *
   * // Execute all legacy workflows
   * for (const [id, workflow] of Object.entries(allLegacyWorkflows)) {
   *   console.log(`Legacy workflow ${id}:`, workflow.name);
   * }
   * ```
   */
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

  /**
   * Returns all registered scorers as a record keyed by their IDs.
   *
   * @example Listing all scorers
   * ```typescript
   * import { HelpfulnessScorer, AccuracyScorer, RelevanceScorer } from '@mastra/scorers';
   *
   * const mastra = new Mastra({
   *   scorers: {
   *     helpfulness: new HelpfulnessScorer(),
   *     accuracy: new AccuracyScorer(),
   *     relevance: new RelevanceScorer()
   *   }
   * });
   *
   * const allScorers = mastra.getScorers();
   * console.log(Object.keys(allScorers)); // ['helpfulness', 'accuracy', 'relevance']
   *
   * // Check scorer configurations
   * for (const [id, scorer] of Object.entries(allScorers)) {
   *   console.log(`Scorer ${id}:`, scorer.name, scorer.description);
   * }
   * ```
   */
  public getScorers() {
    return this.#scorers;
  }

  /**
   * Retrieves a registered scorer by its key.
   *
   * @template TScorerKey - The specific scorer key type from the registered scorers
   * @throws {MastraError} When the scorer with the specified key is not found
   *
   * @example Getting and using a scorer
   * ```typescript
   * import { HelpfulnessScorer, AccuracyScorer } from '@mastra/scorers';
   *
   * const mastra = new Mastra({
   *   scorers: {
   *     helpfulness: new HelpfulnessScorer({
   *       model: openai('gpt-4o'),
   *       criteria: 'Rate how helpful this response is'
   *     }),
   *     accuracy: new AccuracyScorer({
   *       model: 'openai/gpt-5'
   *     })
   *   }
   * });
   *
   * // Get a specific scorer
   * const helpfulnessScorer = mastra.getScorer('helpfulness');
   * const score = await helpfulnessScorer.score({
   *   input: 'How do I reset my password?',
   *   output: 'You can reset your password by clicking the forgot password link.',
   *   expected: 'Detailed password reset instructions'
   * });
   *
   * console.log('Helpfulness score:', score);
   * ```
   */
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

  /**
   * Retrieves a registered scorer by its name.
   *
   * This method searches through all registered scorers to find one with the specified name.
   * Unlike `getScorer()` which uses the registration key, this method uses the scorer's
   * internal name property.
   *
   * @throws {MastraError} When no scorer is found with the specified name
   *
   * @example Finding a scorer by name
   * ```typescript
   * import { HelpfulnessScorer } from '@mastra/scorers';
   *
   * const mastra = new Mastra({
   *   scorers: {
   *     myHelpfulnessScorer: new HelpfulnessScorer({
   *       name: 'helpfulness-evaluator',
   *       model: 'openai/gpt-5'
   *     })
   *   }
   * });
   *
   * // Find scorer by its internal name, not the registration key
   * const scorer = mastra.getScorerByName('helpfulness-evaluator');
   * const score = await scorer.score({
   *   input: 'question',
   *   output: 'answer'
   * });
   * ```
   */
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

  /**
   * Returns all registered workflows as a record keyed by their IDs.
   *
   * @example Listing all workflows
   * ```typescript
   * const mastra = new Mastra({
   *   workflows: {
   *     dataProcessor: createWorkflow({...}).commit(),
   *     emailSender: createWorkflow({...}).commit(),
   *     reportGenerator: createWorkflow({...}).commit()
   *   }
   * });
   *
   * const allWorkflows = mastra.getWorkflows();
   * console.log(Object.keys(allWorkflows)); // ['dataProcessor', 'emailSender', 'reportGenerator']
   *
   * // Execute all workflows with sample data
   * for (const [id, workflow] of Object.entries(allWorkflows)) {
   *   console.log(`Workflow ${id}:`, workflow.name);
   *   // const result = await workflow.execute(sampleData);
   * }
   * ```
   */
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

  /**
   * Sets the storage provider for the Mastra instance.
   *
   * @example
   * ```typescript
   * const mastra = new Mastra();
   *
   * // Set PostgreSQL storage
   * mastra.setStorage(new PostgresStore({
   *   connectionString: process.env.DATABASE_URL
   * }));
   *
   * // Now agents can use memory with the storage
   * const agent = new Agent({
   *   name: 'assistant',
   *   memory: new Memory({ storage: mastra.getStorage() })
   * });
   * ```
   */
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

  /**
   * Gets all registered text-to-speech (TTS) providers.
   *
   * @example
   * ```typescript
   * const mastra = new Mastra({
   *   tts: {
   *     openai: new OpenAITTS({
   *       apiKey: process.env.OPENAI_API_KEY,
   *       voice: 'alloy'
   *     })
   *   }
   * });
   *
   * const ttsProviders = mastra.getTTS();
   * const openaiTTS = ttsProviders?.openai;
   * if (openaiTTS) {
   *   const audioBuffer = await openaiTTS.synthesize('Hello, world!');
   * }
   * ```
   */
  public getTTS() {
    return this.#tts;
  }

  /**
   * Gets the currently configured logger instance.
   *
   * @example
   * ```typescript
   * const mastra = new Mastra({
   *   logger: new PinoLogger({
   *     name: 'MyApp',
   *     level: 'info'
   *   })
   * });
   *
   * const logger = mastra.getLogger();
   * logger.info('Application started');
   * logger.error('An error occurred', { error: 'details' });
   * ```
   */
  public getLogger() {
    return this.#logger;
  }

  /**
   * Gets the currently configured telemetry instance.
   *
   * @example
   * ```typescript
   * const mastra = new Mastra({
   *   telemetry: {
   *     enabled: true,
   *     serviceName: 'my-mastra-app'
   *   }
   * });
   *
   * const telemetry = mastra.getTelemetry();
   * if (telemetry) {
   *   const span = telemetry.startSpan('custom-operation');
   *   span.setAttributes({ operation: 'data-processing' });
   *   span.end();
   * }
   * ```
   *
   * @deprecated use {@link getAITracing()} instead
   */
  public getTelemetry() {
    return this.#telemetry;
  }

  /**
   * Gets the currently configured memory instance.
   *
   * @deprecated Memory should be configured directly on agents instead of on the Mastra instance.
   * Use `new Agent({ memory: new Memory() })` instead.
   *
   * @example Legacy memory usage (deprecated)
   * ```typescript
   * // This approach is deprecated
   * const mastra = new Mastra({
   *   // memory: new Memory() // This is no longer supported
   * });
   *
   * // Use this instead:
   * const agent = new Agent({
   *   name: 'assistant',
   *   memory: new Memory({
   *     storage: new LibSQLStore({ url: ':memory:' })
   *   })
   * });
   * ```
   */
  public getMemory() {
    return this.#memory;
  }

  /**
   * Gets the currently configured storage provider.
   *
   * @example
   * ```typescript
   * const mastra = new Mastra({
   *   storage: new LibSQLStore({ url: 'file:./data.db' })
   * });
   *
   * // Use the storage in agent memory
   * const agent = new Agent({
   *   name: 'assistant',
   *   memory: new Memory({
   *     storage: mastra.getStorage()
   *   })
   * });
   * ```
   */
  public getStorage() {
    return this.#storage;
  }

  public getServerMiddleware() {
    return this.#serverMiddleware;
  }

  public getServerCache() {
    return this.#serverCache;
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

  public getServer() {
    return this.#server;
  }

  public getBundlerConfig() {
    return this.#bundler;
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
   * Gets all registered Model Context Protocol (MCP) server instances.
   *
   * @example
   * ```typescript
   * const mastra = new Mastra({
   *   mcpServers: {
   *     filesystem: new FileSystemMCPServer({
   *       rootPath: '/app/data'
   *     })
   *   }
   * });
   *
   * const mcpServers = mastra.getMCPServers();
   * if (mcpServers) {
   *   const fsServer = mcpServers.filesystem;
   *   const tools = await fsServer.getTools();
   * }
   * ```
   */
  public getMCPServers(): Record<string, MCPServerBase> | undefined {
    return this.#mcpServers;
  }

  /**
   * Retrieves a specific Model Context Protocol (MCP) server instance by its logical ID.
   *
   * This method searches for an MCP server using its logical ID. If a version is specified,
   * it returns the exact version match. If no version is provided, it returns the server
   * with the most recent release date.
   *
   * @example
   * ```typescript
   * const mastra = new Mastra({
   *   mcpServers: {
   *     filesystem: new FileSystemMCPServer({
   *       id: 'fs-server',
   *       version: '1.0.0',
   *       rootPath: '/app/data'
   *     })
   *   }
   * });
   *
   * const fsServer = mastra.getMCPServer('fs-server');
   * if (fsServer) {
   *   const tools = await fsServer.getTools();
   * }
   * ```
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
   * Returns all registered gateways as a record keyed by their names.
   *
   * @example
   * ```typescript
   * const mastra = new Mastra({
   *   gateways: {
   *     netlify: new NetlifyGateway(),
   *     custom: new CustomGateway()
   *   }
   * });
   *
   * const allGateways = mastra.listGateways();
   * console.log(Object.keys(allGateways)); // ['netlify', 'custom']
   * ```
   */
  public listGateways(): Record<string, MastraModelGateway> | undefined {
    return this.#gateways;
  }

  /**
   * Sync custom gateways with the GatewayRegistry for type generation
   * @private
   */
  #syncGatewayRegistry(): void {
    try {
      // Only sync in dev mode (when MASTRA_DEV is set)
      if (process.env.MASTRA_DEV !== 'true' && process.env.MASTRA_DEV !== '1') {
        return;
      }

      // Trigger sync immediately (non-blocking, but logs progress)
      import('../llm/model/provider-registry.js')
        .then(async ({ GatewayRegistry }) => {
          const registry = GatewayRegistry.getInstance();
          const customGateways = Object.values(this.#gateways || {});
          registry.registerCustomGateways(customGateways);

          // Log that we're syncing
          const logger = this.getLogger();
          logger.info('🔄 Syncing custom gateway types...');

          // Trigger a sync to regenerate types
          await registry.syncGateways(true);

          logger.info('✅ Custom gateway types synced! Restart your TypeScript server to see autocomplete.');
        })
        .catch(err => {
          const logger = this.getLogger();
          logger.debug('Gateway registry sync skipped:', err);
        });
    } catch (err) {
      // Silent fail - this is a dev-only feature
      const logger = this.getLogger();
      logger.debug('Gateway registry sync failed:', err);
    }
  }

  /**
   * Gracefully shuts down the Mastra instance and cleans up all resources.
   *
   * This method performs a clean shutdown of all Mastra components, including:
   * - AI tracing registry and all tracing instances
   * - Event engine and pub/sub system
   * - All registered components and their resources
   *
   * It's important to call this method when your application is shutting down
   * to ensure proper cleanup and prevent resource leaks.
   *
   * @example
   * ```typescript
   * const mastra = new Mastra({
   *   agents: { myAgent },
   *   workflows: { myWorkflow }
   * });
   *
   * // Graceful shutdown on SIGINT
   * process.on('SIGINT', async () => {
   *   await mastra.shutdown();
   *   process.exit(0);
   * });
   * ```
   */
  async shutdown(): Promise<void> {
    // Shutdown AI tracing registry and all instances
    await shutdownAITracingRegistry();
    await this.stopEventEngine();

    this.#logger?.info('Mastra shutdown completed');
  }

  // This method is only used internally for server hnadlers that require temporary persistence
  public get serverCache() {
    return this.#serverCache;
  }
}
