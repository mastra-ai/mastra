import type { SharedV2ProviderOptions } from '@ai-sdk/provider-v5';
import z from 'zod/v4';
import { Agent, isSupportedLanguageModel } from '../../agent';
import type { MastraDBMessage } from '../../agent/message-list';
import { TripWire } from '../../agent/trip-wire';
import type { ProviderOptions } from '../../llm/model/provider-options';
import type { MastraModelConfig } from '../../llm/model/shared.types';
import type { ObservabilityContext } from '../../observability';
import { resolveObservabilityContext } from '../../observability';
import type { PublicSchema } from '../../schema';
import { toStandardSchema, standardSchemaToJSONSchema } from '../../schema';
import type { ChunkType } from '../../stream';
import type { Processor } from '../index';

/**
 * Individual moderation category score
 */
export interface ModerationCategoryScore {
  category: string;
  score: number;
}

export type ModerationCategoryScores = ModerationCategoryScore[];

/**
 * Result structure for moderation
 */
export interface ModerationResult {
  category_scores: ModerationCategoryScores | null;
  reason: string | null;
}

/**
 * Configuration options for ModerationInputProcessor
 */
export interface ModerationOptions {
  /**
   * Model configuration for the moderation agent
   * Supports magic strings like "openai/gpt-4o", config objects, or direct LanguageModel instances
   */
  model: MastraModelConfig;

  /**
   * Categories to check for moderation.
   * If not specified, uses default OpenAI categories.
   */
  categories?: string[];

  /**
   * Confidence threshold for flagging (0-1, default: 0.5)
   * Content is flagged if any category score exceeds this threshold
   */
  threshold?: number;

  /**
   * Strategy when content is flagged:
   * - 'block': Reject the entire input with an error (default)
   * - 'warn': Log warning but allow content through
   * - 'filter': Remove flagged messages but continue with remaining
   */
  strategy?: 'block' | 'warn' | 'filter';

  /**
   * Custom moderation instructions for the agent
   * If not provided, uses default instructions based on categories
   */
  instructions?: string;

  /**
   * Whether to include confidence scores in logs (default: false)
   * Useful for tuning thresholds and debugging
   */
  includeScores?: boolean;

  /**
   * Number of previous chunks to include for context when moderating stream chunks.
   * If set to 1, includes the previous part. If set to 2, includes the two previous chunks, etc.
   * Default: 0 (no context window)
   */
  chunkWindow?: number;

  /**
   * Structured output options used for the moderation agent
   */
  structuredOutputOptions?: {
    /**
     * Whether to use system prompt injection instead of native response format to coerce the LLM to respond with json text if the LLM does not natively support structured outputs.
     */
    jsonPromptInjection?: boolean;
  };

  /**
   * Provider-specific options passed to the internal moderation agent.
   * Use this to control model behavior like reasoning effort for thinking models.
   *
   * @example
   * ```ts
   * providerOptions: {
   *   openai: { reasoningEffort: 'low' }
   * }
   * ```
   */
  providerOptions?: ProviderOptions;
}

/**
 * ModerationInputProcessor uses an internal Mastra agent to evaluate content
 * against configurable moderation categories for content safety.
 *
 * Provides flexible moderation with custom categories, thresholds, and strategies
 * while maintaining compatibility with OpenAI's moderation API structure.
 */
export class ModerationProcessor implements Processor<'moderation'> {
  readonly id = 'moderation';
  readonly name = 'Moderation';

  private moderationAgent: Agent;
  private categories: string[];
  private threshold: number;
  private strategy: 'block' | 'warn' | 'filter';
  private includeScores: boolean;
  private chunkWindow: number;
  private structuredOutputOptions?: ModerationOptions['structuredOutputOptions'];
  private providerOptions?: ProviderOptions;

  // Default OpenAI moderation categories
  private static readonly DEFAULT_CATEGORIES = [
    'hate',
    'hate/threatening',
    'harassment',
    'harassment/threatening',
    'self-harm',
    'self-harm/intent',
    'self-harm/instructions',
    'sexual',
    'sexual/minors',
    'violence',
    'violence/graphic',
  ];

  constructor(options: ModerationOptions) {
    this.categories = options.categories || ModerationProcessor.DEFAULT_CATEGORIES;
    this.threshold = options.threshold ?? 0.5;
    this.strategy = options.strategy || 'block';
    this.includeScores = options.includeScores ?? false;
    this.chunkWindow = options.chunkWindow ?? 0;
    this.structuredOutputOptions = options.structuredOutputOptions;
    this.providerOptions = options.providerOptions;

    // Create internal moderation agent
    this.moderationAgent = new Agent({
      id: 'content-moderator',
      name: 'Content Moderator',
      instructions: options.instructions || this.createDefaultInstructions(),
      model: options.model,
    });
  }

  async processInput(
    args: {
      messages: MastraDBMessage[];
      abort: (reason?: string) => never;
    } & Partial<ObservabilityContext>,
  ): Promise<MastraDBMessage[]> {
    try {
      const { messages, abort, ...rest } = args;
      const observabilityContext = resolveObservabilityContext(rest);

      if (messages.length === 0) {
        return messages;
      }

      const results: ModerationResult[] = [];
      const passedMessages: MastraDBMessage[] = [];

      // Evaluate each message
      for (const message of messages) {
        const textContent = this.extractTextContent(message);
        if (!textContent.trim()) {
          // No text content to moderate
          passedMessages.push(message);
          continue;
        }

        const moderationResult = await this.moderateContent(textContent, false, observabilityContext);
        results.push(moderationResult);

        if (this.isModerationFlagged(moderationResult)) {
          this.handleFlaggedContent(moderationResult, this.strategy, abort);

          // If we reach here, strategy is 'warn' or 'filter'
          if (this.strategy === 'filter') {
            continue; // Skip this message
          }
        }

        passedMessages.push(message);
      }

      return passedMessages;
    } catch (error) {
      if (error instanceof TripWire) {
        throw error; // Re-throw tripwire errors
      }
      args.abort(`Moderation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async processOutputResult(
    args: {
      messages: MastraDBMessage[];
      abort: (reason?: string) => never;
    } & Partial<ObservabilityContext>,
  ): Promise<MastraDBMessage[]> {
    return this.processInput(args);
  }

  async processOutputStream(
    args: {
      part: ChunkType;
      streamParts: ChunkType[];
      state: Record<string, any>;
      abort: (reason?: string) => never;
    } & Partial<ObservabilityContext>,
  ): Promise<ChunkType | null | undefined> {
    try {
      const { part, streamParts, abort, ...rest } = args;
      const observabilityContext = resolveObservabilityContext(rest);

      // Only process text-delta chunks for moderation
      if (part.type !== 'text-delta') {
        return part;
      }

      // Build context from chunks based on chunkWindow (streamParts includes the current part)
      const contentToModerate = this.buildContextFromChunks(streamParts);

      const moderationResult = await this.moderateContent(contentToModerate, true, observabilityContext);

      if (this.isModerationFlagged(moderationResult)) {
        this.handleFlaggedContent(moderationResult, this.strategy, abort);

        // If we reach here, strategy is 'warn' or 'filter'
        if (this.strategy === 'filter') {
          return null; // Don't emit this part
        }
      }

      return part;
    } catch (error) {
      if (error instanceof TripWire) {
        throw error; // Re-throw tripwire errors
      }
      // Log error but don't block the stream
      console.warn('[ModerationProcessor] Stream moderation failed:', error);
      return args.part;
    }
  }

  /**
   * Moderate content using the internal agent
   */
  private async moderateContent(
    content: string,
    isStream = false,
    observabilityContext?: ObservabilityContext,
  ): Promise<ModerationResult> {
    const prompt = this.createModerationPrompt(content, isStream);

    try {
      const model = await this.moderationAgent.getModel();
      const schema = z.object({
        category_scores: z
          .array(
            z.object({
              category: z
                .enum(this.categories as [string, ...string[]])
                .describe('The moderation category being evaluated'),
              score: z
                .number()
                .min(0)
                .max(1)
                .describe('Confidence score between 0 and 1 indicating how strongly the content matches this category'),
            }),
          )
          .describe('Array of flagged categories with their confidence scores')
          .nullable(),
        reason: z.string().describe('Brief explanation of why content was flagged').nullable(),
      });

      let result: ModerationResult;
      if (isSupportedLanguageModel(model)) {
        const response = await this.moderationAgent.generate(prompt, {
          structuredOutput: {
            ...(this.structuredOutputOptions ?? {}),
            schema,
          },
          modelSettings: {
            temperature: 0,
          },
          providerOptions: this.providerOptions,
          ...observabilityContext,
        });

        if (!response.object) {
          throw new Error('Structured output returned no object');
        }
        result = response.object;
      } else {
        const standardSchema = toStandardSchema(schema as PublicSchema);
        const response = await this.moderationAgent.generateLegacy(prompt, {
          output: standardSchemaToJSONSchema(standardSchema),
          temperature: 0,
          providerOptions: this.providerOptions as SharedV2ProviderOptions,
          ...observabilityContext,
        });

        result = response.object as ModerationResult;
      }

      return result;
    } catch (error) {
      console.warn('[ModerationProcessor] Agent moderation failed, allowing content:', error);
      // Fail open - return empty result if moderation agent fails (no moderation needed)
      return {
        category_scores: null,
        reason: null,
      };
    }
  }

  /**
   * Determine if content is flagged based on category scores above threshold
   */
  private isModerationFlagged(result: ModerationResult): boolean {
    // Check if any category scores exceed the threshold
    if (result.category_scores && result.category_scores.length > 0) {
      const maxScore = Math.max(...result.category_scores.map(cat => cat.score));
      return maxScore >= this.threshold;
    }

    return false;
  }

  /**
   * Handle flagged content based on strategy
   */
  private handleFlaggedContent(
    result: ModerationResult,
    strategy: 'block' | 'warn' | 'filter',
    abort: (reason?: string) => never,
  ): void {
    const flaggedCategories = (result.category_scores || [])
      .filter(cat => cat.score >= this.threshold)
      .map(cat => cat.category);

    const message = `Content flagged for moderation. Categories: ${flaggedCategories.join(', ')}${
      result.reason ? `. Reason: ${result.reason}` : ''
    }${this.includeScores ? `. Scores: ${result.category_scores?.map(cat => `${cat.category}: ${cat.score}`).join(', ')}` : ''}`;

    switch (strategy) {
      case 'block':
        abort(message);
        break;
      case 'warn':
        console.warn(`[ModerationProcessor] ${message}`);
        break;
      case 'filter':
        console.info(`[ModerationProcessor] Filtered message: ${message}`);
        break;
    }
  }

  /**
   * Extract text content from message for moderation
   */
  private extractTextContent(message: MastraDBMessage): string {
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

  /**
   * Create default moderation instructions
   */
  private createDefaultInstructions(): string {
    return `You are a content moderation specialist. Your job is to evaluate text content for potential policy violations.

Evaluate the provided content against these categories:
${this.categories.map(cat => `- ${cat}`).join('\n')}

IMPORTANT: Only include categories that are actually flagged. If no moderation issues are detected, return an empty array for category_scores.

Guidelines:
- Be thorough but not overly strict
- Consider context and intent
- Educational, historical, or creative content may be acceptable even if it touches sensitive topics
- Focus on content that could cause real harm
- Provide a brief reason if any category is flagged`;
  }

  /**
   * Create moderation prompt for the agent
   */
  private createModerationPrompt(content: string, isStream: boolean): string {
    return `Please evaluate the following content for moderation, ${isStream ? `this is a stream, so keep in mind you only have the context of the last ${this.chunkWindow} chunks. Make your best judgement on the content.` : ''}:

Content: "${content}"`;
  }

  /**
   * Build context string from chunks based on chunkWindow
   * streamParts includes the current part
   */
  private buildContextFromChunks(streamParts: ChunkType[]): string {
    if (this.chunkWindow === 0) {
      // When chunkWindow is 0, only moderate the current part (last part in streamParts)
      const currentChunk = streamParts[streamParts.length - 1];
      if (currentChunk && currentChunk.type === 'text-delta') {
        return currentChunk.payload.text;
      }
      return '';
    }

    // Get the last N chunks (streamParts includes the current part)
    const contextChunks = streamParts.slice(-this.chunkWindow);

    // Extract text content from text-delta chunks
    const textContent = contextChunks
      .filter(part => part.type === 'text-delta')
      .map(part => {
        if (part.type === 'text-delta') {
          return part.payload.text;
        }
        return '';
      })
      .join('');

    return textContent;
  }
}
