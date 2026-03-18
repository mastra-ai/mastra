import * as crypto from 'node:crypto';
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
 * PII categories for detection and redaction
 */
export interface PIICategories {
  email?: boolean;
  phone?: boolean;
  'credit-card'?: boolean;
  ssn?: boolean;
  'api-key'?: boolean;
  'ip-address'?: boolean;
  name?: boolean;
  address?: boolean;
  'date-of-birth'?: boolean;
  url?: boolean;
  uuid?: boolean;
  'crypto-wallet'?: boolean;
  iban?: boolean;
  [customType: string]: boolean | undefined;
}

/**
 * Individual PII category score
 */
export interface PIICategoryScore {
  type: string;
  score: number;
}

export type PIICategoryScores = PIICategoryScore[];

/**
 * Individual PII detection with location and redaction info
 */
export interface PIIDetection {
  type: string;
  value: string;
  confidence: number;
  start: number;
  end: number;
  redacted_value?: string | null; // Only present when strategy is 'redact'
}

/**
 * Result structure for PII detection (simplified for minimal tokens)
 */
export interface PIIDetectionResult {
  categories: PIICategoryScores | null;
  detections: PIIDetection[] | null;
  redacted_content?: string | null; // Only present when strategy is 'redact'
}

/**
 * Configuration options for PIIDetector
 */
export interface PIIDetectorOptions {
  /**
   * Model configuration for the detection agent
   * Supports magic strings like "openai/gpt-4o", config objects, or direct LanguageModel instances
   */
  model: MastraModelConfig;

  /**
   * PII types to detect.
   * If not specified, uses default types.
   */
  detectionTypes?: string[];

  /**
   * Confidence threshold for flagging (0-1, default: 0.6)
   * PII is flagged if any category score exceeds this threshold
   */
  threshold?: number;

  /**
   * Strategy when PII is detected:
   * - 'block': Reject the entire input with an error
   * - 'warn': Log warning but allow content through
   * - 'filter': Remove flagged messages but continue with remaining
   * - 'redact': Replace detected PII with redacted versions (default)
   */
  strategy?: 'block' | 'warn' | 'filter' | 'redact';

  /**
   * Redaction method for PII:
   * - 'mask': Replace with asterisks (***@***.com)
   * - 'hash': Replace with SHA256 hash
   * - 'remove': Remove entirely
   * - 'placeholder': Replace with type placeholder ([EMAIL], [PHONE], etc.)
   */
  redactionMethod?: 'mask' | 'hash' | 'remove' | 'placeholder';

  /**
   * Custom detection instructions for the agent
   * If not provided, uses default instructions based on detection types
   */
  instructions?: string;

  /**
   * Whether to include detection details in logs (default: false)
   * Useful for compliance auditing and debugging
   */
  includeDetections?: boolean;

  /**
   * Whether to preserve PII format during redaction (default: true)
   * When true, maintains structure like ***-**-1234 for phone numbers
   */
  preserveFormat?: boolean;

  /**
   * Structured output options used for the detection agent
   */
  structuredOutputOptions?: {
    /**
     * Whether to use system prompt injection instead of native response format to coerce the LLM to respond with json text if the LLM does not natively support structured outputs.
     */
    jsonPromptInjection?: boolean;
  };

  /**
   * Provider-specific options passed to the internal detection agent.
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
 * PIIDetector uses an internal Mastra agent to identify and redact
 * personally identifiable information for privacy compliance.
 *
 * Supports multiple redaction strategies and maintains audit trails
 * for compliance with GDPR, CCPA, HIPAA, and other privacy regulations.
 */
export class PIIDetector implements Processor<'pii-detector'> {
  readonly id = 'pii-detector';
  readonly name = 'PII Detector';

  private detectionAgent: Agent;
  private detectionTypes: string[];
  private threshold: number;
  private strategy: 'block' | 'warn' | 'filter' | 'redact';
  private redactionMethod: 'mask' | 'hash' | 'remove' | 'placeholder';
  private includeDetections: boolean;
  private preserveFormat: boolean;
  private structuredOutputOptions?: PIIDetectorOptions['structuredOutputOptions'];
  private providerOptions?: ProviderOptions;

  // Default PII types based on common privacy regulations and comprehensive PII detection
  private static readonly DEFAULT_DETECTION_TYPES = [
    'email', // Email addresses
    'phone', // Phone numbers
    'credit-card', // Credit card numbers
    'ssn', // Social Security Numbers
    'api-key', // API keys and tokens
    'ip-address', // IP addresses (IPv4 and IPv6)
    'name', // Person names
    'address', // Physical addresses
    'date-of-birth', // Dates of birth
    'url', // URLs that might contain PII
    'uuid', // Universally Unique Identifiers
    'crypto-wallet', // Cryptocurrency wallet addresses
    'iban', // International Bank Account Numbers
  ];

  constructor(options: PIIDetectorOptions) {
    this.detectionTypes = options.detectionTypes || PIIDetector.DEFAULT_DETECTION_TYPES;
    this.threshold = options.threshold ?? 0.6;
    this.strategy = options.strategy || 'redact';
    this.redactionMethod = options.redactionMethod || 'mask';
    this.includeDetections = options.includeDetections ?? false;
    this.preserveFormat = options.preserveFormat ?? true;
    this.structuredOutputOptions = options.structuredOutputOptions;
    this.providerOptions = options.providerOptions;

    // Create internal detection agent
    this.detectionAgent = new Agent({
      id: 'pii-detector',
      name: 'PII Detector',
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

      const processedMessages: MastraDBMessage[] = [];

      // Evaluate each message
      for (const message of messages) {
        const textContent = this.extractTextContent(message);
        if (!textContent.trim()) {
          // No text content to analyze
          processedMessages.push(message);
          continue;
        }

        const detectionResult = await this.detectPII(textContent, observabilityContext);

        if (this.isPIIFlagged(detectionResult)) {
          const processedMessage = this.handleDetectedPII(message, detectionResult, this.strategy, abort);

          // If we reach here, strategy is 'warn', 'filter', or 'redact'
          if (this.strategy === 'filter') {
            continue; // Skip this message
          } else if (this.strategy === 'redact') {
            if (processedMessage) {
              processedMessages.push(processedMessage);
            } else {
              processedMessages.push(message); // Fallback to original if redaction failed
            }
            continue;
          }
        }

        processedMessages.push(message);
      }

      return processedMessages;
    } catch (error) {
      if (error instanceof TripWire) {
        throw error; // Re-throw tripwire errors
      }
      throw new Error(`PII detection failed: ${error instanceof Error ? error.stack : 'Unknown error'}`);
    }
  }

  /**
   * Detect PII using the internal agent
   */
  private async detectPII(content: string, observabilityContext?: ObservabilityContext): Promise<PIIDetectionResult> {
    const prompt = this.createDetectionPrompt(content);

    try {
      const model = await this.detectionAgent.getModel();

      const baseDetectionSchema = z.object({
        type: z.string().describe('Type of PII detected'),
        value: z.string().describe('The actual PII value found'),
        confidence: z.number().min(0).max(1).describe('Confidence of this detection'),
        start: z.number().describe('Start position in the text'),
        end: z.number().describe('End position in the text'),
      });

      const detectionSchema =
        this.strategy === 'redact'
          ? baseDetectionSchema.extend({
              redacted_value: z.string().describe('Redacted version of the value').nullable(),
            })
          : baseDetectionSchema;

      const baseSchema = z.object({
        categories: z
          .array(
            z.object({
              type: z
                .enum(this.detectionTypes as [string, ...string[]])
                .describe('The type of PII detected from the list of detection types'),
              score: z
                .number()
                .min(0)
                .max(1)
                .describe('Confidence level between 0 and 1 indicating how certain the detection is'),
            }),
          )
          .describe('Array of detected PII types with their confidence scores')
          .nullable(),
        detections: z.array(detectionSchema).describe('Array of specific PII detections with locations').nullable(),
      });

      const schema =
        this.strategy === 'redact'
          ? baseSchema.extend({
              redacted_content: z
                .string()
                .describe('The content with all PII redacted according to the redaction method')
                .nullable(),
            })
          : baseSchema;

      let result: PIIDetectionResult;
      if (isSupportedLanguageModel(model)) {
        const response = await this.detectionAgent.generate(prompt, {
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
        const response = await this.detectionAgent.generateLegacy(prompt, {
          output: standardSchemaToJSONSchema(standardSchema),
          temperature: 0,
          providerOptions: this.providerOptions as SharedV2ProviderOptions,
          ...observabilityContext,
        });

        result = response.object as PIIDetectionResult;
      }

      // Apply redaction method if not already provided and we have detections
      if (this.strategy === 'redact') {
        if (!result.redacted_content && result.detections && result.detections.length > 0) {
          result.redacted_content = this.applyRedactionMethod(content, result.detections);
          result.detections = result.detections.map(detection => ({
            ...detection,
            redacted_value: detection.redacted_value || this.redactValue(detection.value, detection.type),
          }));
        }
      }

      return result;
    } catch (error) {
      console.warn('[PIIDetector] Detection agent failed, allowing content:', error);
      // Fail open - return empty result if detection agent fails (no PII detected)
      return {
        categories: null,
        detections: null,
        redacted_content: this.strategy === 'redact' ? null : undefined,
      };
    }
  }

  /**
   * Determine if PII is flagged based on detections or category scores above threshold
   */
  private isPIIFlagged(result: PIIDetectionResult): boolean {
    // Check if we have any detections
    if (result.detections && result.detections.length > 0) {
      return true;
    }

    // Check if any category scores exceed the threshold
    if (result.categories && result.categories.length > 0) {
      const maxScore = Math.max(...result.categories.map(cat => cat.score));
      return maxScore >= this.threshold;
    }

    return false;
  }

  /**
   * Handle detected PII based on strategy
   */
  private handleDetectedPII(
    message: MastraDBMessage,
    result: PIIDetectionResult,
    strategy: 'block' | 'warn' | 'filter' | 'redact',
    abort: (reason?: string) => never,
  ): MastraDBMessage | null {
    const detectedTypes = (result.categories || []).filter(cat => cat.score >= this.threshold).map(cat => cat.type);

    const alertMessage = `PII detected. Types: ${detectedTypes.join(', ')}${
      this.includeDetections && result.detections ? `. Detections: ${result.detections.length} items` : ''
    }`;

    switch (strategy) {
      case 'block':
        abort(alertMessage);

      case 'warn':
        console.warn(`[PIIDetector] ${alertMessage}`);
        return null; // Return null to indicate no message modification

      case 'filter':
        console.info(`[PIIDetector] Filtered message: ${alertMessage}`);
        return null; // Return null to indicate message should be filtered

      case 'redact':
        if (result.redacted_content) {
          console.info(`[PIIDetector] Redacted PII: ${alertMessage}`);
          return this.createRedactedMessage(message, result.redacted_content);
        } else {
          console.warn(`[PIIDetector] No redaction available, filtering: ${alertMessage}`);
          return null; // Fallback to filtering if no redaction available
        }

      default:
        return null;
    }
  }

  /**
   * Create a redacted message with PII removed/masked
   */
  private createRedactedMessage(originalMessage: MastraDBMessage, redactedContent: string): MastraDBMessage {
    return {
      ...originalMessage,
      content: {
        ...originalMessage.content,
        parts: [{ type: 'text', text: redactedContent }],
        content: redactedContent,
      },
    };
  }

  /**
   * Apply redaction method to content
   */
  private applyRedactionMethod(content: string, detections: PIIDetection[]): string {
    let redacted = content;

    // Sort detections by start position in reverse order to maintain indices
    const sortedDetections = [...detections].sort((a, b) => b.start - a.start);

    for (const detection of sortedDetections) {
      const redactedValue = this.redactValue(detection.value, detection.type);
      redacted = redacted.slice(0, detection.start) + redactedValue + redacted.slice(detection.end);
    }

    return redacted;
  }

  /**
   * Redact individual PII value based on method and type
   */
  private redactValue(value: string, type: string): string {
    switch (this.redactionMethod) {
      case 'mask':
        return this.maskValue(value, type);
      case 'hash':
        return this.hashValue(value);
      case 'remove':
        return '';
      case 'placeholder':
        return `[${type.toUpperCase()}]`;
      default:
        return this.maskValue(value, type);
    }
  }

  /**
   * Mask PII value while optionally preserving format
   */
  private maskValue(value: string, type: string): string {
    if (!this.preserveFormat) {
      return '*'.repeat(Math.min(value.length, 8));
    }

    switch (type) {
      case 'email':
        const emailParts = value.split('@');
        if (emailParts.length === 2) {
          const [local, domain] = emailParts;
          const maskedLocal =
            local && local.length > 2 ? local[0] + '*'.repeat(local.length - 2) + local[local.length - 1] : '***';
          const domainParts = domain?.split('.');
          const maskedDomain =
            domainParts && domainParts.length > 1
              ? '*'.repeat(domainParts[0]?.length ?? 0) + '.' + domainParts.slice(1).join('.')
              : '***';
          return `${maskedLocal}@${maskedDomain}`;
        }
        break;

      case 'phone':
        // Preserve format like XXX-XXX-1234 or (XXX) XXX-1234
        return value.replace(/\d/g, (match, index) => {
          // Keep last 4 digits
          return index >= value.length - 4 ? match : 'X';
        });

      case 'credit-card':
        // Show last 4 digits: ****-****-****-1234
        return value.replace(/\d/g, (match, index) => {
          return index >= value.length - 4 ? match : '*';
        });

      case 'ssn':
        // Show last 4 digits: ***-**-1234
        return value.replace(/\d/g, (match, index) => {
          return index >= value.length - 4 ? match : '*';
        });

      case 'uuid':
        // Mask UUID: ********-****-****-****-************
        return value.replace(/[a-f0-9]/gi, '*');

      case 'crypto-wallet':
        // Show first 4 and last 4 characters: 1Lbc...X71
        if (value.length > 8) {
          return value.slice(0, 4) + '*'.repeat(value.length - 8) + value.slice(-4);
        }
        return '*'.repeat(value.length);

      case 'iban':
        // Show country code and last 4 digits: DE**************3000
        if (value.length > 6) {
          return value.slice(0, 2) + '*'.repeat(value.length - 6) + value.slice(-4);
        }
        return '*'.repeat(value.length);

      default:
        // Generic masking - show first and last character if long enough
        if (value.length <= 3) {
          return '*'.repeat(value.length);
        }
        return value[0] + '*'.repeat(value.length - 2) + value[value.length - 1];
    }

    return '*'.repeat(Math.min(value.length, 8));
  }

  /**
   * Hash PII value using SHA256
   */
  private hashValue(value: string): string {
    return `[HASH:${crypto.createHash('sha256').update(value).digest('hex').slice(0, 8)}]`;
  }

  /**
   * Extract text content from message for analysis
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
   * Create default detection instructions
   */
  private createDefaultInstructions(): string {
    return `You are a PII (Personally Identifiable Information) detection specialist. Your job is to identify and locate sensitive personal information in text content for privacy compliance.

Detect and analyze the following PII types:
${this.detectionTypes.map(type => `- ${type}`).join('\n')}

IMPORTANT: Only include PII types that are actually detected. If no PII is found, return empty arrays for categories and detections.`;
  }

  /**
   * Process streaming output chunks for PII detection and redaction
   */
  async processOutputStream(
    args: {
      part: ChunkType;
      streamParts: ChunkType[];
      state: Record<string, any>;
      abort: (reason?: string) => never;
    } & Partial<ObservabilityContext>,
  ): Promise<ChunkType | null> {
    const { part, abort, ...rest } = args;
    const observabilityContext = resolveObservabilityContext(rest);
    try {
      // Only process text-delta chunks
      if (part.type !== 'text-delta') {
        return part;
      }

      const textContent = part.payload.text;
      if (!textContent.trim()) {
        return part;
      }

      const detectionResult = await this.detectPII(textContent, observabilityContext);

      if (this.isPIIFlagged(detectionResult)) {
        switch (this.strategy) {
          case 'block':
            abort(`PII detected in streaming content. Types: ${this.getDetectedTypes(detectionResult).join(', ')}`);

          case 'warn':
            console.warn(
              `[PIIDetector] PII detected in streaming content: ${this.getDetectedTypes(detectionResult).join(', ')}`,
            );
            return part; // Allow content through with warning

          case 'filter':
            console.info(
              `[PIIDetector] Filtered streaming part with PII: ${this.getDetectedTypes(detectionResult).join(', ')}`,
            );
            return null; // Don't emit this part

          case 'redact':
            if (detectionResult.redacted_content) {
              console.info(
                `[PIIDetector] Redacted PII in streaming content: ${this.getDetectedTypes(detectionResult).join(', ')}`,
              );
              return {
                ...part,
                payload: {
                  ...part.payload,
                  text: detectionResult.redacted_content,
                },
              };
            } else {
              console.warn(`[PIIDetector] No redaction available for streaming part, filtering`);
              return null; // Fallback to filtering if no redaction available
            }

          default:
            return part;
        }
      }

      return part;
    } catch (error) {
      if (error instanceof TripWire) {
        throw error; // Re-throw tripwire errors
      }
      console.warn('[PIIDetector] Streaming detection failed, allowing content:', error);
      return part; // Fail open - allow content if detection fails
    }
  }

  /**
   * Process final output result for PII detection and redaction
   */
  async processOutputResult({
    messages,
    abort,
    ...rest
  }: {
    messages: MastraDBMessage[];
    abort: (reason?: string) => never;
  } & Partial<ObservabilityContext>): Promise<MastraDBMessage[]> {
    const observabilityContext = resolveObservabilityContext(rest);
    try {
      if (messages.length === 0) {
        return messages;
      }

      const processedMessages: MastraDBMessage[] = [];

      // Evaluate each message
      for (const message of messages) {
        const textContent = this.extractTextContent(message);
        if (!textContent.trim()) {
          // No text content to analyze
          processedMessages.push(message);
          continue;
        }

        const detectionResult = await this.detectPII(textContent, observabilityContext);

        if (this.isPIIFlagged(detectionResult)) {
          const processedMessage = this.handleDetectedPII(message, detectionResult, this.strategy, abort);

          // If we reach here, strategy is 'warn', 'filter', or 'redact'
          if (this.strategy === 'filter') {
            continue; // Skip this message
          } else if (this.strategy === 'redact') {
            if (processedMessage) {
              processedMessages.push(processedMessage);
            } else {
              processedMessages.push(message); // Fallback to original if redaction failed
            }
            continue;
          }
        }

        processedMessages.push(message);
      }

      return processedMessages;
    } catch (error) {
      if (error instanceof TripWire) {
        throw error; // Re-throw tripwire errors
      }
      throw new Error(`PII detection failed: ${error instanceof Error ? error.stack : 'Unknown error'}`);
    }
  }

  /**
   * Get detected PII types from detection result
   */
  private getDetectedTypes(result: PIIDetectionResult): string[] {
    if (result.detections && result.detections.length > 0) {
      return [...new Set(result.detections.map(d => d.type))];
    }

    if (result.categories) {
      return Object.entries(result.categories)
        .filter(([_, score]) => typeof score === 'number' && score >= this.threshold)
        .map(([type]) => type);
    }

    return [];
  }

  /**
   * Create detection prompt for the agent
   */
  private createDetectionPrompt(content: string): string {
    return `Analyze the following content for PII (Personally Identifiable Information):
Content: "${content}"`;
  }
}
