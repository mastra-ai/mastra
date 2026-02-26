import { randomUUID } from 'node:crypto';
import type { Agent } from '../agent';
import type { BundlerConfig } from '../bundler/types';
import { InMemoryServerCache } from '../cache';
import type { MastraServerCache } from '../cache';
import { DatasetsManager } from '../datasets/manager.js';
import type { MastraDeployer } from '../deployer';
import type { IMastraEditor } from '../editor';
import { MastraError, ErrorDomain, ErrorCategory } from '../error';
import type { MastraScorer } from '../evals';
import { EventEmitterPubSub } from '../events/event-emitter';
import type { PubSub } from '../events/pubsub';
import type { Event } from '../events/types';
import { AvailableHooks, registerHook } from '../hooks';
import type { MastraModelGateway } from '../llm/model/gateways';
import { LogLevel, noopLogger, ConsoleLogger } from '../logger';
import type { IMastraLogger } from '../logger';
import type { MCPServerBase } from '../mcp';
import type { MastraMemory } from '../memory';
import type { ObservabilityEntrypoint } from '../observability';
import { NoOpObservability } from '../observability';
import type { Processor } from '../processors';
import type { MastraServerBase } from '../server/base';
import type { Middleware, ServerConfig } from '../server/types';
import type { MastraCompositeStore, WorkflowRuns } from '../storage';
import { augmentWithInit } from '../storage/storageWithInit';
import type { StorageResolvedPromptBlockType } from '../storage/types';
import type { ToolLoopAgentLike } from '../tool-loop-agent';
import { isToolLoopAgentLike, toolLoopAgentToMastraAgent } from '../tool-loop-agent';
import type { ToolAction } from '../tools';
import type { MastraTTS } from '../tts';
import type { MastraIdGenerator, IdGeneratorContext } from '../types';
import type { MastraVector } from '../vector';
import type { AnyWorkflow, Workflow } from '../workflows';
import { WorkflowEventProcessor } from '../workflows/evented/workflow-event-processor';
import type { AnyWorkspace, RegisteredWorkspace, Workspace } from '../workspace';
import { createOnScorerHook } from './hooks';

/**
 * Creates an error for when a null/undefined value is passed to an add* method.
 * This commonly occurs when config is spread ({ ...config }) and the original
 * object had getters or non-enumerable properties.
 */
function createUndefinedPrimitiveError(
  type:
    | 'agent'
    | 'tool'
    | 'processor'
    | 'vector'
    | 'scorer'
    | 'workflow'
    | 'mcp-server'
    | 'gateway'
    | 'memory'
    | 'workspace',
  value: null | undefined,
  key?: string,
): MastraError {
  const typeLabel = type === 'mcp-server' ? 'MCP server' : type;
  const errorId = `MASTRA_ADD_${type.toUpperCase().replace('-', '_')}_UNDEFINED` as Uppercase<string>;
  return new MastraError({
    id: errorId,
    domain: ErrorDomain.MASTRA,
    category: ErrorCategory.USER,
    text: `Cannot add ${typeLabel}: ${typeLabel} is ${value === null ? 'null' : 'undefined'}. This may occur if config was spread ({ ...config }) and the original object had getters or non-enumerable properties.`,
    details: { status: 400, ...(key && { key }) },
  });
}

/**
 * Configuration interface for initializing a Mastra instance.
 *
 * The Config interface defines all the optional components that can be registered
 * with a Mastra instance, including agents, workflows, storage, logging, and more.
 *
 * @template TAgents - Record of agent instances keyed by their names
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
 *       id: 'weather-agent',
 *       name: 'Weather Agent',
 *       instructions: 'You help with weather information',
 *       model: 'openai/gpt-5'
 *     })
 *   },
 *   storage: new LibSQLStore({ id: 'mastra-storage', url: ':memory:' }),
 *   logger: new PinoLogger({ name: 'MyApp' })
 * });
 * ```
 */
export interface Config<
  TAgents extends Record<string, Agent<any>> = Record<string, Agent<any>>,
  TWorkflows extends Record<string, AnyWorkflow> = Record<string, AnyWorkflow>,
  TVectors extends Record<string, MastraVector<any>> = Record<string, MastraVector<any>>,
  TTTS extends Record<string, MastraTTS> = Record<string, MastraTTS>,
  TLogger extends IMastraLogger = IMastraLogger,
  TMCPServers extends Record<string, MCPServerBase<any>> = Record<string, MCPServerBase<any>>,
  TScorers extends Record<string, MastraScorer<any, any, any, any>> = Record<string, MastraScorer<any, any, any, any>>,
  TTools extends Record<string, ToolAction<any, any, any, any, any, any>> = Record<
    string,
    ToolAction<any, any, any, any, any, any>
  >,
  TProcessors extends Record<string, Processor<any>> = Record<string, Processor<any>>,
  TMemory extends Record<string, MastraMemory> = Record<string, MastraMemory>,
> {
  /**
   * Agents are autonomous systems that can make decisions and take actions.
   * Accepts both Mastra Agent instances and AI SDK v6 ToolLoopAgent instances.
   * ToolLoopAgent instances are automatically converted to Mastra Agents.
   */
  agents?: { [K in keyof TAgents]: TAgents[K] | ToolLoopAgentLike };

  /**
   * Storage provider for persisting data, conversation history, and workflow state.
   * Required for agent memory and workflow persistence.
   */
  storage?: MastraCompositeStore;

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
   * Workflows provide type-safe, composable task execution with built-in error handling.
   */
  workflows?: TWorkflows;

  /**
   * Text-to-speech providers for voice synthesis capabilities.
   */
  tts?: TTTS;

  /**
   * Observability entrypoint for tracking model interactions and tracing.
   * Pass an instance of the Observability class from @mastra/observability.
   *
   * @example
   * ```typescript
   * import { Observability, DefaultExporter, CloudExporter, SensitiveDataFilter } from '@mastra/observability';
   *
   * new Mastra({
   *   observability: new Observability({
   *     configs: {
   *       default: {
   *         serviceName: 'mastra',
   *         exporters: [new DefaultExporter(), new CloudExporter()],
   *         spanOutputProcessors: [new SensitiveDataFilter()],
   *       },
   *     },
   *   })
   * })
   * ```
   */
  observability?: ObservabilityEntrypoint;

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
   * Tools are reusable functions that agents can use to interact with external systems.
   */
  tools?: TTools;

  /**
   * Processors transform inputs and outputs for agents and workflows.
   */
  processors?: TProcessors;

  /**
   * Memory instances that can be referenced by stored agents.
   * Keys are used to look up memory instances when resolving stored agent configurations.
   */
  memory?: TMemory;

  /**
   * Global workspace for file storage, skills, and code execution.
   * Agents inherit this workspace unless they have their own configured.
   * Skills are accessed via workspace.skills when skills is configured.
   */
  workspace?: AnyWorkspace;

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

  /**
   * Editor instance for handling agent instantiation and configuration.
   * The editor handles complex instantiation logic including memory resolution.
   */
  editor?: IMastraEditor;
}

/**
 * The central orchestrator for Mastra applications, managing agents, workflows, storage, logging, observability, and more.
 *
 * The `Mastra` class serves as the main entry point and registry for all components in a Mastra application.
 * It coordinates the interaction between agents, workflows, storage systems, and other services.

 * @template TAgents - Record of agent instances keyed by their names
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
 *       id: 'weather-agent',
 *       name: 'Weather Agent',
 *       instructions: 'You provide weather information',
 *       model: 'openai/gpt-5',
 *       tools: [getWeatherTool]
 *     })
 *   },
 *   workflows: { dataWorkflow },
 *   storage: new LibSQLStore({ id: 'mastra-storage', url: ':memory:' }),
 *   logger: new PinoLogger({ name: 'MyApp' })
 * });
 * ```
 */
export class Mastra<
  TAgents extends Record<string, Agent<any>> = Record<string, Agent<any>>,
  TWorkflows extends Record<string, AnyWorkflow> = Record<string, AnyWorkflow>,
  TVectors extends Record<string, MastraVector<any>> = Record<string, MastraVector<any>>,
  TTTS extends Record<string, MastraTTS> = Record<string, MastraTTS>,
  TLogger extends IMastraLogger = IMastraLogger,
  TMCPServers extends Record<string, MCPServerBase<any>> = Record<string, MCPServerBase<any>>,
  TScorers extends Record<string, MastraScorer<any, any, any, any>> = Record<string, MastraScorer<any, any, any, any>>,
  TTools extends Record<string, ToolAction<any, any, any, any, any, any>> = Record<
    string,
    ToolAction<any, any, any, any, any, any>
  >,
  TProcessors extends Record<string, Processor<any>> = Record<string, Processor<any>>,
  TMemory extends Record<string, MastraMemory> = Record<string, MastraMemory>,
> {
  #vectors?: TVectors;
  #agents: TAgents;
  #logger: TLogger;
  #workflows: TWorkflows;
  #observability: ObservabilityEntrypoint;
  #tts?: TTTS;
  #deployer?: MastraDeployer;
  #serverMiddleware: Array<{
    handler: (c: any, next: () => Promise<void>) => Promise<Response | void>;
    path: string;
  }> = [];

  #storage?: MastraCompositeStore;
  #scorers?: TScorers;
  #tools?: TTools;
  #processors?: TProcessors;
  #processorConfigurations: Map<string, Array<{ processor: Processor; agentId: string; type: 'input' | 'output' }>> =
    new Map();
  #memory?: TMemory;
  #workspace?: Workspace;
  #workspaces: Record<string, RegisteredWorkspace> = {};
  #server?: ServerConfig;
  #serverAdapter?: MastraServerBase;
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
  // Cache for stored agents to allow in-memory modifications (like model changes) to persist across requests
  #storedAgentsCache: Map<string, Agent> = new Map();
  // Cache for stored scorers to allow in-memory modifications to persist across requests
  #storedScorersCache: Map<string, MastraScorer<any, any, any, any>> = new Map();
  // Registry for prompt blocks (stored or code-defined)
  #promptBlocks: Record<string, StorageResolvedPromptBlockType> = {};
  // Editor instance for handling agent instantiation and configuration
  #editor?: IMastraEditor;
  #datasets?: DatasetsManager;

  get pubsub() {
    return this.#pubsub;
  }

  get datasets(): DatasetsManager {
    if (!this.#datasets) {
      this.#datasets = new DatasetsManager(this);
    }
    return this.#datasets;
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
   * console.log(generator?.()); // \"custom-1234567890\"
   * ```
   */
  public getIdGenerator() {
    return this.#idGenerator;
  }

  /**
   * Gets the currently configured editor instance.
   * The editor is responsible for handling agent instantiation and configuration.
   *
   * @example
   * ```typescript
   * const mastra = new Mastra({
   *   editor: new MastraEditor({ logger })
   * });
   * const editor = mastra.getEditor();
   * ```
   */
  public getEditor() {
    return this.#editor;
  }

  /**
   * Gets the stored agents cache
   * @internal
   */
  public getStoredAgentCache() {
    return this.#storedAgentsCache;
  }

  /**
   * Gets the stored scorers cache
   * @internal
   */
  public getStoredScorerCache() {
    return this.#storedScorersCache;
  }

  /**
   * Generates a unique identifier using the configured generator or defaults to `crypto.randomUUID()`.
   *
   * This method is used internally by Mastra for creating unique IDs for various entities
   * like workflow runs, agent conversations, and other resources that need unique identification.
   *
   * @param context - Optional context information about what type of ID is being generated
   *                  and where it's being requested from. This allows custom ID generators
   *                  to create deterministic IDs based on context.
   *
   * @throws {MastraError} When the custom ID generator returns an empty string
   *
   * @example
   * ```typescript
   * const mastra = new Mastra();
   * const id = mastra.generateId();
   * console.log(id); // "550e8400-e29b-41d4-a716-446655440000"
   *
   * // With context for deterministic IDs
   * const messageId = mastra.generateId({
   *   idType: 'message',
   *   source: 'agent',
   *   threadId: 'thread-123'
   * });
   * ```
   */
  public generateId(context?: IdGeneratorContext): string {
    if (this.#idGenerator) {
      const id = this.#idGenerator(context);
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
   * internal systems like logging and observability, and registers components with each other.
   *
   * @example
   * ```typescript
   * const mastra = new Mastra({
   *   agents: {
   *     assistant: new Agent({
   *       id: 'assistant',
   *       name: 'Assistant',
   *       instructions: 'You are a helpful assistant',
   *       model: 'openai/gpt-5'
   *     })
   *   },
   *   storage: new PostgresStore({
   *     connectionString: process.env.DATABASE_URL
   *   }),
   *   logger: new PinoLogger({ name: 'MyApp' }),
   *   observability: new Observability({
   *     configs: { default: { serviceName: 'mastra', exporters: [new DefaultExporter()] } },
   *   }),
   * });
   * ```
   */
  constructor(
    config?: Config<TAgents, TWorkflows, TVectors, TTTS, TLogger, TMCPServers, TScorers, TTools, TProcessors, TMemory>,
  ) {
    // This is only used internally for server handlers that require temporary persistence
    this.#serverCache = new InMemoryServerCache();

    // Set the editor if provided and register this Mastra instance with it
    this.#editor = config?.editor;
    if (this.#editor && typeof this.#editor.registerWithMastra === 'function') {
      this.#editor.registerWithMastra(this);
    }

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
        this.getLogger()?.error('Error processing event', e);
      }
    };
    if (this.#events.workflows) {
      this.#events.workflows.push(workflowEventCb);
    } else {
      this.#events.workflows = [workflowEventCb];
    }

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

    // Validate and assign observability instance
    if (config?.observability) {
      if (typeof config.observability.getDefaultInstance === 'function') {
        this.#observability = config.observability;
        // Set logger early
        this.#observability.setLogger({ logger: this.#logger });
      } else {
        this.#logger?.warn(
          'Observability configuration error: Expected an Observability instance, but received a config object. ' +
            'Import and instantiate: import { Observability, DefaultExporter } from "@mastra/observability"; ' +
            'then pass: observability: new Observability({ configs: { default: { serviceName: "mastra", exporters: [new DefaultExporter()] } } }). ' +
            'Observability has been disabled.',
        );
        this.#observability = new NoOpObservability();
      }
    } else {
      this.#observability = new NoOpObservability();
    }

    this.#storage = storage;

    // Initialize all primitive storage objects first, we need to do this before adding primitives to avoid circular dependencies
    this.#vectors = {} as TVectors;
    this.#mcpServers = {} as TMCPServers;
    this.#tts = {} as TTTS;
    this.#agents = {} as TAgents;
    this.#scorers = {} as TScorers;
    this.#tools = {} as TTools;
    this.#processors = {} as TProcessors;
    this.#memory = {} as TMemory;
    this.#workflows = {} as TWorkflows;
    this.#gateways = {} as Record<string, MastraModelGateway>;

    // Now add primitives - order matters for auto-registration
    // Tools and processors should be added before agents and MCP servers that might use them
    // Note: We validate each entry to handle cases where config was spread ({ ...config })
    // which can cause undefined values if the source object had getters or non-enumerable properties
    if (config?.tools) {
      Object.entries(config.tools).forEach(([key, tool]) => {
        if (tool != null) {
          this.addTool(tool, key);
        }
      });
    }

    if (config?.processors) {
      Object.entries(config.processors).forEach(([key, processor]) => {
        if (processor != null) {
          this.addProcessor(processor, key);
        }
      });
    }

    if (config?.memory) {
      Object.entries(config.memory).forEach(([key, memory]) => {
        if (memory != null) {
          this.addMemory(memory, key);
        }
      });
    }

    if (config?.vectors) {
      Object.entries(config.vectors).forEach(([key, vector]) => {
        if (vector != null) {
          this.addVector(vector, key);
        }
      });
    }

    if (config?.workspace) {
      this.#workspace = config.workspace;
      // Also register in the workspaces registry for direct lookup by ID
      this.addWorkspace(config.workspace, undefined, { source: 'mastra' });
    }

    if (config?.scorers) {
      Object.entries(config.scorers).forEach(([key, scorer]) => {
        if (scorer != null) {
          this.addScorer(scorer, key);
        }
      });
    }

    if (config?.workflows) {
      Object.entries(config.workflows).forEach(([key, workflow]) => {
        if (workflow != null) {
          this.addWorkflow(workflow, key);
        }
      });
    }

    if (config?.gateways) {
      Object.entries(config.gateways).forEach(([key, gateway]) => {
        if (gateway != null) {
          this.addGateway(gateway, key);
        }
      });
    }

    // Add MCP servers and agents last since they might reference other primitives
    if (config?.mcpServers) {
      Object.entries(config.mcpServers).forEach(([key, server]) => {
        if (server != null) {
          this.addMCPServer(server, key);
        }
      });
    }

    if (config?.agents) {
      Object.entries(config.agents).forEach(([key, agent]) => {
        if (agent != null) {
          this.addAgent(agent, key);
        }
      });
    }

    if (config?.tts) {
      Object.entries(config.tts).forEach(([key, tts]) => {
        if (tts != null) {
          (this.#tts as Record<string, MastraTTS>)[key] = tts;
        }
      });
    }

    if (config?.server) {
      this.#server = config.server;
    }

    registerHook(AvailableHooks.ON_SCORER_RUN, createOnScorerHook(this));

    /*
      Initialize observability with Mastra context (after storage configured)
    */
    this.#observability.setMastraContext({ mastra: this });

    this.setLogger({ logger });
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
   *       id: 'weather-agent',
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
   * a name.
   *
   * @throws {MastraError} When no agent is found with the specified ID
   *
   * @example
   * ```typescript
   * const mastra = new Mastra({
   *   agents: {
   *     assistant: new Agent({
   *       id: 'assistant',
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
  public getAgentById<TAgentName extends keyof TAgents>(id: TAgents[TAgentName]['id']): TAgents[TAgentName] {
    let agent = Object.values(this.#agents).find(a => a.id === id);

    if (!agent) {
      try {
        agent = this.getAgent(id);
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

    return agent as TAgents[TAgentName];
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
   *     weatherAgent: new Agent({ id: 'weather-agent', name: 'weather', model: 'openai/gpt-4o' }),
   *     supportAgent: new Agent({ id: 'support-agent', name: 'support', model: 'openai/gpt-4o' })
   *   }
   * });
   *
   * const allAgents = mastra.listAgents();
   * console.log(Object.keys(allAgents)); // ['weatherAgent', 'supportAgent']
   * ```
   */
  public listAgents() {
    return this.#agents;
  }

  /**
   * Adds a new agent to the Mastra instance.
   *
   * This method allows dynamic registration of agents after the Mastra instance
   * has been created. The agent will be initialized with the current logger.
   *
   * @throws {MastraError} When an agent with the same key already exists
   *
   * @example
   * ```typescript
   * const mastra = new Mastra();
   * const newAgent = new Agent({
   *   id: 'chat-agent',
   *   name: 'Chat Assistant',
   *   model: 'openai/gpt-4o'
   * });
   * mastra.addAgent(newAgent); // Uses agent.id as key
   * // or
   * mastra.addAgent(newAgent, 'customKey'); // Uses custom key
   * ```
   */
  public addAgent<A extends Agent | ToolLoopAgentLike>(
    agent: A,
    key?: string,
    options?: { source?: 'code' | 'stored' },
  ): void {
    if (!agent) {
      throw createUndefinedPrimitiveError('agent', agent, key);
    }
    let mastraAgent: Agent<any, any, any>;
    if (isToolLoopAgentLike(agent)) {
      // Pass the config key as the name if the ToolLoopAgent doesn't have an id
      mastraAgent = toolLoopAgentToMastraAgent(agent, { fallbackName: key });
    } else {
      mastraAgent = agent;
    }
    const agentKey = key || mastraAgent.id;
    const agents = this.#agents as Record<string, Agent<any>>;
    if (agents[agentKey]) {
      const logger = this.getLogger();
      logger.debug(`Agent with key ${agentKey} already exists. Skipping addition.`);
      return;
    }

    // Initialize the agent
    mastraAgent.__setLogger(this.#logger);
    mastraAgent.__registerMastra(this);
    mastraAgent.__registerPrimitives({
      logger: this.getLogger(),
      storage: this.getStorage(),
      agents: agents,
      tts: this.#tts,
      vectors: this.#vectors,
    });

    // Set the source if provided
    if (options?.source) {
      mastraAgent.source = options.source;
    }

    agents[agentKey] = mastraAgent;

    // Register configured processor workflows from the agent
    // Use .then() to handle async resolution without blocking the constructor
    // This excludes memory-derived processors to avoid triggering memory factory functions
    mastraAgent
      .getConfiguredProcessorWorkflows()
      .then(processorWorkflows => {
        for (const workflow of processorWorkflows) {
          this.addWorkflow(workflow, workflow.id);
        }
      })
      .catch(err => {
        this.#logger?.debug(`Failed to register processor workflows for agent ${agentKey}:`, err);
      });

    // Register agent workspace in the workspaces registry for direct lookup.
    // Dynamic workspace functions may return undefined without request context — that's fine,
    // the if (workspace) guard below will skip registration and they'll register lazily later.
    if (mastraAgent.hasOwnWorkspace?.()) {
      Promise.resolve(mastraAgent.getWorkspace?.())
        .then(workspace => {
          if (workspace) {
            this.addWorkspace(workspace, undefined, {
              source: 'agent',
              agentId: mastraAgent.id ?? agentKey,
              agentName: mastraAgent.name,
            });
          }
        })
        .catch(err => {
          this.#logger?.debug(`Failed to register workspace for agent ${agentKey}:`, err);
        });
    }

    // Register scorers from the agent to the Mastra instance
    // This makes agent-level scorers discoverable via mastra.getScorer()/getScorerById()
    mastraAgent
      .listScorers()
      .then(scorers => {
        for (const [, entry] of Object.entries(scorers || {})) {
          this.addScorer(entry.scorer);
        }
      })
      .catch(err => {
        this.#logger?.debug(`Failed to register scorers from agent ${agentKey}:`, err);
      });
  }

  /**
   * Removes an agent from the Mastra instance by its key or ID.
   * Used when stored agents are updated/deleted to allow fresh data to be loaded.
   *
   * @param keyOrId - The agent key or ID to remove
   * @returns true if an agent was removed, false if no agent was found
   *
   * @example
   * ```typescript
   * // Remove by key
   * mastra.removeAgent('myAgent');
   *
   * // Remove by ID
   * mastra.removeAgent('agent-123');
   * ```
   */
  public removeAgent(keyOrId: string): boolean {
    const agents = this.#agents as Record<string, Agent<any>>;

    // Try direct key lookup first
    if (agents[keyOrId]) {
      const agentId = agents[keyOrId]?.id;
      delete agents[keyOrId];
      // Clear from stored agents cache to prevent stale data
      if (agentId) {
        this.#storedAgentsCache.delete(agentId);
      }
      return true;
    }

    // Try finding by ID
    const key = Object.keys(agents).find(k => agents[k]?.id === keyOrId);
    if (key) {
      const agentId = agents[key]?.id;
      delete agents[key];
      // Clear from stored agents cache to prevent stale data
      if (agentId) {
        this.#storedAgentsCache.delete(agentId);
      }
      return true;
    }

    return false;
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
   * Retrieves a specific vector store instance by its ID.
   *
   * This method searches for a vector store by its internal ID property.
   * If not found by ID, it falls back to searching by registration key.
   *
   * @throws {MastraError} When the specified vector store is not found
   *
   * @example
   * ```typescript
   * const mastra = new Mastra({
   *   vectors: {
   *     embeddings: chromaVector
   *   }
   * });
   *
   * const vectorStore = mastra.getVectorById('chroma-123');
   * ```
   */
  public getVectorById<TVectorName extends keyof TVectors>(id: TVectors[TVectorName]['id']): TVectors[TVectorName] {
    const allVectors = this.#vectors ?? ({} as Record<string, MastraVector>);

    // First try to find by internal ID
    for (const vector of Object.values(allVectors)) {
      if (vector.id === id) {
        return vector as TVectors[TVectorName];
      }
    }

    // Fallback to searching by registration key
    const vectorByKey = allVectors[id];
    if (vectorByKey) {
      return vectorByKey as TVectors[TVectorName];
    }

    const error = new MastraError({
      id: 'MASTRA_GET_VECTOR_BY_ID_NOT_FOUND',
      domain: ErrorDomain.MASTRA,
      category: ErrorCategory.USER,
      text: `Vector store with id ${id} not found`,
      details: {
        status: 404,
        vectorId: String(id),
        vectors: Object.keys(allVectors).join(', '),
      },
    });
    this.#logger?.trackException(error);
    throw error;
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
  public listVectors(): TVectors | undefined {
    return this.#vectors;
  }

  /**
   * Adds a new vector store to the Mastra instance.
   *
   * This method allows dynamic registration of vector stores after the Mastra instance
   * has been created. The vector store will be initialized with the current logger.
   *
   * @throws {MastraError} When a vector store with the same key already exists
   *
   * @example
   * ```typescript
   * const mastra = new Mastra();
   * const newVector = new ChromaVector({ id: 'chroma-embeddings' });
   * mastra.addVector(newVector); // Uses vector.id as key
   * // or
   * mastra.addVector(newVector, 'customKey'); // Uses custom key
   * ```
   */
  public addVector<V extends MastraVector>(vector: V, key?: string): void {
    if (!vector) {
      throw createUndefinedPrimitiveError('vector', vector, key);
    }
    const vectorKey = key || vector.id;
    const vectors = this.#vectors as Record<string, MastraVector>;
    if (vectors[vectorKey]) {
      const logger = this.getLogger();
      logger.debug(`Vector with key ${vectorKey} already exists. Skipping addition.`);
      return;
    }

    // Initialize the vector with the logger
    vector.__setLogger(this.#logger || this.getLogger());
    vectors[vectorKey] = vector;
  }

  /**
   * @deprecated Use listVectors() instead
   */
  public getVectors(): TVectors | undefined {
    console.warn('getVectors() is deprecated. Use listVectors() instead.');
    return this.listVectors();
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
   * Gets the global workspace instance.
   * Workspace provides file storage, skills, and code execution capabilities.
   * Agents inherit this workspace unless they have their own configured.
   *
   * @example
   * ```typescript
   * const workspace = mastra.getWorkspace();
   * if (workspace?.skills) {
   *   const skills = await workspace.skills.list();
   * }
   * ```
   */
  public getWorkspace(): Workspace | undefined {
    return this.#workspace;
  }

  /**
   * Retrieves a registered workspace by its ID.
   *
   * @throws {MastraError} When the workspace with the specified ID is not found
   *
   * @example
   * ```typescript
   * const workspace = mastra.getWorkspaceById('workspace-123');
   * const files = await workspace.filesystem.readdir('/');
   * ```
   */
  public getWorkspaceById(id: string): Workspace {
    const entry = this.#workspaces[id];
    if (!entry) {
      const error = new MastraError({
        id: 'MASTRA_GET_WORKSPACE_BY_ID_NOT_FOUND',
        domain: ErrorDomain.MASTRA,
        category: ErrorCategory.USER,
        text: `Workspace with id ${id} not found`,
        details: {
          status: 404,
          workspaceId: id,
          availableIds: Object.keys(this.#workspaces).join(', '),
        },
      });
      this.#logger?.trackException(error);
      throw error;
    }
    return entry.workspace;
  }

  /**
   * Returns all registered workspaces as a record keyed by their IDs.
   *
   * @example
   * ```typescript
   * const workspaces = mastra.listWorkspaces();
   * for (const [id, entry] of Object.entries(workspaces)) {
   *   console.log(`Workspace ${id}: ${entry.workspace.name} (source: ${entry.source})`);
   * }
   * ```
   */
  public listWorkspaces(): Record<string, RegisteredWorkspace> {
    return { ...this.#workspaces };
  }

  /**
   * Adds a new workspace to the Mastra instance.
   *
   * This method allows dynamic registration of workspaces after the Mastra instance
   * has been created. Workspaces are keyed by their ID.
   *
   * @example
   * ```typescript
   * const workspace = new Workspace({
   *   id: 'project-workspace',
   *   name: 'Project Workspace',
   *   filesystem: new LocalFilesystem({ rootPath: './workspace' })
   * });
   * mastra.addWorkspace(workspace);
   * ```
   */
  public addWorkspace(
    workspace: AnyWorkspace,
    key?: string,
    metadata?: { source?: 'mastra' | 'agent'; agentId?: string; agentName?: string },
  ): void {
    if (!workspace) {
      throw createUndefinedPrimitiveError('workspace', workspace, key);
    }
    const source = metadata?.source ?? (metadata?.agentId || metadata?.agentName ? 'agent' : 'mastra');
    if (source === 'agent' && (!metadata?.agentId || !metadata?.agentName)) {
      throw new MastraError({
        id: 'MASTRA_ADD_WORKSPACE_MISSING_AGENT_METADATA',
        domain: ErrorDomain.MASTRA,
        category: ErrorCategory.USER,
        text: 'Agent workspaces must include agentId and agentName.',
        details: { status: 400, workspaceId: key || workspace.id },
      });
    }
    const workspaceKey = key || workspace.id;
    if (this.#workspaces[workspaceKey]) {
      const logger = this.getLogger();
      logger.debug(`Workspace with key ${workspaceKey} already exists. Skipping addition.`);
      return;
    }

    this.#workspaces[workspaceKey] = {
      workspace,
      source,
      ...(metadata?.agentId ? { agentId: metadata.agentId } : {}),
      ...(metadata?.agentName ? { agentName: metadata.agentName } : {}),
    };
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
   * a name.
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
  public getWorkflowById<TWorkflowName extends keyof TWorkflows>(
    id: TWorkflows[TWorkflowName]['id'],
  ): TWorkflows[TWorkflowName] {
    let workflow = Object.values(this.#workflows).find(a => a.id === id);

    if (!workflow) {
      try {
        workflow = this.getWorkflow(id);
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

    return workflow as TWorkflows[TWorkflowName];
  }

  public async listActiveWorkflowRuns(): Promise<WorkflowRuns> {
    const storage = this.#storage;
    if (!storage) {
      this.#logger.debug('Cannot get active workflow runs. Mastra storage is not initialized');
      return { runs: [], total: 0 };
    }

    // Get all workflows with default engine type
    const defaultEngineWorkflows = Object.values(this.#workflows).filter(workflow => workflow.engineType === 'default');

    // Collect all active runs for workflows with default engine type
    const allRuns: WorkflowRuns['runs'] = [];
    let allTotal = 0;

    for (const workflow of defaultEngineWorkflows) {
      const runningRuns = await workflow.listWorkflowRuns({ status: 'running' });
      const waitingRuns = await workflow.listWorkflowRuns({ status: 'waiting' });

      allRuns.push(...runningRuns.runs, ...waitingRuns.runs);
      allTotal += runningRuns.total + waitingRuns.total;
    }

    return {
      runs: allRuns,
      total: allTotal,
    };
  }

  public async restartAllActiveWorkflowRuns(): Promise<void> {
    const activeRuns = await this.listActiveWorkflowRuns();
    if (activeRuns.runs.length > 0) {
      this.#logger.debug(
        `Restarting ${activeRuns.runs.length} active workflow run${activeRuns.runs.length > 1 ? 's' : ''}`,
      );
    }
    for (const runSnapshot of activeRuns.runs) {
      const workflow = this.getWorkflowById(runSnapshot.workflowName);
      try {
        const run = await workflow.createRun({ runId: runSnapshot.runId });
        await run.restart();
        this.#logger.debug(`Restarted ${runSnapshot.workflowName} workflow run ${runSnapshot.runId}`);
      } catch (error) {
        this.#logger.error(`Failed to restart ${runSnapshot.workflowName} workflow run ${runSnapshot.runId}: ${error}`);
      }
    }
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
   * const allScorers = mastra.listScorers();
   * console.log(Object.keys(allScorers)); // ['helpfulness', 'accuracy', 'relevance']
   *
   * // Check scorer configurations
   * for (const [id, scorer] of Object.entries(allScorers)) {
   *   console.log(`Scorer ${id}:`, scorer.id, scorer.name, scorer.description);
   * }
   * ```
   */
  public listScorers() {
    return this.#scorers;
  }

  /**
   * Adds a new scorer to the Mastra instance.
   *
   * This method allows dynamic registration of scorers after the Mastra instance
   * has been created.
   *
   * @throws {MastraError} When a scorer with the same key already exists
   *
   * @example
   * ```typescript
   * const mastra = new Mastra();
   * const newScorer = new MastraScorer({
   *   id: 'quality-scorer',
   *   name: 'Quality Scorer'
   * });
   * mastra.addScorer(newScorer); // Uses scorer.id as key
   * // or
   * mastra.addScorer(newScorer, 'customKey'); // Uses custom key
   * ```
   */
  public addScorer<S extends MastraScorer<any, any, any, any>>(
    scorer: S,
    key?: string,
    options?: { source?: 'code' | 'stored' },
  ): void {
    if (!scorer) {
      throw createUndefinedPrimitiveError('scorer', scorer, key);
    }
    const scorerKey = key || scorer.id;
    const scorers = this.#scorers as Record<string, MastraScorer<any, any, any, any>>;
    if (scorers[scorerKey]) {
      const logger = this.getLogger();
      logger.debug(`Scorer with key ${scorerKey} already exists. Skipping addition.`);
      return;
    }

    // Register Mastra instance with scorer to enable custom gateway access
    scorer.__registerMastra(this);

    // Set the source if provided
    if (options?.source) {
      scorer.source = options.source;
    }

    scorers[scorerKey] = scorer;
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
   *       model: 'openai/gpt-4o',
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
   * const scorer = mastra.getScorerById('helpfulness-evaluator');
   * const score = await scorer.score({
   *   input: 'question',
   *   output: 'answer'
   * });
   * ```
   */
  public getScorerById<TScorerName extends keyof TScorers>(id: TScorers[TScorerName]['id']): TScorers[TScorerName] {
    for (const [_key, value] of Object.entries(this.#scorers ?? {})) {
      if (value.id === id || value?.name === id) {
        return value as TScorers[TScorerName];
      }
    }

    const error = new MastraError({
      id: 'MASTRA_GET_SCORER_BY_ID_NOT_FOUND',
      domain: ErrorDomain.MASTRA,
      category: ErrorCategory.USER,
      text: `Scorer with id ${String(id)} not found`,
    });
    this.#logger?.trackException(error);
    throw error;
  }

  /**
   * Removes a scorer from the Mastra instance by its key or ID.
   *
   * @param keyOrId - The scorer key or ID to remove
   * @returns true if a scorer was removed, false if no scorer was found
   */
  public removeScorer(keyOrId: string): boolean {
    const scorers = this.#scorers as Record<string, MastraScorer<any, any, any, any>> | undefined;
    if (!scorers) return false;

    // Try direct key lookup first
    if (scorers[keyOrId]) {
      const scorerId = scorers[keyOrId]?.id;
      delete scorers[keyOrId];
      // Clear from stored scorers cache to prevent stale data
      if (scorerId) {
        this.#storedScorersCache.delete(scorerId);
      }
      return true;
    }

    // Try finding by ID or name
    const key = Object.keys(scorers).find(k => scorers[k]?.id === keyOrId || scorers[k]?.name === keyOrId);
    if (key) {
      const scorerId = scorers[key]?.id;
      delete scorers[key];
      // Clear from stored scorers cache to prevent stale data
      if (scorerId) {
        this.#storedScorersCache.delete(scorerId);
      }
      return true;
    }

    return false;
  }

  // =========================================================================
  // Prompt Blocks
  // =========================================================================

  /**
   * Returns all registered prompt blocks.
   */
  public listPromptBlocks(): Record<string, StorageResolvedPromptBlockType> {
    return this.#promptBlocks;
  }

  /**
   * Registers a prompt block in the Mastra instance's runtime registry.
   *
   * @param promptBlock - The resolved prompt block to register
   * @param key - Optional registration key (defaults to promptBlock.id)
   */
  public addPromptBlock(promptBlock: StorageResolvedPromptBlockType, key?: string): void {
    const blockKey = key || promptBlock.id;
    if (this.#promptBlocks[blockKey]) {
      const logger = this.getLogger();
      logger.debug(`Prompt block with key ${blockKey} already exists. Skipping addition.`);
      return;
    }
    this.#promptBlocks[blockKey] = promptBlock;
  }

  /**
   * Retrieves a registered prompt block by its key.
   *
   * @throws {MastraError} When the prompt block with the specified key is not found
   */
  public getPromptBlock(key: string): StorageResolvedPromptBlockType {
    const block = this.#promptBlocks[key];
    if (!block) {
      throw new MastraError({
        id: 'MASTRA_GET_PROMPT_BLOCK_NOT_FOUND',
        domain: ErrorDomain.MASTRA,
        category: ErrorCategory.USER,
        text: `Prompt block with key ${key} not found`,
      });
    }
    return block;
  }

  /**
   * Retrieves a registered prompt block by its ID.
   *
   * @throws {MastraError} When no prompt block is found with the specified ID
   */
  public getPromptBlockById(id: string): StorageResolvedPromptBlockType {
    for (const [, block] of Object.entries(this.#promptBlocks)) {
      if (block.id === id) {
        return block;
      }
    }

    throw new MastraError({
      id: 'MASTRA_GET_PROMPT_BLOCK_BY_ID_NOT_FOUND',
      domain: ErrorDomain.MASTRA,
      category: ErrorCategory.USER,
      text: `Prompt block with id ${id} not found`,
    });
  }

  /**
   * Removes a prompt block from the Mastra instance by its key or ID.
   *
   * @param keyOrId - The prompt block key or ID to remove
   * @returns true if a prompt block was removed, false if not found
   */
  public removePromptBlock(keyOrId: string): boolean {
    if (this.#promptBlocks[keyOrId]) {
      delete this.#promptBlocks[keyOrId];
      return true;
    }

    const key = Object.keys(this.#promptBlocks).find(k => this.#promptBlocks[k]?.id === keyOrId);
    if (key) {
      delete this.#promptBlocks[key];
      return true;
    }

    return false;
  }

  /**
   * Retrieves a specific tool by registration key.
   *
   * @throws {MastraError} When the specified tool is not found
   *
   * @example
   * ```typescript
   * const mastra = new Mastra({
   *   tools: {
   *     calculator: calculatorTool,
   *     weather: weatherTool
   *   }
   * });
   *
   * const tool = mastra.getTool('calculator');
   * ```
   */
  public getTool<TToolName extends keyof TTools>(name: TToolName): TTools[TToolName] {
    if (!this.#tools || !this.#tools[name]) {
      const error = new MastraError({
        id: 'MASTRA_GET_TOOL_BY_NAME_NOT_FOUND',
        domain: ErrorDomain.MASTRA,
        category: ErrorCategory.USER,
        text: `Tool with name ${String(name)} not found`,
        details: {
          status: 404,
          toolName: String(name),
          tools: Object.keys(this.#tools ?? {}).join(', '),
        },
      });
      this.#logger?.trackException(error);
      throw error;
    }
    return this.#tools[name];
  }

  /**
   * Retrieves a specific tool by its ID.
   *
   * @throws {MastraError} When the specified tool is not found
   *
   * @example
   * ```typescript
   * const mastra = new Mastra({
   *   tools: {
   *     calculator: calculatorTool
   *   }
   * });
   *
   * const tool = mastra.getToolById('calculator-tool-id');
   * ```
   */
  public getToolById<TToolName extends keyof TTools>(id: TTools[TToolName]['id']): TTools[TToolName] {
    const allTools = this.#tools;

    if (!allTools) {
      throw new MastraError({
        id: 'MASTRA_GET_TOOL_BY_ID_NOT_FOUND',
        domain: ErrorDomain.MASTRA,
        category: ErrorCategory.USER,
        text: `Tool with id ${id} not found`,
      });
    }
    // First try to find by internal ID
    for (const tool of Object.values(allTools)) {
      if (tool.id === id) {
        return tool as TTools[TToolName];
      }
    }

    // Fallback to searching by registration key
    const toolByKey = allTools[id];
    if (toolByKey) {
      return toolByKey as TTools[TToolName];
    }

    const error = new MastraError({
      id: 'MASTRA_GET_TOOL_BY_ID_NOT_FOUND',
      domain: ErrorDomain.MASTRA,
      category: ErrorCategory.USER,
      text: `Tool with id ${id} not found`,
      details: {
        status: 404,
        toolId: String(id),
        tools: Object.keys(allTools).join(', '),
      },
    });
    this.#logger?.trackException(error);
    throw error;
  }

  /**
   * Lists all configured tools.
   *
   * @example
   * ```typescript
   * const mastra = new Mastra({
   *   tools: {
   *     calculator: calculatorTool,
   *     weather: weatherTool
   *   }
   * });
   *
   * const tools = mastra.listTools();
   * Object.entries(tools || {}).forEach(([name, tool]) => {
   *   console.log(`Tool "${name}":`, tool.id);
   * });
   * ```
   */
  public listTools(): TTools | undefined {
    return this.#tools;
  }

  /**
   * Adds a new tool to the Mastra instance.
   *
   * This method allows dynamic registration of tools after the Mastra instance
   * has been created.
   *
   * @throws {MastraError} When a tool with the same key already exists
   *
   * @example
   * ```typescript
   * const mastra = new Mastra();
   * const newTool = createTool({
   *   id: 'calculator-tool',
   *   description: 'Performs calculations'
   * });
   * mastra.addTool(newTool); // Uses tool.id as key
   * // or
   * mastra.addTool(newTool, 'customKey'); // Uses custom key
   * ```
   */
  public addTool<T extends ToolAction<any, any, any, any>>(tool: T, key?: string): void {
    if (!tool) {
      throw createUndefinedPrimitiveError('tool', tool, key);
    }
    const toolKey = key || tool.id;
    const tools = this.#tools as Record<string, ToolAction<any, any, any, any>>;
    if (tools[toolKey]) {
      const logger = this.getLogger();
      logger.debug(`Tool with key ${toolKey} already exists. Skipping addition.`);
      return;
    }

    tools[toolKey] = tool;
  }

  /**
   * Retrieves a specific processor by registration key.
   *
   * @throws {MastraError} When the specified processor is not found
   *
   * @example
   * ```typescript
   * const mastra = new Mastra({
   *   processors: {
   *     validator: validatorProcessor,
   *     transformer: transformerProcessor
   *   }
   * });
   *
   * const processor = mastra.getProcessor('validator');
   * ```
   */
  public getProcessor<TProcessorName extends keyof TProcessors>(name: TProcessorName): TProcessors[TProcessorName] {
    if (!this.#processors || !this.#processors[name]) {
      const error = new MastraError({
        id: 'MASTRA_GET_PROCESSOR_BY_NAME_NOT_FOUND',
        domain: ErrorDomain.MASTRA,
        category: ErrorCategory.USER,
        text: `Processor with name ${String(name)} not found`,
        details: {
          status: 404,
          processorName: String(name),
          processors: Object.keys(this.#processors ?? {}).join(', '),
        },
      });
      this.#logger?.trackException(error);
      throw error;
    }
    return this.#processors[name];
  }

  /**
   * Retrieves a specific processor by its ID.
   *
   * @throws {MastraError} When the specified processor is not found
   *
   * @example
   * ```typescript
   * const mastra = new Mastra({
   *   processors: {
   *     validator: validatorProcessor
   *   }
   * });
   *
   * const processor = mastra.getProcessorById('validator-processor-id');
   * ```
   */
  public getProcessorById<TProcessorName extends keyof TProcessors>(
    id: TProcessors[TProcessorName]['id'],
  ): TProcessors[TProcessorName] {
    const allProcessors = this.#processors;

    if (!allProcessors) {
      throw new MastraError({
        id: 'MASTRA_GET_PROCESSOR_BY_ID_NOT_FOUND',
        domain: ErrorDomain.MASTRA,
        category: ErrorCategory.USER,
        text: `Processor with id ${id} not found`,
      });
    }

    // First try to find by internal ID
    for (const processor of Object.values(allProcessors)) {
      if (processor.id === id) {
        return processor as TProcessors[TProcessorName];
      }
    }

    // Fallback to searching by registration key
    const processorByKey = allProcessors[id];
    if (processorByKey) {
      return processorByKey as TProcessors[TProcessorName];
    }

    const error = new MastraError({
      id: 'MASTRA_GET_PROCESSOR_BY_ID_NOT_FOUND',
      domain: ErrorDomain.MASTRA,
      category: ErrorCategory.USER,
      text: `Processor with id ${id} not found`,
      details: {
        status: 404,
        processorId: String(id),
        processors: Object.keys(allProcessors).join(', '),
      },
    });
    this.#logger?.trackException(error);
    throw error;
  }

  /**
   * Lists all configured processors.
   *
   * @example
   * ```typescript
   * const mastra = new Mastra({
   *   processors: {
   *     validator: validatorProcessor,
   *     transformer: transformerProcessor
   *   }
   * });
   *
   * const processors = mastra.listProcessors();
   * Object.entries(processors || {}).forEach(([name, processor]) => {
   *   console.log(`Processor "${name}":`, processor.id);
   * });
   * ```
   */
  public listProcessors(): TProcessors | undefined {
    return this.#processors;
  }

  /**
   * Adds a new processor to the Mastra instance.
   *
   * This method allows dynamic registration of processors after the Mastra instance
   * has been created.
   *
   * @throws {MastraError} When a processor with the same key already exists
   *
   * @example
   * ```typescript
   * const mastra = new Mastra();
   * const newProcessor = {
   *   id: 'text-processor',
   *   processInput: async (messages) => messages
   * };
   * mastra.addProcessor(newProcessor); // Uses processor.id as key
   * // or
   * mastra.addProcessor(newProcessor, 'customKey'); // Uses custom key
   * ```
   */
  public addProcessor<P extends Processor>(processor: P, key?: string): void {
    if (!processor) {
      throw createUndefinedPrimitiveError('processor', processor, key);
    }
    const processorKey = key || processor.id;
    const processors = this.#processors as Record<string, Processor>;
    if (processors[processorKey]) {
      const logger = this.getLogger();
      logger.debug(`Processor with key ${processorKey} already exists. Skipping addition.`);
      return;
    }

    // Register Mastra with the processor if it supports it
    if (typeof processor.__registerMastra === 'function') {
      processor.__registerMastra(this);
    }

    processors[processorKey] = processor;
  }

  /**
   * Registers a processor configuration with agent context.
   * This tracks which agents use which processors with what configuration.
   *
   * @param processor - The processor instance
   * @param agentId - The ID of the agent that uses this processor
   * @param type - Whether this is an input or output processor
   */
  public addProcessorConfiguration(processor: Processor, agentId: string, type: 'input' | 'output'): void {
    const processorId = processor.id;
    if (!this.#processorConfigurations.has(processorId)) {
      this.#processorConfigurations.set(processorId, []);
    }
    const configs = this.#processorConfigurations.get(processorId)!;

    // Check if this exact configuration already exists
    const exists = configs.some(c => c.agentId === agentId && c.type === type);
    if (!exists) {
      configs.push({ processor, agentId, type });
    }
  }

  /**
   * Gets all processor configurations for a specific processor ID.
   *
   * @param processorId - The ID of the processor
   * @returns Array of configurations with agent context
   */
  public getProcessorConfigurations(
    processorId: string,
  ): Array<{ processor: Processor; agentId: string; type: 'input' | 'output' }> {
    return this.#processorConfigurations.get(processorId) || [];
  }

  /**
   * Gets all processor configurations.
   *
   * @returns Map of processor IDs to their configurations
   */
  public listProcessorConfigurations(): Map<
    string,
    Array<{ processor: Processor; agentId: string; type: 'input' | 'output' }>
  > {
    return this.#processorConfigurations;
  }

  /**
   * Retrieves a registered memory instance by its registration key.
   *
   * @throws {MastraError} When the memory instance with the specified key is not found
   *
   * @example
   * ```typescript
   * const mastra = new Mastra({
   *   memory: {
   *     chat: new Memory({ storage })
   *   }
   * });
   *
   * const chatMemory = mastra.getMemory('chat');
   * ```
   */
  public getMemory<TMemoryName extends keyof TMemory>(name: TMemoryName): TMemory[TMemoryName] {
    if (!this.#memory || !this.#memory[name]) {
      const error = new MastraError({
        id: 'MASTRA_GET_MEMORY_BY_KEY_NOT_FOUND',
        domain: ErrorDomain.MASTRA,
        category: ErrorCategory.USER,
        text: `Memory with key ${String(name)} not found`,
        details: {
          status: 404,
          memoryKey: String(name),
          memory: Object.keys(this.#memory ?? {}).join(', '),
        },
      });
      this.#logger?.trackException(error);
      throw error;
    }
    return this.#memory[name];
  }

  /**
   * Retrieves a registered memory instance by its ID.
   *
   * Searches through all registered memory instances and returns the one whose ID matches.
   *
   * @throws {MastraError} When no memory instance with the specified ID is found
   *
   * @example
   * ```typescript
   * const mastra = new Mastra({
   *   memory: {
   *     chat: new Memory({ id: 'chat-memory', storage })
   *   }
   * });
   *
   * const memory = mastra.getMemoryById('chat-memory');
   * ```
   */
  public getMemoryById(id: string): MastraMemory {
    const allMemory = this.#memory;
    if (allMemory) {
      for (const [, memory] of Object.entries(allMemory)) {
        if (memory.id === id) {
          return memory;
        }
      }
    }

    const error = new MastraError({
      id: 'MASTRA_GET_MEMORY_BY_ID_NOT_FOUND',
      domain: ErrorDomain.MASTRA,
      category: ErrorCategory.USER,
      text: `Memory with id ${id} not found`,
      details: {
        status: 404,
        memoryId: id,
        availableIds: Object.values(allMemory ?? {})
          .map(m => m.id)
          .join(', '),
      },
    });
    this.#logger?.trackException(error);
    throw error;
  }

  /**
   * Returns all registered memory instances as a record keyed by their names.
   *
   * @example
   * ```typescript
   * const mastra = new Mastra({
   *   memory: {
   *     chat: new Memory({ storage }),
   *     longTerm: new Memory({ storage })
   *   }
   * });
   *
   * const allMemory = mastra.listMemory();
   * console.log(Object.keys(allMemory)); // ['chat', 'longTerm']
   * ```
   */
  public listMemory(): TMemory | undefined {
    return this.#memory;
  }

  /**
   * Adds a new memory instance to the Mastra instance.
   *
   * This method allows dynamic registration of memory instances after the Mastra instance
   * has been created.
   *
   * @example
   * ```typescript
   * const mastra = new Mastra();
   * const chatMemory = new Memory({
   *   id: 'chat-memory',
   *   storage: mastra.getStorage()
   * });
   * mastra.addMemory(chatMemory); // Uses memory.id as key
   * // or
   * mastra.addMemory(chatMemory, 'customKey'); // Uses custom key
   * ```
   */
  public addMemory<M extends MastraMemory>(memory: M, key?: string): void {
    if (!memory) {
      throw createUndefinedPrimitiveError('memory', memory, key);
    }
    const memoryKey = key || memory.id;
    const memoryRegistry = this.#memory as Record<string, MastraMemory>;
    if (memoryRegistry[memoryKey]) {
      const logger = this.getLogger();
      logger.debug(`Memory with key ${memoryKey} already exists. Skipping addition.`);
      return;
    }

    memoryRegistry[memoryKey] = memory;
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
   * const allWorkflows = mastra.listWorkflows();
   * console.log(Object.keys(allWorkflows)); // ['dataProcessor', 'emailSender', 'reportGenerator']
   *
   * // Execute all workflows with sample data
   * for (const [id, workflow] of Object.entries(allWorkflows)) {
   *   console.log(`Workflow ${id}:`, workflow.name);
   *   // const result = await workflow.execute(sampleData);
   * }
   * ```
   */
  public listWorkflows(props: { serialized?: boolean } = {}): Record<string, Workflow> {
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
   * Adds a new workflow to the Mastra instance.
   *
   * This method allows dynamic registration of workflows after the Mastra instance
   * has been created. The workflow will be initialized with Mastra and primitives.
   *
   * @throws {MastraError} When a workflow with the same key already exists
   *
   * @example
   * ```typescript
   * const mastra = new Mastra();
   * const newWorkflow = createWorkflow({
   *   id: 'data-pipeline',
   *   name: 'Data Pipeline'
   * }).commit();
   * mastra.addWorkflow(newWorkflow); // Uses workflow.id as key
   * // or
   * mastra.addWorkflow(newWorkflow, 'customKey'); // Uses custom key
   * ```
   */
  public addWorkflow(workflow: AnyWorkflow, key?: string): void {
    if (!workflow) {
      throw createUndefinedPrimitiveError('workflow', workflow, key);
    }
    const workflowKey = key || workflow.id;
    const workflows = this.#workflows as Record<string, AnyWorkflow>;
    if (workflows[workflowKey]) {
      const logger = this.getLogger();
      logger.debug(`Workflow with key ${workflowKey} already exists. Skipping addition.`);
      return;
    }

    // Initialize the workflow with Mastra and primitives
    workflow.__registerMastra(this);
    workflow.__registerPrimitives({
      logger: this.getLogger(),
      storage: this.getStorage(),
    });
    if (!workflow.committed) {
      workflow.commit();
    }
    workflows[workflowKey] = workflow;
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
   *   id: 'assistant',
   *   name: 'assistant',
   *   memory: new Memory({ storage: mastra.getStorage() })
   * });
   * ```
   */
  public setStorage(storage: MastraCompositeStore) {
    this.#storage = augmentWithInit(storage);
  }

  public setLogger({ logger }: { logger: TLogger }) {
    this.#logger = logger;

    if (this.#agents) {
      Object.keys(this.#agents).forEach(key => {
        this.#agents?.[key]?.__setLogger(this.#logger);
      });
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

    if (this.#workflows) {
      Object.keys(this.#workflows).forEach(key => {
        this.#workflows?.[key]?.__setLogger(this.#logger);
      });
    }

    if (this.#serverAdapter) {
      this.#serverAdapter.__setLogger(this.#logger);
    }

    if (this.#workspace) {
      this.#workspace.__setLogger(this.#logger);
    }

    if (this.#memory) {
      Object.keys(this.#memory).forEach(key => {
        this.#memory?.[key]?.__setLogger(this.#logger);
      });
    }

    this.#observability.setLogger({ logger: this.#logger });
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
   * Gets the currently configured storage provider.
   *
   * @example
   * ```typescript
   * const mastra = new Mastra({
   *   storage: new LibSQLStore({ id: 'mastra-storage', url: 'file:./data.db' })
   * });
   *
   * // Use the storage in agent memory
   * const agent = new Agent({
   *   id: 'assistant',
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

  get observability(): ObservabilityEntrypoint {
    return this.#observability;
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

  /**
   * Sets the server adapter for this Mastra instance.
   *
   * The server adapter provides access to the underlying server app (e.g., Hono, Express)
   * and allows users to call routes directly via `app.fetch()` instead of making HTTP requests.
   *
   * This is typically called by `createHonoServer` or similar factory functions during
   * server initialization.
   *
   * @param adapter - The server adapter instance (e.g., MastraServer from @mastra/hono or @mastra/express)
   *
   * @example
   * ```typescript
   * const app = new Hono();
   * const adapter = new MastraServer({ app, mastra });
   * mastra.setMastraServer(adapter);
   * ```
   */
  public setMastraServer(adapter: MastraServerBase): void {
    if (this.#serverAdapter) {
      this.#logger?.debug(
        'Replacing existing server adapter. Only one adapter should be registered per Mastra instance.',
      );
    }
    this.#serverAdapter = adapter;
    // Inject the logger into the adapter
    if (this.#logger) {
      adapter.__setLogger(this.#logger);
    }
  }

  /**
   * Gets the server adapter for this Mastra instance.
   *
   * @returns The server adapter, or undefined if not set
   *
   * @example
   * ```typescript
   * const adapter = mastra.getMastraServer();
   * if (adapter) {
   *   const app = adapter.getApp<Hono>();
   * }
   * ```
   */
  public getMastraServer(): MastraServerBase | undefined {
    return this.#serverAdapter;
  }

  /**
   * Gets the server app from the server adapter.
   *
   * This is a convenience method that calls `getMastraServer()?.getApp<T>()`.
   * Use this to access the underlying server framework's app instance (e.g., Hono, Express)
   * for direct operations like calling routes via `app.fetch()`.
   *
   * @template T - The expected type of the app (e.g., Hono, Express Application)
   * @returns The server app, or undefined if no adapter is set
   *
   * @example
   * ```typescript
   * // After createHonoServer() is called:
   * const app = mastra.getServerApp<Hono>();
   *
   * // Call routes directly without HTTP overhead
   * const response = await app?.fetch(new Request('http://localhost/health'));
   * const data = await response?.json();
   * ```
   */
  public getServerApp<T = unknown>(): T | undefined {
    return this.#serverAdapter?.getApp<T>();
  }

  public getBundlerConfig() {
    return this.#bundler;
  }

  public async listLogsByRunId({
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
        id: 'MASTRA_LIST_LOGS_BY_RUN_ID_MISSING_TRANSPORT',
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

    if (!this.#logger?.listLogsByRunId) {
      const error = new MastraError({
        id: 'MASTRA_GET_LOGS_BY_RUN_ID_LOGGER_NOT_CONFIGURED',
        domain: ErrorDomain.MASTRA,
        category: ErrorCategory.SYSTEM,
        text: 'Logger is not configured or does not support listLogsByRunId operation',
        details: {
          runId,
          transportId,
        },
      });
      this.#logger?.trackException(error);
      throw error;
    }

    return await this.#logger.listLogsByRunId({
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

  public async listLogs(
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

    return await this.#logger.listLogs(transportId, params);
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
   *   const tools = await fsServer.listTools();
   * }
   * ```
   */
  public listMCPServers(): Record<string, MCPServerBase> | undefined {
    return this.#mcpServers;
  }

  /**
   * Adds a new MCP server to the Mastra instance.
   *
   * This method allows dynamic registration of MCP servers after the Mastra instance
   * has been created. The server will be initialized with ID, Mastra instance, and logger.
   *
   * @throws {MastraError} When an MCP server with the same key already exists
   *
   * @example
   * ```typescript
   * const mastra = new Mastra();
   * const newServer = new FileSystemMCPServer({
   *   rootPath: '/data'
   * });
   * mastra.addMCPServer(newServer); // Uses server.id as key
   * // or
   * mastra.addMCPServer(newServer, 'customKey'); // Uses custom key
   * ```
   */
  public addMCPServer<M extends MCPServerBase>(server: M, key?: string): void {
    if (!server) {
      throw createUndefinedPrimitiveError('mcp-server', server, key);
    }
    // If a key is provided, try to set it as the ID
    // The setId method will only update if the ID wasn't explicitly set by the user
    if (key) {
      server.setId(key);
    }

    // Now resolve the ID after potentially setting it
    const resolvedId = server.id;
    if (!resolvedId) {
      const error = new MastraError({
        id: 'MASTRA_ADD_MCP_SERVER_MISSING_ID',
        domain: ErrorDomain.MASTRA,
        category: ErrorCategory.USER,
        text: 'MCP server must expose an id or be registered under one',
        details: { status: 400 },
      });
      this.#logger?.trackException(error);
      throw error;
    }

    const serverKey = key ?? resolvedId;
    const servers = this.#mcpServers as Record<string, MCPServerBase>;
    if (servers[serverKey]) {
      const logger = this.getLogger();
      logger.debug(`MCP server with key ${serverKey} already exists. Skipping addition.`);
      return;
    }

    // Initialize the server
    server.__registerMastra(this);
    server.__setLogger(this.getLogger());
    servers[serverKey] = server;
  }

  /**
   * Retrieves a specific MCP server instance by registration key.
   *
   * @throws {MastraError} When the specified MCP server is not found
   *
   * @example
   * ```typescript
   * const mastra = new Mastra({
   *   mcpServers: {
   *     filesystem: new FileSystemMCPServer({...})
   *   }
   * });
   *
   * const fsServer = mastra.getMCPServer('filesystem');
   * const tools = await fsServer.listTools();
   * ```
   */
  public getMCPServer<TMCPServerName extends keyof TMCPServers>(
    name: TMCPServerName,
  ): TMCPServers[TMCPServerName] | undefined {
    if (!this.#mcpServers || !this.#mcpServers[name]) {
      this.#logger?.debug(`MCP server with name ${String(name)} not found`);
      return undefined as TMCPServers[TMCPServerName] | undefined;
    }
    return this.#mcpServers[name];
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
   * const fsServer = mastra.getMCPServerById('fs-server');
   * if (fsServer) {
   *   const tools = await fsServer.listTools();
   * }
   * ```
   */
  public getMCPServerById<TMCPServerName extends keyof TMCPServers>(
    serverId: TMCPServers[TMCPServerName]['id'],
    version?: string,
  ): TMCPServers[TMCPServerName] | undefined {
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
      return specificVersionServer as TMCPServers[TMCPServerName] | undefined;
    } else {
      // No version specified, find the one with the most recent releaseDate
      if (matchingLogicalIdServers.length === 1) {
        return matchingLogicalIdServers[0] as TMCPServers[TMCPServerName];
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
          return latestServer as TMCPServers[TMCPServerName];
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
   * Retrieves a registered gateway by its key.
   *
   * @throws {MastraError} When the gateway with the specified key is not found
   *
   * @example
   * ```typescript
   * const mastra = new Mastra({
   *   gateways: {
   *     myGateway: new CustomGateway()
   *   }
   * });
   *
   * const gateway = mastra.getGateway('myGateway');
   * ```
   */
  public getGateway(key: string): MastraModelGateway {
    const gateway = this.#gateways?.[key];
    if (!gateway) {
      const error = new MastraError({
        id: 'MASTRA_GET_GATEWAY_BY_KEY_NOT_FOUND',
        domain: ErrorDomain.MASTRA,
        category: ErrorCategory.USER,
        text: `Gateway with key ${key} not found`,
        details: {
          status: 404,
          gatewayKey: key,
          gateways: Object.keys(this.#gateways ?? {}).join(', '),
        },
      });
      this.#logger?.trackException(error);
      throw error;
    }
    return gateway;
  }

  /**
   * Retrieves a registered gateway by its ID.
   *
   * Searches through all registered gateways and returns the one whose ID matches.
   * If a gateway doesn't have an explicit ID, its name is used as the ID.
   *
   * @throws {MastraError} When no gateway with the specified ID is found
   *
   * @example
   * ```typescript
   * class CustomGateway extends MastraModelGateway {
   *   readonly id = 'custom-gateway-v1';
   *   readonly name = 'Custom Gateway';
   *   // ...
   * }
   *
   * const mastra = new Mastra({
   *   gateways: {
   *     myGateway: new CustomGateway()
   *   }
   * });
   *
   * const gateway = mastra.getGatewayById('custom-gateway-v1');
   * ```
   */
  public getGatewayById(id: string): MastraModelGateway {
    const gateways = this.#gateways ?? {};
    for (const gateway of Object.values(gateways)) {
      if (gateway.getId() === id) {
        return gateway;
      }
    }

    const error = new MastraError({
      id: 'MASTRA_GET_GATEWAY_BY_ID_NOT_FOUND',
      domain: ErrorDomain.MASTRA,
      category: ErrorCategory.USER,
      text: `Gateway with ID ${id} not found`,
      details: {
        status: 404,
        gatewayId: id,
        availableIds: Object.values(gateways)
          .map(g => g.getId())
          .join(', '),
      },
    });
    this.#logger?.trackException(error);
    throw error;
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
   * Adds a new gateway to the Mastra instance.
   *
   * This method allows dynamic registration of gateways after the Mastra instance
   * has been created. Gateways enable access to LLM providers through custom
   * authentication and routing logic.
   *
   * If no key is provided, the gateway's ID (or name if no ID is set) will be used as the key.
   *
   * @example
   * ```typescript
   * import { MastraModelGateway } from '@mastra/core';
   *
   * class CustomGateway extends MastraModelGateway {
   *   readonly id = 'custom-gateway-v1';  // Optional, defaults to name
   *   readonly name = 'custom';
   *   readonly prefix = 'custom';
   *
   *   async fetchProviders() {
   *     return {
   *       myProvider: {
   *         name: 'My Provider',
   *         models: ['model-1', 'model-2'],
   *         apiKeyEnvVar: 'MY_API_KEY',
   *         gateway: 'custom'
   *       }
   *     };
   *   }
   *
   *   buildUrl(modelId: string) {
   *     return 'https://api.myprovider.com/v1';
   *   }
   *
   *   async getApiKey(modelId: string) {
   *     return process.env.MY_API_KEY || '';
   *   }
   *
   *   async resolveLanguageModel({ modelId, providerId, apiKey }) {
   *     const baseURL = this.buildUrl(`${providerId}/${modelId}`);
   *     return createOpenAICompatible({
   *       name: providerId,
   *       apiKey,
   *       baseURL,
   *       supportsStructuredOutputs: true,
   *     }).chatModel(modelId);
   *   }
   * }
   *
   * const mastra = new Mastra();
   * const newGateway = new CustomGateway();
   * mastra.addGateway(newGateway); // Uses gateway.getId() as key (gateway.id)
   * // or
   * mastra.addGateway(newGateway, 'customKey'); // Uses custom key
   * ```
   */
  public addGateway(gateway: MastraModelGateway, key?: string): void {
    if (!gateway) {
      throw createUndefinedPrimitiveError('gateway', gateway, key);
    }
    const gatewayKey = key || gateway.getId();
    const gateways = this.#gateways as Record<string, MastraModelGateway>;
    if (gateways[gatewayKey]) {
      const logger = this.getLogger();
      logger.debug(`Gateway with key ${gatewayKey} already exists. Skipping addition.`);
      return;
    }

    gateways[gatewayKey] = gateway;

    // Register custom gateways with the registry for type generation
    this.#syncGatewayRegistry();
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
   * - tracing registry and all tracing instances
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
    await this.stopEventEngine();
    // Shutdown observability registry, exporters, etc...
    await this.#observability.shutdown();

    this.#logger?.info('Mastra shutdown completed');
  }

  // This method is only used internally for server hnadlers that require temporary persistence
  public get serverCache() {
    return this.#serverCache;
  }
}
