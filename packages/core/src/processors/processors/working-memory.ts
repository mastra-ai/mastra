import z from 'zod';
import { Agent } from '../../agent';
import type { MastraMessageV2 } from '../../agent/message-list';
import { TripWire } from '../../agent/trip-wire';
import { InternalSpans } from '../../ai-tracing';
import type { TracingContext } from '../../ai-tracing';
import type { MastraLanguageModel } from '../../llm/model/shared.types';
import type { MastraStorage } from '../../storage/base';
import type { Processor } from '../index';

/**
 * Working memory scope - where to store the memory
 */
export type WorkingMemoryScope = 'thread' | 'resource';

/**
 * Working memory template definition
 */
export interface WorkingMemoryTemplate {
  /** Format of the working memory */
  format: 'markdown' | 'json';
  /** Template content */
  content: string;
}

/**
 * Context relevance result from context selection agent
 */
interface ContextRelevanceResult {
  relevant_sections?: string[];
  relevance_score?: number;
  reason?: string;
}

/**
 * Information extraction result from extraction agent
 */
interface ExtractionResult {
  has_memorable_info?: boolean;
  confidence?: number;
  extracted_info?: string;
  reason?: string;
}

/**
 * Configuration options for WorkingMemoryProcessor
 */
export interface WorkingMemoryProcessorOptions {
  /**
   * Storage adapter for persisting working memory.
   * Must implement MastraStorage interface (getThreadById, updateThread, etc.)
   */
  storage: MastraStorage;

  /**
   * Language model used by internal agents for context selection and extraction.
   * Should be a capable model (e.g., GPT-4, Claude) for best results.
   */
  model: MastraLanguageModel;

  /**
   * Working memory scope:
   * - 'thread': Store memory per thread
   * - 'resource': Store memory per resource (default)
   */
  scope?: WorkingMemoryScope;

  /**
   * Working memory template defining the structure.
   * Can be a markdown template or JSON schema.
   * Default: Simple markdown template for user preferences
   */
  template?: WorkingMemoryTemplate;

  // ============= Input Processing Options =============

  /**
   * Strategy for injecting working memory into messages:
   * - 'system': Add as a system message (default)
   * - 'user-prefix': Prepend to user message
   * - 'context': Add as separate context message
   */
  injectionStrategy?: 'system' | 'user-prefix' | 'context';

  /**
   * Maximum amount of working memory to inject (in characters).
   * Prevents overwhelming the context window.
   * Default: 2000 characters
   */
  maxInjectionSize?: number;

  /**
   * Minimum relevance score (0-1) for context injection.
   * Only inject memory sections scoring above this threshold.
   * Default: 0.3
   */
  injectionThreshold?: number;

  /**
   * Custom instructions for the context selection agent.
   * Guide what memory is considered relevant for injection.
   */
  contextSelectionInstructions?: string;

  // ============= Output Processing Options =============

  /**
   * Strategy for how aggressively the processor extracts information:
   * - 'aggressive': Captures most details, even potentially ephemeral ones
   * - 'conservative': Only captures clearly important, long-term information
   * - 'balanced': Default - moderate threshold for what to remember
   *
   * Affects the extraction agent's instructions and confidence threshold.
   */
  extractionStrategy?: 'aggressive' | 'conservative' | 'balanced';

  /**
   * Whether to extract information from user messages too.
   * When true, analyzes user inputs for memorable information.
   * Default: true
   */
  extractFromUserMessages?: boolean;

  /**
   * Custom instructions for the extraction agent to override defaults.
   * Use this to provide domain-specific guidance on what to remember.
   * Example: "Focus on medical history and symptoms" for healthcare apps.
   */
  extractionInstructions?: string;

  /**
   * Whether to include the extraction agent's reasoning in debug logs.
   * Useful for understanding why certain information was or wasn't stored.
   * Default: false
   */
  includeReasoning?: boolean;

  /**
   * Minimum confidence score (0-1) for extraction decisions.
   * Only information scoring above this threshold will be stored.
   * Default values:
   * - aggressive: 0.3
   * - balanced: 0.5
   * - conservative: 0.7
   */
  confidenceThreshold?: number;
}

/**
 * WorkingMemoryProcessor automatically manages working memory by:
 * 1. Injecting relevant context from working memory into user messages (input processing)
 * 2. Extracting and storing important information from conversations (output processing)
 *
 * This replaces the need for explicit tool calls to update working memory
 * and provides intelligent context injection based on message content.
 */
export class WorkingMemoryProcessor implements Processor {
  readonly name = 'working-memory';

  private storage: MastraStorage;
  private scope: WorkingMemoryScope;
  private template: WorkingMemoryTemplate;

  // Input processing
  private injectionStrategy: 'system' | 'user-prefix' | 'context';
  private maxInjectionSize: number;
  private injectionThreshold: number;
  private contextSelectionAgent: Agent;

  // Output processing
  private extractionStrategy: 'aggressive' | 'conservative' | 'balanced';
  private extractFromUserMessages: boolean;
  private includeReasoning: boolean;
  private confidenceThreshold: number;
  private extractionAgent: Agent;

  // Track if we've injected context to avoid feedback loops
  private injectedContextMarker = '[WORKING_MEMORY_INJECTED]';

  // Default template
  private static readonly DEFAULT_TEMPLATE: WorkingMemoryTemplate = {
    format: 'markdown',
    content: `# User Information
- Name:
- Preferences:
- Context:`,
  };

  constructor(options: WorkingMemoryProcessorOptions) {
    this.storage = options.storage;
    this.scope = options.scope || 'resource';
    this.template = options.template || WorkingMemoryProcessor.DEFAULT_TEMPLATE;

    // Input processing setup
    this.injectionStrategy = options.injectionStrategy || 'system';
    this.maxInjectionSize = options.maxInjectionSize || 2000;
    this.injectionThreshold = options.injectionThreshold ?? 0.3;

    // Output processing setup
    this.extractionStrategy = options.extractionStrategy || 'balanced';
    this.extractFromUserMessages = options.extractFromUserMessages ?? true;
    this.includeReasoning = options.includeReasoning ?? false;

    // Set confidence threshold based on strategy if not explicitly provided
    if (options.confidenceThreshold !== undefined) {
      this.confidenceThreshold = options.confidenceThreshold;
    } else {
      switch (this.extractionStrategy) {
        case 'aggressive':
          this.confidenceThreshold = 0.3;
          break;
        case 'conservative':
          this.confidenceThreshold = 0.7;
          break;
        case 'balanced':
        default:
          this.confidenceThreshold = 0.5;
          break;
      }
    }

    // Create context selection agent for input processing
    this.contextSelectionAgent = new Agent({
      name: 'working-memory-context-selector',
      instructions: options.contextSelectionInstructions || this.createContextSelectionInstructions(),
      model: options.model,
      options: { tracingPolicy: { internal: InternalSpans.ALL } },
    });

    // Create extraction agent for output processing
    this.extractionAgent = new Agent({
      name: 'working-memory-extractor',
      instructions: this.createExtractionInstructions(options.extractionInstructions),
      model: options.model,
      options: { tracingPolicy: { internal: InternalSpans.ALL } },
    });
  }

  /**
   * Process input messages by injecting relevant working memory context
   */
  async processInput({
    messages,
    abort,
    tracingContext,
    threadId,
    resourceId,
  }: {
    messages: MastraMessageV2[];
    abort: (reason?: string) => never;
    tracingContext?: TracingContext;
    threadId?: string;
    resourceId?: string;
  }): Promise<MastraMessageV2[]> {
    console.log('processInput', this.scope, resourceId, threadId);
    try {
      // Check if we already injected context (avoid feedback loop)
      const hasInjectedContext = messages.some(msg =>
        this.extractTextContent(msg).includes(this.injectedContextMarker),
      );

      console.log('hasInjectedContext', hasInjectedContext);

      if (hasInjectedContext) {
        return messages;
      }

      // Get current working memory
      const workingMemory = await this.getWorkingMemory(threadId, resourceId);

      console.log('workingMemory', workingMemory);


      // Truncate if too long
      const truncatedMemory =
        workingMemory?.length && workingMemory?.length > this.maxInjectionSize
          ? workingMemory.substring(0, this.maxInjectionSize) + '\n...(truncated)'
          : workingMemory;

      // Get the user's query from the last user message
      // const lastUserMessage = [...messages].reverse().find(msg => msg.role === 'user');
      
      // let userQuery = '';
      // if (lastUserMessage) {
      //   userQuery = this.extractTextContent(lastUserMessage);
      // }


      // // Use context selection agent to determine relevance
      // const relevanceResult = await this.selectRelevantContext({
      //   workingMemory: truncatedMemory || '',
      //   userQuery,
      //   tracingContext,
      // });

      // Check if context is relevant enough to inject
      // if ((relevanceResult.relevance_score ?? 0) < this.injectionThreshold) {
      //   return messages;
      // }

      // Inject context according to strategy
      return this.injectContext(messages, truncatedMemory || '');
    } catch (error) {
      if (error instanceof TripWire) {
        throw error;
      }
      // Warn but don't fail - allow conversation to continue
      console.warn('[WorkingMemoryProcessor] Input processing failed:', error);
      return messages;
    }
  }

  /**
   * Process output messages by extracting and storing important information
   */
  async processOutputResult({
    messages,
    abort,
    tracingContext,
    threadId,
    resourceId,
  }: {
    messages: MastraMessageV2[];
    abort: (reason?: string) => never;
    tracingContext?: TracingContext;
    threadId?: string;
    resourceId?: string;
  }): Promise<MastraMessageV2[]> {
    try {
      // Collect messages to analyze
      const messagesToAnalyze: MastraMessageV2[] = [];

      for (const message of messages) {
        // Always include assistant messages
        if (message.role === 'assistant') {
          messagesToAnalyze.push(message);
        }
        // Include user messages if enabled
        else if (message.role === 'user' && this.extractFromUserMessages) {
          messagesToAnalyze.push(message);
        }
      }

      if (messagesToAnalyze.length === 0) {
        return messages;
      }

      // Build context for extraction agent
      const conversationContext = messagesToAnalyze
        .map(msg => {
          const text = this.extractTextContent(msg);
          return `[${msg.role.toUpperCase()}]: ${text}`;
        })
        .join('\n\n');

      // Use extraction agent to analyze and extract information
      const extractionResult = await this.extractInformation({
        conversationContext,
        templateFormat: this.template.format,
        tracingContext,
      });

      // Check if there's information to store
      if (
        !extractionResult.has_memorable_info ||
        (extractionResult.confidence ?? 0) < this.confidenceThreshold ||
        !extractionResult.extracted_info
      ) {
        if (this.includeReasoning && extractionResult.reason) {
          console.info(`[WorkingMemoryProcessor] No extraction: ${extractionResult.reason}`);
        }
        return messages;
      }

      // Update working memory with extracted information
      const updateResult = await this.updateWorkingMemory(extractionResult.extracted_info, threadId, resourceId);

      if (this.includeReasoning) {
        console.info(`[WorkingMemoryProcessor] Updated working memory: ${updateResult.reason}`);
      }

      // Return messages unchanged
      return messages;
    } catch (error) {
      if (error instanceof TripWire) {
        throw error;
      }
      // Warn but don't fail - allow conversation to continue
      console.warn('[WorkingMemoryProcessor] Output processing failed:', error);
      return messages;
    }
  }

  // ============= Working Memory Storage Methods =============

  /**
   * Get working memory from storage
   */
  private async getWorkingMemory(threadId?: string, resourceId?: string): Promise<string | null> {
    if (!this.storage.stores?.memory) {
      throw new Error('Memory storage not available on storage adapter');
    }

    if (this.scope === 'resource' && resourceId) {
      // Get working memory from resource
      const resource = await this.storage.stores.memory.getResourceById({ resourceId });
      return resource?.workingMemory || null;
    } else if (threadId) {
      // Get working memory from thread metadata
      const thread = await this.storage.stores.memory.getThreadById({ threadId });
      return (thread?.metadata?.workingMemory as string) || null;
    }

    return null;
  }

  /**
   * Update working memory in storage
   */
  private async updateWorkingMemory(
    newInfo: string,
    threadId?: string,
    resourceId?: string,
  ): Promise<{ success: boolean; reason: string }> {
    const existingWorkingMemory = (await this.getWorkingMemory(threadId, resourceId)) || '';

    let reason = '';
    let workingMemory = newInfo;

    if (existingWorkingMemory) {
      console.log('existingWorkingMemory', existingWorkingMemory);
      console.log('newInfo', newInfo);
      console.log('this.template.content', this.template.content);
      // Check for duplicates
      if (existingWorkingMemory.includes(newInfo) || this.template.content.trim() === newInfo.trim()) {
        return {
          success: false,
          reason: 'attempted to insert duplicate data into working memory. this entry was skipped',
        };
      }

      // Merge with existing memory
      workingMemory = existingWorkingMemory + '\n' + newInfo;
      reason = 'merged new information with existing working memory';
    } else {
      reason = 'initialized working memory with new information';
    }

    if (!this.storage.stores?.memory) {
      throw new Error('Memory storage not available on storage adapter');
    }

    console.log('this.scope', this.scope, resourceId, threadId);
    // Save to storage based on scope
    if (this.scope === 'resource' && resourceId) {
      await this.storage.stores.memory.updateResource({
        resourceId,
        workingMemory,
      });
    } else if (threadId) {
      const thread = await this.storage.stores.memory.getThreadById({ threadId });
      if (!thread) {
        throw new Error(`Thread ${threadId} not found`);
      }

      await this.storage.stores.memory.updateThread({
        id: threadId,
        title: thread.title || 'Untitled Thread',
        metadata: {
          ...thread.metadata,
          workingMemory,
        },
      });
    }

    return { success: true, reason };
  }

  // ============= Agent Helper Methods =============

  /**
   * Use context selection agent to determine if working memory is relevant
   */
  private async selectRelevantContext({
    workingMemory,
    userQuery,
    tracingContext,
  }: {
    workingMemory: string;
    userQuery: string;
    tracingContext?: TracingContext;
  }): Promise<ContextRelevanceResult> {
    const prompt = `
Analyze if the working memory is relevant to the user's query.

Working Memory:
${workingMemory}

User Query:
${userQuery}
`;

    const schema = z.object({
      relevant_sections: z.array(z.string()).optional(),
      relevance_score: z.number().min(0).max(1).optional(),
      reason: z.string().optional(),
    });

    try {
      const model = await this.contextSelectionAgent.getModel();
      let response;

      if (model.specificationVersion === 'v2') {
        response = await this.contextSelectionAgent.generate(prompt, {
          structuredOutput: {
            schema,
          },
          modelSettings: {
            temperature: 0,
          },
          tracingContext,
        });
      } else {
        response = await this.contextSelectionAgent.generateLegacy(prompt, {
          output: schema,
          temperature: 0,
          tracingContext,
        });
      }

      return response.object as ContextRelevanceResult;
    } catch (error) {
      console.warn('[WorkingMemoryProcessor] Context selection failed, defaulting to relevant:', error);
      return { relevance_score: 1.0 };
    }
  }

  /**
   * Use extraction agent to analyze conversation and extract information
   */
  private async extractInformation({
    conversationContext,
    templateFormat,
    tracingContext,
  }: {
    conversationContext: string;
    templateFormat: 'markdown' | 'json';
    tracingContext?: TracingContext;
  }): Promise<ExtractionResult> {
    const prompt = `
Analyze the conversation and extract important information worth storing in working memory.

Conversation:
${conversationContext}

Working memory format: ${templateFormat}
`;

    const schema = z.object({
      has_memorable_info: z.boolean().optional(),
      confidence: z.number().min(0).max(1).optional(),
      extracted_info: z.string().optional(),
      reason: z.string().optional(),
    });

    try {
      const model = await this.extractionAgent.getModel();
      let response;

      if (model.specificationVersion === 'v2') {
        response = await this.extractionAgent.generate(prompt, {
          structuredOutput: {
            schema,
          },
          modelSettings: {
            temperature: 0,
          },
          tracingContext,
        });
      } else {
        response = await this.extractionAgent.generateLegacy(prompt, {
          output: schema,
          temperature: 0,
          tracingContext,
        });
      }

      return response.object as ExtractionResult;
    } catch (error) {
      console.warn('[WorkingMemoryProcessor] Information extraction failed:', error);
      return { has_memorable_info: false, reason: 'Extraction failed' };
    }
  }

  // ============= Context Injection Methods =============

  /**
   * Inject working memory context into messages according to strategy
   */
  private injectContext(messages: MastraMessageV2[], context: string): MastraMessageV2[] {
    const contextWithMarker = `${this.injectedContextMarker}\n\n${context}`;

    switch (this.injectionStrategy) {
      case 'system': {
        // Add as system message at the beginning
        const systemMessage: MastraMessageV2 = {
          role: 'system',
          content: {
            content: `Working Memory Context:\n\n${contextWithMarker}`,
            parts: [],
            format: 2,
          },
          createdAt: new Date(),
          id: 'working-memory-context',
        };
        return [systemMessage, ...messages];
      }

      case 'user-prefix': {
        // Prepend to the last user message
        const lastUserIndex = messages.map(m => m.role).lastIndexOf('user');
        if (lastUserIndex === -1) return messages;

        const modifiedMessages = [...messages];
        const lastUserMessage = modifiedMessages[lastUserIndex];
        if (!lastUserMessage) return messages;
        const existingText = this.extractTextContent(lastUserMessage);

        modifiedMessages[lastUserIndex] = {
          ...lastUserMessage,
          content: {
            content: `Context from working memory:\n${contextWithMarker}\n\n${existingText}`,
            parts: [],
            format: 2,
          },
          createdAt: new Date(),
          id: 'working-memory-context',
        };

        return modifiedMessages;
      }

      case 'context': {
        // Add as a separate context message before the last user message
        const lastUserIndex = messages.map(m => m.role).lastIndexOf('user');
        if (lastUserIndex === -1) return messages;

        const contextMessage: MastraMessageV2 = {
          role: 'user',
          content: {
            content: `[Context]: ${contextWithMarker}`,
            parts: [],
            format: 2,
          },
          createdAt: new Date(),
          id: 'working-memory-context',
        };

        const modifiedMessages = [...messages];
        modifiedMessages.splice(lastUserIndex, 0, contextMessage);
        return modifiedMessages;
      }

      default:
        return messages;
    }
  }

  /**
   * Extract text content from a message
   */
  private extractTextContent(message: MastraMessageV2): string {
    let text = '';

    if (message.content.parts) {
      for (const part of message.content.parts) {
        if (part.type === 'text' && 'text' in part && typeof part.text === 'string') {
          text += part.text + ' ';
        }
      }
    }

    if (!text.trim() && typeof message.content.content === 'string') {
      text = message.content.content;
    }

    return text.trim();
  }

  // ============= Agent Instructions =============

  /**
   * Create default instructions for context selection agent
   */
  private createContextSelectionInstructions(): string {
    return `You are a context relevance analyzer. Determine if the working memory contains information relevant to the user's query.

Guidelines:
- Consider semantic relevance, not just keyword matching
- Recent interactions are often relevant to follow-up questions
- User preferences and stated goals are broadly relevant
- Technical context (e.g., code, configurations) is relevant to related technical queries
- Return relevance_score between 0 (not relevant) and 1 (highly relevant)
- Identify specific sections of memory that are relevant

Be helpful but not overly aggressive - only inject context when it genuinely aids the response.`;
  }

  /**
   * Create instructions for extraction agent based on strategy
   */
  private createExtractionInstructions(customInstructions?: string): string {
    let strategyGuidance = '';

    switch (this.extractionStrategy) {
      case 'aggressive':
        strategyGuidance = `
Strategy: AGGRESSIVE - Capture most information
- Extract facts, preferences, context, and even potentially transient information
- Err on the side of storing too much rather than too little
- Lower confidence threshold for extraction (0.3+)`;
        break;

      case 'conservative':
        strategyGuidance = `
Strategy: CONSERVATIVE - Only capture clearly important information
- Focus on long-term facts, user preferences, and critical context
- Avoid transient information, temporary states, or trivial details
- Higher confidence threshold for extraction (0.7+)`;
        break;

      case 'balanced':
      default:
        strategyGuidance = `
Strategy: BALANCED - Moderate approach to extraction
- Extract important facts, preferences, and relevant context
- Skip trivial or highly transient information
- Moderate confidence threshold for extraction (0.5+)`;
        break;
    }

    const baseInstructions = `You are an information extraction specialist for working memory management.

${strategyGuidance}

Information to extract:
- User preferences and personal details
- Important facts and data points
- Task-related context and state
- Decisions and conclusions
- Action items and future references
- Goals and objectives

Information to skip:
- Greetings and pleasantries
- Already-stored information (unless updating)
- Purely procedural conversation
- Temporary/ephemeral details (unless aggressive mode)

Output guidelines:
- Set has_memorable_info to true only if there's information worth storing
- Provide confidence score (0-1) for your extraction decision
- Extract information in a format matching the working memory template
- Include reason for your decision`;

    if (customInstructions) {
      return `${baseInstructions}\n\nDomain-specific guidance:\n${customInstructions}`;
    }

    return baseInstructions;
  }
}
