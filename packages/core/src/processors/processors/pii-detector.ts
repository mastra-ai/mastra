import * as crypto from 'node:crypto';
import type { SharedV2ProviderOptions } from '@ai-sdk/provider-v5';
import { z } from 'zod/v4';
import { Agent, isSupportedLanguageModel } from '../../agent';
import type { MastraDBMessage } from '../../agent/message-list';
import { TripWire } from '../../agent/trip-wire';
import type { ProviderOptions } from '../../llm/model/provider-options';
import type { MastraModelConfig } from '../../llm/model/shared.types';
import type { ObservabilityContext } from '../../observability';
import { InternalSpans, resolveObservabilityContext } from '../../observability';
import type { PublicSchema } from '../../schema';
import { toStandardSchema, standardSchemaToJSONSchema } from '../../schema';
import type { ChunkType } from '../../stream';
import { ChunkFrom } from '../../stream/types';
import type { Processor } from '../index';
import { REPROCESS_PART_KEY } from '../stream-reprocess';
import { selectMessagesToCheck } from './message-selection';
import type { LastMessageOnlyOption } from './message-selection';

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
export interface PIIDetectorOptions extends LastMessageOnlyOption {
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

  /**
   * Character threshold for flushing the LLM buffer during streaming (default: 200).
   * Only applies when LLM-only detection types (name, address, date-of-birth) are configured.
   * Higher values give the LLM more context but add more stream latency.
   * Lower values reduce latency but may miss PII that spans multiple chunks.
   */
  bufferSize?: number;
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
  private lastMessageOnly: boolean;
  private structuredOutputOptions?: PIIDetectorOptions['structuredOutputOptions'];
  private providerOptions?: ProviderOptions;
  private bufferSize: number;

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

  /**
   * Regex patterns for local (zero-cost) PII detection during streaming.
   * These run instead of LLM calls in processOutputStream to eliminate
   * per-chunk API costs and latency.
   */
  private static readonly PII_PATTERNS: Record<string, RegExp> = {
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    phone: /(?:\+?\d{1,3}[-.\ ]?)?\(?\d{3}\)?[-.\ ]?\d{3}[-.\ ]?\d{4}/g,
    'credit-card': /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
    'api-key':
      /(?:(?:sk|pk)[-_](?:live|test|proj)[-_][A-Za-z0-9]{16,}|(?:api[_-]?key|apikey|api[_-]?secret)\s*[:=]\s*["']?[a-zA-Z0-9_\-]{20,}["']?)/gi,
    'ip-address': /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
    url: /https?:\/\/[^\s<>"']+/gi,
    uuid: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
    'crypto-wallet': /\b(?:0x[a-fA-F0-9]{40}|[13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-zA-HJ-NP-Z0-9]{39,59})\b/g,
    iban: /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}(?:[A-Z0-9]?){0,16}\b/g,
  };

  /** PII types that require LLM context and cannot be detected by regex */
  private static readonly LLM_ONLY_TYPES = new Set(['name', 'address', 'date-of-birth']);

  /** Default character threshold for flushing the LLM buffer during streaming. */
  private static readonly DEFAULT_BUFFER_SIZE = 200;

  /**
   * Number of characters to carry over between chunks for regex detection.
   * Ensures PII split across chunk boundaries (e.g. "test@" + "example.com") is caught.
   */
  private static readonly REGEX_CARRYOVER_SIZE = 128;

  constructor(options: PIIDetectorOptions) {
    this.detectionTypes = options.detectionTypes || PIIDetector.DEFAULT_DETECTION_TYPES;
    this.threshold = options.threshold ?? 0.6;
    this.strategy = options.strategy || 'redact';
    this.redactionMethod = options.redactionMethod || 'mask';
    this.includeDetections = options.includeDetections ?? false;
    this.preserveFormat = options.preserveFormat ?? true;
    this.lastMessageOnly = options.lastMessageOnly ?? false;
    this.structuredOutputOptions = options.structuredOutputOptions;
    this.providerOptions = options.providerOptions;
    this.bufferSize = options.bufferSize ?? PIIDetector.DEFAULT_BUFFER_SIZE;

    // Create internal detection agent
    this.detectionAgent = new Agent({
      id: 'pii-detector',
      name: 'PII Detector',
      instructions: options.instructions || this.createDefaultInstructions(),
      model: options.model,
      options: {
        tracingPolicy: { internal: InternalSpans.ALL },
      },
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
      const messagesToCheck = selectMessagesToCheck(messages, this.lastMessageOnly);
      const checkedMessageIds = new Set(messagesToCheck.map(message => message.id));

      // Evaluate each message
      for (const message of messages) {
        if (!checkedMessageIds.has(message.id)) {
          processedMessages.push(message);
          continue;
        }
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
    // Check if we have any detections above confidence threshold
    if (result.detections && result.detections.length > 0) {
      return result.detections.some(d => d.confidence >= this.threshold);
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
        return null;

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
   * Detect PII using local regex patterns (zero-cost, no LLM calls).
   * Used during streaming to avoid per-chunk LLM API calls.
   * Context-dependent types (name, address, date-of-birth) are skipped
   * here and handled by the LLM-based detectPII in processOutputResult.
   */
  private detectPIILocal(content: string): PIIDetectionResult {
    const categories: PIICategoryScores = [];
    const detections: PIIDetection[] = [];

    for (const type of this.detectionTypes) {
      if (PIIDetector.LLM_ONLY_TYPES.has(type)) continue;

      const pattern = PIIDetector.PII_PATTERNS[type];
      if (!pattern) continue;

      // Reset lastIndex for /g patterns
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        detections.push({
          type,
          value: match[0],
          confidence: 1.0,
          start: match.index,
          end: match.index + match[0].length,
          ...(this.strategy === 'redact' ? { redacted_value: this.redactValue(match[0], type) } : {}),
        });
      }
    }

    const detectedTypes = new Set(detections.map(d => d.type));
    for (const type of detectedTypes) {
      categories.push({ type, score: 1.0 });
    }

    let redacted_content: string | null | undefined;
    if (this.strategy === 'redact' && detections.length > 0) {
      redacted_content = this.applyRedactionMethod(content, detections);
    } else if (this.strategy === 'redact') {
      redacted_content = null;
    }

    return {
      categories: categories.length > 0 ? categories : null,
      detections: detections.length > 0 ? detections : null,
      ...(this.strategy === 'redact' ? { redacted_content } : {}),
    };
  }

  /** Whether any of the configured detection types require LLM-based analysis */
  private get hasLLMOnlyTypes(): boolean {
    return this.detectionTypes.some(t => PIIDetector.LLM_ONLY_TYPES.has(t));
  }

  /**
   * Apply the configured strategy to a detection result.
   * Returns the (possibly redacted) chunk, or null if filtered/blocked.
   */
  private applyStreamStrategy(
    part: ChunkType & { type: 'text-delta' },
    detectionResult: PIIDetectionResult,
    abort: (reason?: string) => never,
  ): ChunkType | null {
    switch (this.strategy) {
      case 'block':
        abort(`PII detected in streaming content. Types: ${this.getDetectedTypes(detectionResult).join(', ')}`);
        return null;

      case 'warn':
        console.warn(
          `[PIIDetector] PII detected in streaming content: ${this.getDetectedTypes(detectionResult).join(', ')}`,
        );
        return part;

      case 'filter':
        console.info(
          `[PIIDetector] Filtered streaming part with PII: ${this.getDetectedTypes(detectionResult).join(', ')}`,
        );
        return null;

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
          return null;
        }

      default:
        return part;
    }
  }

  /**
   * Flush the LLM buffer: call the LLM once on accumulated text to detect
   * context-dependent PII (names, addresses, DOB).
   * Returns a combined text-delta chunk (possibly redacted), or null if filtered/blocked.
   */
  private async flushLLMBuffer(
    state: Record<string, any>,
    abort: (reason?: string) => never,
    observabilityContext?: ObservabilityContext,
  ): Promise<ChunkType | null> {
    const buffer: string = state._piiBuffer || '';
    const firstPayloadId: string = state._piiFirstPayloadId || 'text-0';
    const firstRunId: string = state._piiFirstRunId || '';

    state._piiBuffer = '';
    state._piiFirstPayloadId = undefined;
    state._piiFirstRunId = undefined;

    if (!buffer) return null;

    const detectionResult = await this.detectPII(buffer, observabilityContext);

    const combinedPart: ChunkType = {
      type: 'text-delta',
      payload: { text: buffer, id: firstPayloadId },
      runId: firstRunId,
      from: ChunkFrom.AGENT,
    };

    if (this.isPIIFlagged(detectionResult)) {
      return this.applyStreamStrategy(combinedPart, detectionResult, abort);
    }

    return combinedPart;
  }

  /**
   * Process streaming output chunks for PII detection and redaction.
   *
   * Two modes based on configured detection types:
   *
   * 1. **Regex-only** (no LLM-only types like name/address/DOB configured):
   *    Each chunk is checked with zero-cost regex patterns and emitted
   *    immediately. No LLM calls, no buffering, no latency.
   *
   * 2. **Regex + LLM buffering** (LLM-only types configured):
   *    Each chunk is first checked with regex. Chunks are then buffered and
   *    flushed through the LLM at sentence boundaries or size thresholds.
   *    This ensures context-dependent PII (names, addresses) is caught
   *    before reaching the user, while limiting LLM calls to ~3-5 per
   *    response instead of 50-100.
   */
  async processOutputStream(
    args: {
      part: ChunkType;
      streamParts: ChunkType[];
      state: Record<string, any>;
      abort: (reason?: string) => never;
      writer?: { custom: (data: ChunkType) => Promise<void> };
    } & Partial<ObservabilityContext>,
  ): Promise<ChunkType | null> {
    const { part, abort, state, writer, ...rest } = args;
    const observabilityContext = resolveObservabilityContext(rest);
    try {
      // Handle non-text chunks: flush any pending LLM buffer first
      if (part.type !== 'text-delta') {
        if (this.hasLLMOnlyTypes && state._piiBuffer) {
          const flushed = await this.flushLLMBuffer(state, abort, observabilityContext);
          if (flushed) {
            // Two parts to emit: flushed buffer + this non-text part.
            // Use REPROCESS_PART_KEY so the runner re-drives the non-text part.
            if (writer) {
              state[REPROCESS_PART_KEY] = part;
              return flushed;
            }
            // No writer (unit tests): queue non-text for next call
            if (!state._piiPendingNonText) state._piiPendingNonText = [];
            state._piiPendingNonText.push(part);
            return flushed;
          }
        }
        return part;
      }

      // At this point we know part.type === 'text-delta'
      const textPart = part as ChunkType & { type: 'text-delta' };

      // Drain queued non-text parts (FIFO) stashed from previous flush
      if (state._piiPendingNonText && state._piiPendingNonText.length > 0) {
        const pending = state._piiPendingNonText.shift();
        if (state._piiPendingNonText.length === 0) {
          state._piiPendingNonText = undefined;
        }
        // Re-queue current text part for the next call
        if (!state._piiBuffer) state._piiBuffer = '';
        state._piiBuffer += textPart.payload.text;
        if (!state._piiFirstPayloadId) {
          state._piiFirstPayloadId = textPart.payload.id;
          state._piiFirstRunId = textPart.runId;
        }
        return pending;
      }
      const textContent = textPart.payload.text;
      if (!textContent.trim()) {
        return textPart;
      }

      // Step 1: Regex-based detection with carryover for split PII
      const tail: string = state._piiRegexTail || '';
      const combined = tail + textContent;
      const regexResult = this.detectPIILocal(combined);
      // Update tail for next chunk
      state._piiRegexTail = combined.slice(-PIIDetector.REGEX_CARRYOVER_SIZE);

      // Only flag if PII overlaps with the new chunk (not just the carryover tail)
      const hasNewPII =
        this.isPIIFlagged(regexResult) && (regexResult.detections?.some(d => d.end > tail.length) ?? false);

      if (hasNewPII) {
        // Regex caught pattern-based PII — apply strategy to original chunk
        // (redaction is applied to `combined` then we extract the new portion)
        const combinedRedacted = regexResult.redacted_content;
        let effectiveResult: ChunkType | null;
        if (this.strategy === 'redact' && combinedRedacted) {
          // Extract only the portion corresponding to the new chunk
          const redactedNew = combinedRedacted.slice(tail.length);
          const redactedPart: ChunkType & { type: 'text-delta' } = {
            ...textPart,
            payload: { ...textPart.payload, text: redactedNew },
          };
          console.info(
            `[PIIDetector] Redacted PII in streaming content: ${this.getDetectedTypes(regexResult).join(', ')}`,
          );
          effectiveResult = redactedPart;
        } else {
          effectiveResult = this.applyStreamStrategy(textPart, regexResult, abort);
        }
        // If block/filter returned null or threw, no need to buffer
        if (!effectiveResult) return null;
        // For warn/redact, the chunk passes through (possibly redacted)
        // If we're in buffered mode, buffer the processed text
        if (this.hasLLMOnlyTypes) {
          if (!state._piiBuffer) state._piiBuffer = '';
          if (!state._piiFirstPayloadId) {
            state._piiFirstPayloadId = textPart.payload.id;
            state._piiFirstRunId = textPart.runId;
          }
          state._piiBuffer +=
            effectiveResult.type === 'text-delta'
              ? (effectiveResult as ChunkType & { type: 'text-delta' }).payload.text
              : textContent;
          // Check flush threshold
          if (state._piiBuffer.length >= this.bufferSize || /[.!?]\s*$/.test(state._piiBuffer)) {
            return this.flushLLMBuffer(state, abort, observabilityContext);
          }
          return null; // Hold back until flush
        }
        return effectiveResult;
      }

      // Step 2: No regex PII found
      if (!this.hasLLMOnlyTypes) {
        // Pure regex mode — emit immediately
        return textPart;
      }

      // Step 3: LLM-only types configured — buffer for periodic LLM check
      if (!state._piiBuffer) state._piiBuffer = '';
      if (!state._piiFirstPayloadId) {
        state._piiFirstPayloadId = textPart.payload.id;
        state._piiFirstRunId = textPart.runId;
      }
      state._piiBuffer += textContent;

      // Flush on sentence boundary or size threshold
      if (state._piiBuffer.length >= this.bufferSize || /[.!?]\s*$/.test(state._piiBuffer)) {
        return this.flushLLMBuffer(state, abort, observabilityContext);
      }

      return null; // Hold back until flush
    } catch (error) {
      if (error instanceof TripWire) {
        throw error;
      }
      console.warn('[PIIDetector] Streaming detection failed, allowing content:', error);
      return part;
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
      const messagesToCheck = selectMessagesToCheck(messages, this.lastMessageOnly);
      const checkedMessageIds = new Set(messagesToCheck.map(message => message.id));

      // Evaluate each message
      for (const message of messages) {
        if (!checkedMessageIds.has(message.id)) {
          processedMessages.push(message);
          continue;
        }
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
