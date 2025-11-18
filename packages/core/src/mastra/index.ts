import { randomUUID } from 'node:crypto';
import type { Agent } from '../agent';
import type { BundlerConfig } from '../bundler/types';
import { InMemoryServerCache } from '../cache';
import type { MastraServerCache } from '../cache';
import type { MastraDeployer } from '../deployer';
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
import type { ObservabilityEntrypoint } from '../observability';
import { NoOpObservability } from '../observability';
import type { Processor } from '../processors';
import type { Middleware, ServerConfig } from '../server/types';
import type { MastraStorage, WorkflowRuns } from '../storage';
import { augmentWithInit } from '../storage/storageWithInit';
import type { ToolAction } from '../tools';
import type { MastraTTS } from '../tts';
import type { MastraIdGenerator } from '../types';
import type { MastraVector } from '../vector';
import type { Workflow } from '../workflows';
import { WorkflowEventProcessor } from '../workflows/evented/workflow-event-processor';
import { createOnScorerHook } from './hooks';

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
  TWorkflows extends Record<string, Workflow<any, any, any, any, any, any>> = Record<
    string,
    Workflow<any, any, any, any, any, any>
  >,
  TVectors extends Record<string, MastraVector<any>> = Record<string, MastraVector<any>>,
  TTTS extends Record<string, MastraTTS> = Record<string, MastraTTS>,
  TLogger extends IMastraLogger = IMastraLogger,
  TMCPServers extends Record<string, MCPServerBase> = Record<string, MCPServerBase>,
  TScorers extends Record<string, MastraScorer<any, any, any, any>> = Record<string, MastraScorer<any, any, any, any>>,
  TTools extends Record<string, ToolAction<any, any, any, any>> = Record<string, ToolAction<any, any, any, any>>,
  TProcessors extends Record<string, Processor> = Record<string, Processor>,
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
   * import { Observability } from '@mastra/observability';
   *
   * new Mastra({
   *   observability: new Observability({
   *     default: { enabled: true }
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
  TWorkflows extends Record<string, Workflow<any, any, any, any, any, any>> = Record<
    string,
    Workflow<any, any, any, any, any, any>
  >,
  TVectors extends Record<string, MastraVector<any>> = Record<string, MastraVector<any>>,
  TTTS extends Record<string, MastraTTS> = Record<string, MastraTTS>,
  TLogger extends IMastraLogger = IMastraLogger,
  TMCPServers extends Record<string, MCPServerBase> = Record<string, MCPServerBase>,
  TScorers extends Record<string, MastraScorer<any, any, any, any>> = Record<string, MastraScorer<any, any, any, any>>,
  TTools extends Record<string, ToolAction<any, any, any, any>> = Record<string, ToolAction<any, any, any, any>>,
  TProcessors extends Record<string, Processor> = Record<string, Processor>,
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

  #storage?: MastraStorage;
  #scorers?: TScorers;
  #tools?: TTools;
  #processors?: TProcessors;
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
   *   observability: { default: { enabled: true }},
   * });
   * ```
   */
  constructor(
    config?: Config<TAgents, TWorkflows, TVectors, TTTS, TLogger, TMCPServers, TScorers, TTools, TProcessors>,
  ) {
    // This is only used internally for server handlers that require temporary persistence
    this.#serverCache = new InMemoryServerCache();

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
            'Import and instantiate: import { Observability } from "@mastra/observability"; ' +
            'then pass: observability: new Observability({ default: { enabled: true } }). ' +
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
    this.#workflows = {} as TWorkflows;
    this.#gateways = {} as Record<string, MastraModelGateway>;

    // Now add primitives - order matters for auto-registration
    // Tools and processors should be added before agents and MCP servers that might use them
    if (config?.tools) {
      Object.entries(config.tools).forEach(([key, tool]) => {
        this.addTool(tool, key);
      });
    }

    if (config?.processors) {
      Object.entries(config.processors).forEach(([key, processor]) => {
        this.addProcessor(processor, key);
      });
    }

    if (config?.vectors) {
      Object.entries(config.vectors).forEach(([key, vector]) => {
        this.addVector(vector, key);
      });
    }

    if (config?.scorers) {
      Object.entries(config.scorers).forEach(([key, scorer]) => {
        this.addScorer(scorer, key);
      });
    }

    if (config?.workflows) {
      Object.entries(config.workflows).forEach(([key, workflow]) => {
        this.addWorkflow(workflow, key);
      });
    }

    if (config?.gateways) {
      Object.entries(config.gateways).forEach(([key, gateway]) => {
        this.addGateway(gateway, key);
      });
    }

    // Add MCP servers and agents last since they might reference other primitives
    if (config?.mcpServers) {
      Object.entries(config.mcpServers).forEach(([key, server]) => {
        this.addMCPServer(server, key);
      });
    }

    if (config?.agents) {
      Object.entries(config.agents).forEach(([key, agent]) => {
        this.addAgent(agent, key);
      });
    }

    if (config?.tts) {
      Object.entries(config.tts).forEach(([key, tts]) => {
        (this.#tts as Record<string, MastraTTS>)[key] = tts;
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
  public getAgentById(id: string): Agent {
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
  public addAgent<A extends Agent<any>>(agent: A, key?: string): void {
    const agentKey = key || agent.id;
    const agents = this.#agents as Record<string, Agent<any>>;
    if (agents[agentKey]) {
      const logger = this.getLogger();
      logger.debug(`Agent with key ${agentKey} already exists. Skipping addition.`);
      return;
    }

    // Initialize the agent
    agent.__setLogger(this.#logger);
    agent.__registerMastra(this);
    agent.__registerPrimitives({
      logger: this.getLogger(),
      storage: this.getStorage(),
      agents: agents,
      tts: this.#tts,
      vectors: this.#vectors,
    });
    agents[agentKey] = agent;
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
  public getVectorById(id: string): MastraVector {
    const allVectors = this.#vectors ?? ({} as Record<string, MastraVector>);

    // First try to find by internal ID
    for (const vector of Object.values(allVectors)) {
      if (vector.id === id) {
        return vector as MastraVector;
      }
    }

    // Fallback to searching by registration key
    const vectorByKey = allVectors[id];
    if (vectorByKey) {
      return vectorByKey;
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
  public getWorkflowById(id: string): Workflow {
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

    return workflow;
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
  public addScorer<S extends MastraScorer<any, any, any, any>>(scorer: S, key?: string): void {
    const scorerKey = key || scorer.id;
    const scorers = this.#scorers as Record<string, MastraScorer<any, any, any, any>>;
    if (scorers[scorerKey]) {
      const logger = this.getLogger();
      logger.debug(`Scorer with key ${scorerKey} already exists. Skipping addition.`);
      return;
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
  public getScorerById(id: string): MastraScorer<any, any, any, any> {
    for (const [_key, value] of Object.entries(this.#scorers ?? {})) {
      if (value.id === id || value?.name === id) {
        return value;
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
  public getToolById(id: string): ToolAction<any, any, any, any> {
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
        return tool as ToolAction<any, any, any, any>;
      }
    }

    // Fallback to searching by registration key
    const toolByKey = allTools[id];
    if (toolByKey) {
      return toolByKey;
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
  public getProcessorById(id: string): Processor {
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
        return processor as Processor;
      }
    }

    // Fallback to searching by registration key
    const processorByKey = allProcessors[id];
    if (processorByKey) {
      return processorByKey;
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
    const processorKey = key || processor.id;
    const processors = this.#processors as Record<string, Processor>;
    if (processors[processorKey]) {
      const logger = this.getLogger();
      logger.debug(`Processor with key ${processorKey} already exists. Skipping addition.`);
      return;
    }

    processors[processorKey] = processor;
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
  public addWorkflow<W extends Workflow<any, any, any, any, any, any>>(workflow: W, key?: string): void {
    const workflowKey = key || workflow.id;
    const workflows = this.#workflows as Record<string, Workflow<any, any, any, any, any, any>>;
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
  public getMCPServerById(serverId: string, version?: string): MCPServerBase | undefined {
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
