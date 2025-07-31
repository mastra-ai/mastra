import z from 'zod';
import type { MastraLanguageModel } from '../../index';
import { Agent } from '../../index';
import type { MastraMessageV2 } from '../../message-list';
import { TripWire } from '../../trip-wire';
import type { OutputProcessor } from '../index';

/**
 * Confidence scores for each moderation category (0-1)
 */
export interface OutputModerationCategoryScores {
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
 * Result structure for moderation
 */
export interface OutputModerationResult {
  category_scores?: OutputModerationCategoryScores;
  reason?: string;
}

/**
 * Configuration options for ModerationOutputProcessor
 */
export interface ModerationOutputOptions {
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
   * - 'block': Reject the entire output with an error (default)
   * - 'warn': Log warning but allow content through
   * - 'filter': Remove flagged messages but continue with remaining
   * - 'replace': Replace flagged content with a safe alternative
   */
  strategy?: 'block' | 'warn' | 'filter' | 'replace';

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
   * Replacement text when strategy is 'replace'
   */
  replacementText?: string;
}

/**
 * ModerationOutputProcessor uses an internal Mastra agent to evaluate LLM output
 * against configurable moderation categories for content safety.
 *
 * This is useful for ensuring the assistant's responses meet content guidelines
 * and don't generate harmful or inappropriate content.
 */
export class ModerationOutputProcessor implements OutputProcessor {
  readonly name = 'output-moderation';

  private moderationAgent: Agent;
  private categories: string[];
  private threshold: number;
  private strategy: 'block' | 'warn' | 'filter' | 'replace';
  private includeScores: boolean;
  private replacementText: string;

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

  constructor(options: ModerationOutputOptions) {
    this.categories = options.categories || ModerationOutputProcessor.DEFAULT_CATEGORIES;
    this.threshold = options.threshold ?? 0.5;
    this.strategy = options.strategy || 'block';
    this.includeScores = options.includeScores ?? false;
    this.replacementText = options.replacementText || 'I apologize, but I cannot provide that response due to content policy restrictions.';

    // Create internal moderation agent
    this.moderationAgent = new Agent({
      name: 'output-content-moderator',
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

      const results: OutputModerationResult[] = [];
      const passedMessages: MastraMessageV2[] = [];

      // Evaluate each message
      for (const message of messages) {
        // Only process assistant messages
        if (message.role !== 'assistant') {
          passedMessages.push(message);
          continue;
        }

        const textContent = this.extractTextContent(message);
        if (!textContent.trim()) {
          // No text content to moderate
          passedMessages.push(message);
          continue;
        }

        const moderationResult = await this.moderateContent(textContent);
        results.push(moderationResult);

        if (this.isModerationFlagged(moderationResult)) {
          const processedMessage = this.handleFlaggedContent(message, moderationResult, this.strategy, abort);
          
          if (processedMessage) {
            passedMessages.push(processedMessage);
          }
          // If processedMessage is null, the message is filtered out
        } else {
          passedMessages.push(message);
        }
      }

      return passedMessages;
    } catch (error) {
      if (error instanceof TripWire) {
        throw error; // Re-throw tripwire errors
      }
      args.abort(`Output moderation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Moderate content using the internal agent
   */
  private async moderateContent(content: string): Promise<OutputModerationResult> {
    const prompt = this.createModerationPrompt(content);

    try {
      const response = await this.moderationAgent.generate(prompt, {
        output: z.object({
          category_scores: z
            .object(
              this.categories.reduce(
                (props, category) => {
                  props[category] = z.number().min(0).max(1).optional();
                  return props;
                },
                {} as Record<string, z.ZodType<number | undefined>>,
              ),
            )
            .optional(),
          reason: z.string().optional(),
        }),
        temperature: 0,
      });

      const result = response.object as OutputModerationResult;

      return result;
    } catch (error) {
      console.warn('[ModerationOutputProcessor] Agent moderation failed, allowing content:', error);
      // Fail open - return empty result if moderation agent fails (no moderation needed)
      return {};
    }
  }

  /**
   * Determine if content is flagged based on category scores above threshold
   */
  private isModerationFlagged(result: OutputModerationResult): boolean {
    // Check if any category scores exceed the threshold
    if (result.category_scores) {
      const scores = Object.values(result.category_scores).filter(score => typeof score === 'number') as number[];
      if (scores.length === 0) return false;
      const maxScore = Math.max(...scores);
      return maxScore >= this.threshold;
    }

    return false;
  }

  /**
   * Handle flagged content based on strategy
   */
  private handleFlaggedContent(
    message: MastraMessageV2,
    result: OutputModerationResult,
    strategy: 'block' | 'warn' | 'filter' | 'replace',
    abort: (reason?: string) => never,
  ): MastraMessageV2 | null {
    const flaggedCategories = Object.entries(result.category_scores || {})
      .filter(([_, score]) => typeof score === 'number' && score >= this.threshold)
      .map(([category]) => category);

    const message_text = `Output flagged for moderation. Categories: ${flaggedCategories.join(', ')}${
      result.reason ? `. Reason: ${result.reason}` : ''
    }${this.includeScores ? `. Scores: ${JSON.stringify(result.category_scores)}` : ''}`;

    switch (strategy) {
      case 'block':
        abort(message_text);
        break;
      case 'warn':
        console.warn(`[ModerationOutputProcessor] ${message_text}`);
        return message; // Allow the original message through
      case 'filter':
        console.info(`[ModerationOutputProcessor] Filtered response: ${message_text}`);
        return null; // Filter out this message
      case 'replace':
        console.info(`[ModerationOutputProcessor] Replaced flagged response: ${message_text}`);
        // Return a modified message with safe content
        return {
          ...message,
          content: {
            ...message.content,
            parts: [
              {
                type: 'text',
                text: this.replacementText,
              },
            ],
          },
        };
      default:
        return message;
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
    return `You are a content moderation specialist. Your job is to evaluate AI assistant responses for potential policy violations.

Evaluate the provided AI-generated content against these categories:
${this.categories.map(cat => `- ${cat}`).join('\n')}

IMPORTANT: IF NO MODERATION IS NEEDED, RETURN AN EMPTY OBJECT, DO NOT INCLUDE ANYTHING ELSE. Do not include any zeros in your response, if the response should be 0, omit it, they will be counted as false.

Guidelines:
- Be thorough but not overly strict
- Consider context and intent of the AI response
- Educational, helpful, or informative content should generally be acceptable
- Focus on content that could cause real harm if shared with users
- Pay special attention to content that could be used to manipulate, deceive, or harm others
- Provide a brief reason if any category is flagged`;
  }

  /**
   * Create moderation prompt for the agent
   */
  private createModerationPrompt(content: string): string {
    return `Please evaluate the following AI assistant response for content policy violations:

AI Response: "${content}"`;
  }
}