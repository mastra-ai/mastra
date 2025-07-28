import z from 'zod';
import type { MastraLanguageModel } from '../../index';
import { Agent } from '../../index';
import type { MastraMessageV2 } from '../../message-list';
import type { InputProcessor } from '../index';

/**
 * Moderation categories based on OpenAI's structure but configurable
 */
export interface ModerationCategories {
  hate?: boolean;
  'hate/threatening'?: boolean;
  harassment?: boolean;
  'harassment/threatening'?: boolean;
  'self-harm'?: boolean;
  'self-harm/intent'?: boolean;
  'self-harm/instructions'?: boolean;
  sexual?: boolean;
  'sexual/minors'?: boolean;
  violence?: boolean;
  'violence/graphic'?: boolean;
  [customCategory: string]: boolean | undefined;
}

/**
 * Confidence scores for each moderation category (0-1)
 */
export interface ModerationCategoryScores {
  hate?: number;
  'hate/threatening'?: number;
  harassment?: number;
  'harassment/threatening'?: number;
  'self-harm'?: number;
  'self-harm/intent'?: number;
  'self-harm/instructions'?: number;
  sexual?: number;
  'sexual/minors'?: number;
  violence?: number;
  'violence/graphic'?: number;
  [customCategory: string]: number | undefined;
}

/**
 * Result structure similar to OpenAI's moderation API
 */
export interface ModerationResult {
  flagged: boolean;
  categories: ModerationCategories;
  category_scores: ModerationCategoryScores;
  reason?: string;
}

/**
 * Configuration options for ModerationInputProcessor
 */
export interface ModerationOptions {
  /** Model configuration for the moderation agent */
  model: MastraLanguageModel;

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
}

/**
 * ModerationInputProcessor uses an internal Mastra agent to evaluate content
 * against configurable moderation categories for content safety.
 *
 * Provides flexible moderation with custom categories, thresholds, and strategies
 * while maintaining compatibility with OpenAI's moderation API structure.
 */
export class ModerationInputProcessor implements InputProcessor {
  readonly name = 'moderation';

  private moderationAgent: Agent;
  private categories: string[];
  private threshold: number;
  private strategy: 'block' | 'warn' | 'filter';
  private includeScores: boolean;

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
    this.categories = options.categories || ModerationInputProcessor.DEFAULT_CATEGORIES;
    this.threshold = options.threshold ?? 0.5;
    this.strategy = options.strategy || 'block';
    this.includeScores = options.includeScores ?? false;

    // Create internal moderation agent
    this.moderationAgent = new Agent({
      name: 'content-moderator',
      instructions: options.instructions || this.createDefaultInstructions(),
      model: options.model,
    });
  }

  async process(args: { messages: MastraMessageV2[]; abort: (reason?: string) => never }): Promise<MastraMessageV2[]> {
    try {
      const { messages, abort } = args;

      if (messages.length === 0) {
        return messages;
      }

      const results: ModerationResult[] = [];
      const passedMessages: MastraMessageV2[] = [];

      // Evaluate each message
      for (const message of messages) {
        const textContent = this.extractTextContent(message);
        if (!textContent.trim()) {
          // No text content to moderate
          passedMessages.push(message);
          continue;
        }

        const moderationResult = await this.moderateContent(textContent);
        results.push(moderationResult);

        if (moderationResult.flagged) {
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
      if (error instanceof Error && error.message.includes('Tripwire')) {
        throw error; // Re-throw tripwire errors
      }
      args.abort(`Moderation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Moderate content using the internal agent
   */
  private async moderateContent(content: string): Promise<ModerationResult> {
    const prompt = this.createModerationPrompt(content);

    try {
      const response = await this.moderationAgent.generate(prompt, {
        output: z.object({
          flagged: z.boolean(),
          categories: z.object(
            this.categories.reduce(
              (props, category) => {
                props[category] = z.boolean();
                return props;
              },
              {} as Record<string, z.ZodType<boolean>>,
            ),
          ),
          category_scores: z.object(
            this.categories.reduce(
              (props, category) => {
                props[category] = z.number().min(0).max(1);
                return props;
              },
              {} as Record<string, z.ZodType<number>>,
            ),
          ),
          reason: z.string().optional(),
        }),
        temperature: 0,
      });

      const result = response.object as ModerationResult;

      // Validate and apply threshold
      const maxScore = Math.max(
        ...(Object.values(result.category_scores).filter(score => typeof score === 'number') as number[]),
      );
      result.flagged = result.flagged || maxScore >= this.threshold;

      return result;
    } catch (error) {
      console.warn('[ModerationInputProcessor] Agent moderation failed, allowing content:', error);
      // Fail open - return non-flagged result if moderation agent fails
      return {
        flagged: false,
        categories: this.categories.reduce((cats, category) => {
          cats[category] = false;
          return cats;
        }, {} as ModerationCategories),
        category_scores: this.categories.reduce((scores, category) => {
          scores[category] = 0;
          return scores;
        }, {} as ModerationCategoryScores),
        reason: 'Moderation agent failed, content allowed by default',
      };
    }
  }

  /**
   * Handle flagged content based on strategy
   */
  private handleFlaggedContent(
    result: ModerationResult,
    strategy: 'block' | 'warn' | 'filter',
    abort: (reason?: string) => never,
  ): void {
    const flaggedCategories = Object.entries(result.categories)
      .filter(([_, flagged]) => flagged)
      .map(([category]) => category);

    const message = `Content flagged for moderation. Categories: ${flaggedCategories.join(', ')}${
      result.reason ? `. Reason: ${result.reason}` : ''
    }${this.includeScores ? `. Scores: ${JSON.stringify(result.category_scores)}` : ''}`;

    switch (strategy) {
      case 'block':
        abort(message);
        break;
      case 'warn':
        console.warn(`[ModerationInputProcessor] ${message}`);
        break;
      case 'filter':
        console.info(`[ModerationInputProcessor] Filtered message: ${message}`);
        break;
    }
  }

  /**
   * Extract text content from message for moderation
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

  /**
   * Create default moderation instructions
   */
  private createDefaultInstructions(): string {
    return `You are a content moderation specialist. Your job is to evaluate text content for potential policy violations.

Evaluate the provided content against these categories:
${this.categories.map(cat => `- ${cat}`).join('\n')}

For each category, provide:
1. A boolean indicating if the content violates that category
2. A confidence score between 0-1 (where 1 means definitely violates)

Guidelines:
- Be thorough but not overly strict
- Consider context and intent
- Educational, historical, or creative content may be acceptable even if it touches sensitive topics
- Focus on content that could cause real harm
- Provide a brief reason if any category is flagged

Return your assessment in the required JSON format.`;
  }

  /**
   * Create moderation prompt for the agent
   */
  private createModerationPrompt(content: string): string {
    return `Please evaluate the following content for moderation:

Content: "${content}"

Evaluate against categories: ${this.categories.join(', ')}

Provide a detailed assessment with boolean flags, confidence scores (0-1), and reasoning for any flags.`;
  }
}
